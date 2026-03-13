import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { Command } from 'commander';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReviewCommandOptions {
  tool?: string;
  mode?: string;
  bridge?: string;
  baseRef?: string;
  commit?: string;
  project?: string;
  json?: boolean;
}

export interface FollowupCommandOptions {
  tool: string;
  prompt: string;
  json?: boolean;
  explicitSessionId?: string;
  projectDir?: string;
  useLatestWhenMissing?: boolean;
}

export interface SyncAgentsOptions {
  dryRun?: boolean;
  verbose?: boolean;
}

export interface DashboardOptions {
  mode?: string;
  project?: string;
  json?: boolean;
}

export interface DoctorOptions {
  json?: boolean;
  setup?: boolean;
}

// ─── Lazy dependency loaders ──────────────────────────────────────────────────
// Each dependency is loaded lazily on first use so that `mmbridge --help`
// remains fast and doesn't fail if optional peer packages are absent.

async function importCore() {
  const mod = await import('@mmbridge/core');
  return mod;
}

async function importAdapters() {
  const mod = await import('@mmbridge/adapters');
  return mod;
}

async function importSessionStore() {
  const mod = await import('@mmbridge/session-store');
  return mod;
}

async function importTui() {
  const mod = await import('@mmbridge/tui');
  return mod;
}

