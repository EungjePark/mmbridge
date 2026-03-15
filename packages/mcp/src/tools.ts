import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import {
  createContext,
  cleanupContext,
  parseFindings,
  enrichFindings,
  orchestrateReview,
  runBridge,
  buildContextIndex,
  buildResultIndex,
  interpretFindings,
} from '@mmbridge/core';
import type { Finding, ContextWorkspace } from '@mmbridge/core';
import { runReviewAdapter, runFollowupAdapter, defaultRegistry } from '@mmbridge/adapters';
import { SessionStore } from '@mmbridge/session-store';

const store = new SessionStore();

function ctxToContextIndex(ctx: ContextWorkspace, projectDir: string, mode: string) {
  return buildContextIndex({
    workspace: ctx.workspace,
    projectDir,
    mode,
    baseRef: ctx.baseRef,
    head: ctx.head,
    changedFiles: ctx.changedFiles,
    copiedFileCount: ctx.copiedFileCount,
    redaction: ctx.redaction,
  });
}

const TOOL_DEFINITIONS = [
  {
    name: 'mmbridge_review',
    description:
      'Run a code review using AI tools. Supports single-tool or multi-tool bridge mode with consensus analysis.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        tool: {
          type: 'string',
          enum: ['kimi', 'qwen', 'codex', 'gemini', 'droid', 'claude', 'all'],
          description: 'AI tool to use. "all" runs all installed tools with bridge consensus.',
        },
        mode: {
          type: 'string',
          enum: ['review', 'security', 'architecture'],
          default: 'review',
          description: 'Review mode',
        },
        bridge: {
          type: 'string',
          enum: ['none', 'standard', 'interpreted'],
          default: 'none',
          description: 'Bridge mode. "interpreted" adds Codex GPT-5.4 analysis.',
        },
        baseRef: {
          type: 'string',
          description: 'Git base ref for diff (default: auto-detected)',
        },
      },
      required: ['tool'],
    },
  },
  {
    name: 'mmbridge_followup',
    description: 'Send a follow-up prompt to an existing review session for deeper analysis.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        tool: { type: 'string', description: 'AI tool that ran the original review' },
        sessionId: { type: 'string', description: 'External session ID from the original review' },
        prompt: { type: 'string', description: 'Follow-up question or analysis request' },
      },
      required: ['tool', 'sessionId', 'prompt'],
    },
  },
  {
    name: 'mmbridge_interpret',
    description:
      'Request additional interpretation of review findings using Codex GPT-5.4. Filters false positives and generates action plans.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        findings: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              severity: { type: 'string' },
              file: { type: 'string' },
              line: { type: 'number' },
              message: { type: 'string' },
            },
          },
          description: 'Findings to interpret',
        },
        changedFiles: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of changed file paths for context',
        },
      },
      required: ['findings', 'changedFiles'],
    },
  },
  {
    name: 'mmbridge_sessions',
    description: 'List recent review sessions with summaries and finding counts.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        tool: { type: 'string', description: 'Filter by tool name' },
        limit: { type: 'number', default: 10, description: 'Max sessions to return' },
      },
    },
  },
];