async function importIntegrations() {
  const mod = await import('@mmbridge/integrations');
  return mod;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveProjectDir(option: string | undefined): string {
  return option ? path.resolve(option) : process.cwd();
}

function jsonOutput(data: unknown): void {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
}

function exitWithError(message: string, code = 1): never {
  process.stderr.write(`[mmbridge] ${message}\n`);
  // process.exit returns never once @types/node is installed;
  // the throw below satisfies TypeScript until then.
  process.exit(code);
  throw new Error('unreachable');
}

// ─── Command: review ──────────────────────────────────────────────────────────

async function runReviewCommand(options: ReviewCommandOptions): Promise<void> {
  const projectDir = resolveProjectDir(options.project);
  const mode = options.mode ?? 'review';

  const {
    buildContextIndex,
    buildProjectContext,
    buildResultIndex,
    commandExists,
    createContextWorkspace,
    enrichReport,
    runBridgeAgent,
  } = await importCore();

  const { runReviewAdapter } = await importAdapters();
  const { SessionStore } = await importSessionStore();
  const { renderReviewConsole } = await importTui();

  // Verify at least one tool binary is available
  const tool = options.tool ?? 'kimi';
  const binaryMap: Record<string, string> = {
    kimi: 'kimi',
    qwen: 'qwen',
    codex: 'codex',
    gemini: 'opencode',
  };
  const binary = binaryMap[tool];
  if (!binary) {
    exitWithError(`Unknown tool: ${tool}. Valid tools: ${Object.keys(binaryMap).join(', ')}`);
  }
  const isInstalled = await commandExists(binary);
  if (!isInstalled) {
    exitWithError(
      `Binary "${binary}" not found in PATH. Install it to use the "${tool}" adapter.`,
    );
  }

  const workspace = await createContextWorkspace({
    projectDir,
    mode,
    baseRef: options.baseRef,
    commit: options.commit,
  });

  const contextIndex = buildContextIndex({
    workspace: workspace.workspace,
    projectDir: workspace.projectDir,
    mode: workspace.mode,
    baseRef: workspace.baseRef,
    head: workspace.head,
    changedFiles: workspace.changedFiles,
    copiedFileCount: workspace.copiedFileCount,
    redaction: workspace.redaction,
  });

  const adapterResult = await runReviewAdapter(tool, {
    workspace: workspace.workspace,
    cwd: projectDir,
    mode,
    baseRef: options.baseRef,
    commit: options.commit,
    changedFiles: workspace.changedFiles,
    sessionId: workspace.workspace,
  });

  const enriched = await enrichReport(
    adapterResult.text,
    workspace.changedFiles,
    { tool, mode },
  );

  const resultIndex = buildResultIndex({
    summary: enriched.summary,
    findings: enriched.findings,
    filteredCount: enriched.filteredCount,
    promotedCount: enriched.promotedCount,
    followupSupported: adapterResult.followupSupported,
    parseState: 'parsed',
  });

  const sessionStore = new SessionStore(projectDir);
  const localSessionId = await sessionStore.save({
    tool,
    mode,
    projectDir,
    externalSessionId: adapterResult.externalSessionId,
    batchId: null,
    summary: enriched.summary,
    findings: enriched.findings,
    contextIndex,
    resultIndex,
  });

  // Bridge aggregation when requested
  if (options.bridge) {
    const projectContext = await buildProjectContext({ projectDir });
    await runBridgeAgent({
      profile: options.bridge,
      projectContext,
      results: [
        {
          tool,
          findings: enriched.findings,
          summary: enriched.summary,
        },
      ],
    });
  }

  const report = {
    localSessionId,
    externalSessionId: adapterResult.externalSessionId,
    workspace: workspace.workspace,
    summary: enriched.summary,
    findings: enriched.findings,
    resultIndex,
    changedFiles: workspace.copiedFileCount,
    copiedFiles: workspace.copiedFileCount,
    followupSupported: adapterResult.followupSupported,
  };

  if (options.json) {
    jsonOutput(report);
    return;
  }

  await renderReviewConsole(report);
}

// ─── Command: followup ────────────────────────────────────────────────────────

async function runFollowupCommand(options: FollowupCommandOptions): Promise<void> {
  const projectDir = resolveProjectDir(options.projectDir);

  const { SessionStore } = await importSessionStore();
  const { runFollowupAdapter } = await importAdapters();
  const { renderReviewConsole } = await importTui();

  const sessionStore = new SessionStore(projectDir);

  let sessionId = options.explicitSessionId;
  if (!sessionId) {
    if (options.useLatestWhenMissing) {
      const latest = await sessionStore.getLatest({ tool: options.tool });
      if (!latest?.externalSessionId) {
        exitWithError(
          `No external session ID found for tool "${options.tool}". Run a review first.`,
        );
      }
      sessionId = latest.externalSessionId;
    } else {
      exitWithError('Session ID is required. Pass --session or run with --latest flag.');
    }
  }

  const result = await runFollowupAdapter(options.tool, {
    workspace: projectDir,
    cwd: projectDir,
    sessionId,
    prompt: options.prompt,
  });

  const report = {
    externalSessionId: result.externalSessionId ?? undefined,
    summary: result.text,
    findings: [],
    followupSupported: result.followupSupported,
  };

  if (options.json) {
    jsonOutput(report);
    return;
  }

  await renderReviewConsole(report);
}

// ─── Command: dashboard ───────────────────────────────────────────────────────

async function runDashboardCommand(options: DashboardOptions): Promise<void> {
  const projectDir = resolveProjectDir(options.project);

  const { commandExists } = await importCore();
  const { SessionStore } = await importSessionStore();
  const { renderDashboard } = await importTui();

  const sessionStore = new SessionStore(projectDir);
  const sessions = await sessionStore.list({ modeFilter: options.mode });

  const tools = ['kimi', 'qwen', 'codex', 'gemini'];
  const binaryMap: Record<string, string> = {
    kimi: 'kimi',
    qwen: 'qwen',
    codex: 'codex',
    gemini: 'opencode',
  };

  const models = await Promise.all(
    tools.map(async (tool) => {
      const binary = binaryMap[tool] ?? tool;
      const installed = await commandExists(binary);
      const toolSessions = sessions.filter((s: { tool: string }) => s.tool === tool);
      const latest = toolSessions[0] ?? null;
      return {
        tool,
        binary,
        installed,
        totalSessions: toolSessions.length,
        latestMode: latest?.mode ?? null,
        latestCreatedAt: latest?.createdAt ?? null,
        latestSummary: latest?.summary ?? null,
        latestExternalSessionId: latest?.externalSessionId ?? null,
        latestResultIndex: latest?.resultIndex ?? null,
        latestContextIndex: latest?.contextIndex ?? null,
        latestBatchId: latest?.batchId ?? null,
        latestFollowupSupported: latest?.resultIndex
          ? Boolean((latest.resultIndex as Record<string, unknown>).followupSupported)
          : undefined,
        aggregateStats: null,
      };
    }),
  );

  const payload = {
    sessions,
    models,
    modeFilter: options.mode ?? 'all',
    projectDir,
    ui: options.json ? 'json' : undefined,
  };

  await renderDashboard(payload);
}

// ─── Command: doctor ──────────────────────────────────────────────────────────

async function runDoctorCommand(options: DoctorOptions): Promise<void> {
  const { commandExists } = await importCore();
  const { renderDoctor, renderSetupWizard } = await importTui();

  const binaries = ['kimi', 'qwen', 'codex', 'opencode', 'claude'];
  const checks = await Promise.all(
    binaries.map(async (binary) => ({
      binary,
      installed: await commandExists(binary),
    })),
  );

  const home = process.env.HOME ?? process.env.USERPROFILE ?? os.homedir();
  const mmbridgeHome = path.join(home, '.mmbridge');
  const claudeAgentsDir = path.join(home, '.claude', 'agents');
  const runtimeAuthModel = process.env.MMBRIDGE_AUTH_MODEL ?? 'claude-sonnet-4-5';

  // Gather session file hints
  const sessionFileHints: Record<string, string> = {};
  for (const tool of ['kimi', 'qwen', 'codex', 'gemini']) {
    const hint = path.join(mmbridgeHome, 'sessions', `${tool}.jsonl`);
    try {
      await fs.access(hint);
      sessionFileHints[tool] = hint;
    } catch {
      sessionFileHints[tool] = `${hint} (not found)`;
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    checks,
    mmbridgeHome,
    claudeAgentsDir,
    runtimeAuthModel,
    sessionFileHints,
  };

  if (options.json) {
    jsonOutput(report);
    return;
  }

  if (options.setup) {
    await renderSetupWizard(report);
  } else {
    await renderDoctor(report);
  }
}

// ─── Command: sync-agents ─────────────────────────────────────────────────────

async function runSyncAgentsCommand(options: SyncAgentsOptions): Promise<void> {
  const { syncClaudeAgents } = await importIntegrations();
  await syncClaudeAgents({ dryRun: options.dryRun ?? false, verbose: options.verbose ?? false });
}

// ─── CLI entry ────────────────────────────────────────────────────────────────

export async function main(): Promise<void> {
  const program = new Command();

  program
    .name('mmbridge')
    .description('Multi-model code review bridge')
    .version('0.1.0');

  // ── review ──
  program
    .command('review')
    .description('Run a code review with the specified AI tool')
    .option('-t, --tool <tool>', 'AI tool to use (kimi|qwen|codex|gemini)', 'kimi')
    .option('-m, --mode <mode>', 'Review mode (review|security|architecture)', 'review')
    .option('--bridge <profile>', 'Bridge aggregation profile')
    .option('--base-ref <ref>', 'Git base ref for diff (default: HEAD~1)')
    .option('--commit <sha>', 'Specific commit to review')
    .option('-p, --project <dir>', 'Project directory (default: cwd)')
    .option('--json', 'Output JSON instead of TUI')
    .action(async (opts: ReviewCommandOptions) => {
      await runReviewCommand(opts);
    });

  // ── followup ──
  program
    .command('followup')
    .description('Send a follow-up prompt to an existing review session')
    .requiredOption('-t, --tool <tool>', 'AI tool that ran the original review')
    .requiredOption('--prompt <text>', 'Follow-up prompt to send')
    .option('--session <id>', 'External session ID (overrides stored session)')
    .option('--latest', 'Use the latest stored session for this tool')
    .option('-p, --project <dir>', 'Project directory (default: cwd)')
    .option('--json', 'Output JSON instead of TUI')
    .action(async (opts: {
      tool: string;
      prompt: string;
      session?: string;
      latest?: boolean;
      project?: string;
      json?: boolean;
    }) => {
      await runFollowupCommand({
        tool: opts.tool,
        prompt: opts.prompt,
        json: opts.json,
        explicitSessionId: opts.session,
        projectDir: opts.project,
        useLatestWhenMissing: opts.latest,
      });
    });

  // ── dashboard ──
  program
    .command('dashboard')
    .description('Open the mmbridge TUI dashboard')
    .option('-m, --mode <mode>', 'Filter sessions by mode')
    .option('-p, --project <dir>', 'Project directory (default: cwd)')
    .option('--json', 'Output JSON instead of TUI')
    .action(async (opts: DashboardOptions) => {
      await runDashboardCommand(opts);
    });

  // ── doctor ──
  program
    .command('doctor')
    .description('Check environment and binary installation')
    .option('--json', 'Output JSON instead of TUI')
    .option('--setup', 'Show the interactive setup wizard')
    .action(async (opts: DoctorOptions) => {
      await runDoctorCommand(opts);
    });

  // ── sync-agents ──
  program
    .command('sync-agents')
    .description('Sync agent definitions to Claude agents directory')
    .option('--dry-run', 'Preview changes without writing files')
    .option('-v, --verbose', 'Verbose output')
    .action(async (opts: SyncAgentsOptions) => {
      await runSyncAgentsCommand(opts);
    });

  await program.parseAsync(process.argv);
}