export function registerToolHandlers(server: Server): void {
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOL_DEFINITIONS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const safeArgs = (args ?? {}) as Record<string, unknown>;

    switch (name) {
      case 'mmbridge_review':
        return handleReview(safeArgs);
      case 'mmbridge_followup':
        return handleFollowup(safeArgs);
      case 'mmbridge_interpret':
        return handleInterpret(safeArgs);
      case 'mmbridge_sessions':
        return handleSessions(safeArgs);
      default:
        return {
          content: [{ type: 'text' as const, text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  });
}

async function handleReview(args: Record<string, unknown>) {
  const tool = String(args['tool'] ?? 'kimi');
  const mode = String(args['mode'] ?? 'review');
  const bridge = String(args['bridge'] ?? 'none');
  const baseRef = args['baseRef'] as string | undefined;
  const projectDir = process.cwd();

  try {
    const ctxWorkspace = await createContext({ projectDir, mode, baseRef });

    if (tool === 'all' || bridge !== 'none') {
      const installedTools = await defaultRegistry.listInstalled();
      if (installedTools.length === 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'No review tools installed. Run `mmbridge doctor` to check.',
            },
          ],
          isError: true,
        };
      }

      const orchResult = await orchestrateReview({
        tools: installedTools,
        workspace: ctxWorkspace.workspace,
        mode,
        baseRef: ctxWorkspace.baseRef,
        changedFiles: ctxWorkspace.changedFiles,
        runAdapter: (t, opts) => runReviewAdapter(t, opts),
      });

      const isInterpreted = bridge === 'interpreted';
      const bridgeResult = await runBridge({
        profile: 'standard',
        interpret: isInterpreted,
        workspace: ctxWorkspace.workspace,
        changedFiles: ctxWorkspace.changedFiles,
        results: orchResult.results.map((r) => ({
          tool: r.tool,
          findings: r.findings,
          summary: r.summary,
          skipped: r.skipped,
        })),
      });

      const session = await store.save({
        tool: 'bridge',
        mode,
        projectDir,
        workspace: ctxWorkspace.workspace,
        summary: bridgeResult.summary,
        findings: bridgeResult.findings,
        contextIndex: ctxToContextIndex(ctxWorkspace, projectDir, mode),
        resultIndex: buildResultIndex({
          summary: bridgeResult.summary,
          findings: bridgeResult.findings,
          bridgeSummary: bridgeResult.summary,
        }),
      });

      await cleanupContext(ctxWorkspace.workspace).catch(() => {});

      const result = {
        sessionId: session.id,
        summary: bridgeResult.summary,
        findings: bridgeResult.findings,
        toolResults: orchResult.results.map((r) => ({
          tool: r.tool,
          findingCount: r.findings.length,
          skipped: r.skipped,
        })),
        interpretation: bridgeResult.interpretation ?? null,
      };

      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }

    // Single tool review
    const adapterResult = await runReviewAdapter(tool, {
      workspace: ctxWorkspace.workspace,
      cwd: projectDir,
      mode,
      baseRef: ctxWorkspace.baseRef,
      changedFiles: ctxWorkspace.changedFiles,
    });

    const rawFindings = parseFindings(adapterResult.text);
    const enriched = enrichFindings(rawFindings, ctxWorkspace.changedFiles);

    const session = await store.save({
      tool,
      mode,
      projectDir,
      workspace: ctxWorkspace.workspace,
      summary: enriched.summary ?? `${enriched.findings.length} findings`,
      findings: enriched.findings,
      externalSessionId: adapterResult.externalSessionId,
      followupSupported: adapterResult.followupSupported,
      contextIndex: ctxToContextIndex(ctxWorkspace, projectDir, mode),
      resultIndex: buildResultIndex({
        summary: adapterResult.text,
        findings: enriched.findings,
        followupSupported: adapterResult.followupSupported,
      }),
      status: 'complete',
    });

    await cleanupContext(ctxWorkspace.workspace).catch(() => {});

    const result = {
      sessionId: session.id,
      summary: enriched.summary ?? `${enriched.findings.length} findings`,
      findings: enriched.findings,
      followupSupported: adapterResult.followupSupported,
      externalSessionId: adapterResult.externalSessionId,
    };

    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text' as const, text: `Review failed: ${message}` }],
      isError: true,
    };
  }
}

async function handleFollowup(args: Record<string, unknown>) {
  const tool = String(args['tool']);
  const sessionId = String(args['sessionId']);
  const prompt = String(args['prompt']);

  try {
    const result = await runFollowupAdapter(tool, {
      workspace: process.cwd(),
      sessionId,
      prompt,
    });

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            { tool, sessionId, text: result.text, ok: result.ok },
            null,
            2,
          ),
        },
      ],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text' as const, text: `Followup failed: ${message}` }],
      isError: true,
    };
  }
}

async function handleInterpret(args: Record<string, unknown>) {
  if (!Array.isArray(args['findings'])) {
    return { content: [{ type: 'text' as const, text: 'findings must be an array' }], isError: true };
  }
  const rawFindings = args['findings'] as Array<Record<string, unknown>>;
  const findings: Finding[] = rawFindings.map((f) => ({
    severity: String(f['severity'] ?? 'INFO') as Finding['severity'],
    file: String(f['file'] ?? ''),
    line: typeof f['line'] === 'number' ? f['line'] : null,
    message: String(f['message'] ?? ''),
  }));
  const changedFiles = Array.isArray(args['changedFiles'])
    ? (args['changedFiles'] as string[])
    : [];

  try {
    const result = await interpretFindings({
      mergedFindings: findings,
      changedFiles,
      projectContext: '',
      workspace: process.cwd(),
    });
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text' as const, text: `Interpret failed: ${message}` }],
      isError: true,
    };
  }
}

async function handleSessions(args: Record<string, unknown>) {
  const tool = args['tool'] as string | undefined;
  const limit = typeof args['limit'] === 'number' ? args['limit'] : 10;

  const sessions = await store.list({ tool });

  const result = sessions.slice(0, limit).map((s) => ({
    id: s.id,
    tool: s.tool,
    mode: s.mode,
    createdAt: s.createdAt,
    findingCount: (s.findings ?? []).length,
    summary: s.summary?.slice(0, 100),
    followupSupported: s.followupSupported ?? false,
    externalSessionId: s.externalSessionId ?? null,
  }));

  return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
}
