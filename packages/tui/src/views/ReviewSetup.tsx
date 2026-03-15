import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import {
  createContext,
  cleanupContext,
  enrichFindings,
  parseFindings,
  getDefaultBaseRef,
  buildContextIndex,
  buildResultIndex,
  getChangedFiles,
  classifyFile,
} from '@mmbridge/core';
import { runReviewAdapter } from '@mmbridge/adapters';
import { SessionStore } from '@mmbridge/session-store';
import { colors, toolColor, ADAPTER_NAMES, CHARS } from '../theme.js';
import { Panel } from '../components/Panel.js';
import { MiniBar } from '../components/MiniBar.js';
import { useTui, REVIEW_MODES } from '../store.js';
import type { FindingItem } from '../store.js';

const CATEGORY_COLORS: Record<string, string> = {
  'API':        colors.blue,
  'Component':  colors.mauve,
  'Library':    colors.teal,
  'Config':     colors.peach,
  'Test':       colors.green,
  'Migration':  colors.yellow,
  'Script':     colors.sapphire,
  'Other':      colors.overlay2,
};

function categoryColor(cat: string): string {
  return CATEGORY_COLORS[cat] ?? colors.overlay2;
}

export function ReviewSetup(): React.ReactElement {
  const [state, dispatch] = useTui();
  const { review, adapters } = state;
  const [fileCount, setFileCount] = useState<number | null>(null);
  const [categories, setCategories] = useState<Record<string, number>>({});

  const selectedTool = ADAPTER_NAMES[review.selectedTool] ?? 'kimi';
  const selectedMode = REVIEW_MODES[review.selectedMode] ?? 'review';
  const adapterInfo = adapters.find((a) => a.name === selectedTool);
  const isInstalled = adapterInfo?.installed ?? false;

  React.useEffect(() => {
    const load = async (): Promise<void> => {
      try {
        const base = await getDefaultBaseRef();
        const files = await getChangedFiles(base);
        setFileCount(files.length);

        const cats: Record<string, number> = {};
        for (const f of files) {
          const cat = classifyFile(f);
          cats[cat] = (cats[cat] ?? 0) + 1;
        }
        setCategories(cats);
      } catch {
        setFileCount(null);
        setCategories({});
      }
    };
    load();
  }, []);

  const startReview = useCallback(async (): Promise<void> => {
    if (review.running) return;
    if (!review.bridgeMode && !isInstalled) return;

    dispatch({ type: 'REVIEW_START' });
    const startTime = Date.now();

    try {
      // Bridge mode: run all installed tools in parallel
      if (review.bridgeMode) {
        const installedToolNames = adapters.filter((a) => a.installed).map((a) => a.name);
        if (installedToolNames.length === 0) {
          dispatch({ type: 'SHOW_TOAST', message: 'No tools installed', toastType: 'error' });
          dispatch({ type: 'REVIEW_COMPLETE', result: null });
          return;
        }

        const { orchestrateReview, runBridge } = await import('@mmbridge/core');
        const { runReviewAdapter: runAdapter } = await import('@mmbridge/adapters');

        dispatch({ type: 'REVIEW_PROGRESS', progress: 'Preparing context...', elapsed: 0, phase: 'context' });
        const workspace = await createContext({
          projectDir: process.cwd(),
          mode: selectedMode,
        });

        const orchResult = await orchestrateReview({
          tools: installedToolNames,
          workspace: workspace.workspace,
          mode: selectedMode,
          baseRef: workspace.baseRef,
          changedFiles: workspace.changedFiles,
          runAdapter: (tool: string, opts: { workspace: string; cwd: string; mode: string; baseRef?: string; changedFiles: string[] }) => runAdapter(tool, opts),
          onToolProgress: (tool: string, status: string) => {
            const toolStatus = status === 'start' ? 'running' : status === 'done' ? 'done' : 'error';
            dispatch({ type: 'REVIEW_BRIDGE_TOOL_PROGRESS', tool, status: toolStatus as 'pending' | 'running' | 'done' | 'error' });
            const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
            dispatch({ type: 'REVIEW_PROGRESS', progress: `${tool}: ${status}`, elapsed: Number(elapsedSec), phase: 'review' });
          },
        });

        const bridgeResult = await runBridge({
          profile: 'standard',
          interpret: true,
          workspace: workspace.workspace,
          changedFiles: workspace.changedFiles,
          results: orchResult.results.map((r) => ({
            tool: r.tool,
            findings: r.findings,
            summary: r.summary,
            skipped: r.skipped,
          })),
        });

        const bridgeFindings: FindingItem[] = (bridgeResult.findings as Array<{ severity: string; file: string; line?: number | null; message: string }>).map((f) => ({
          severity: f.severity,
          file: f.file,
          line: f.line ?? null,
          message: f.message,
        }));

        dispatch({
          type: 'REVIEW_COMPLETE',
          result: {
            summary: bridgeResult.summary as string,
            findings: bridgeFindings,
          },
        });

        dispatch({
          type: 'SHOW_TOAST',
          message: `Bridge complete: ${bridgeFindings.length} consensus findings`,
          toastType: bridgeFindings.some((f) => f.severity === 'CRITICAL') ? 'error' : 'success',
        });

        await cleanupContext(workspace.workspace).catch(() => {});
        return;
      }

      // Step 1: Create context
      dispatch({ type: 'REVIEW_PROGRESS', progress: 'Preparing context...', elapsed: 0, phase: 'context' });
      const workspace = await createContext({
        projectDir: process.cwd(),
        mode: selectedMode,
      });

      const elapsedCtx = ((Date.now() - startTime) / 1000).toFixed(1);
      dispatch({
        type: 'REVIEW_PROGRESS',
        progress: `${workspace.copiedFileCount} files copied, ${workspace.redaction?.changedFiles ?? 0} files redacted (${elapsedCtx}s)`,
        elapsed: Number(elapsedCtx),
        phase: 'redact',
      });

      // Step 2: Run adapter
      dispatch({
        type: 'REVIEW_PROGRESS',
        progress: `Waiting for ${selectedTool} response...`,
        elapsed: Number(elapsedCtx),
        phase: 'review',
      });

      const adapterResult = await runReviewAdapter(selectedTool, {
        workspace: workspace.workspace,
        cwd: process.cwd(),
        mode: selectedMode,
        baseRef: workspace.baseRef,
        changedFiles: workspace.changedFiles,
      });

      // Step 3: Parse and enrich findings
      const rawFindings = parseFindings(adapterResult.text);
      const enriched = enrichFindings(rawFindings, workspace.changedFiles);

      const findings: FindingItem[] = enriched.findings.map((f) => ({
        severity: f.severity,
        file: f.file,
        line: f.line ?? null,
        message: f.message,
      }));

      const summary =
        enriched.summary ??
        `${findings.length} finding${findings.length !== 1 ? 's' : ''} across changed files`;

      // Step 4: Save session
      try {
        const sessionStore = new SessionStore();
        await sessionStore.save({
          tool: selectedTool,
          mode: selectedMode,
          projectDir: process.cwd(),
          workspace: workspace.workspace,
          baseRef: workspace.baseRef,
          head: workspace.head,
          rawOutput: adapterResult.text,
          summary,
          findings: enriched.findings,
          externalSessionId: adapterResult.externalSessionId,
          followupSupported: adapterResult.followupSupported,
          contextIndex: buildContextIndex({
            workspace: workspace.workspace,
            projectDir: process.cwd(),
            mode: workspace.mode,
            baseRef: workspace.baseRef,
            head: workspace.head,
            changedFiles: workspace.changedFiles,
            copiedFileCount: workspace.copiedFileCount,
            redaction: workspace.redaction,
          }),
          resultIndex: buildResultIndex({
            summary,
            findings: rawFindings,
            parseState: 'structured',
          }),
          status: 'complete',
        });
      } catch {
        // Session save failure is non-critical
      }

      dispatch({
        type: 'REVIEW_COMPLETE',
        result: { summary, findings },
      });

      dispatch({
        type: 'SHOW_TOAST',
        message: `Review complete: ${findings.length} finding${findings.length !== 1 ? 's' : ''}`,
        toastType: findings.some((f) => f.severity === 'CRITICAL') ? 'error' : 'success',
      });

      await cleanupContext(workspace.workspace).catch(() => {});
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      dispatch({
        type: 'REVIEW_COMPLETE',
        result: { summary: `Error: ${message}`, findings: [] },
      });
      dispatch({
        type: 'SHOW_TOAST',
        message: `Review failed: ${message.slice(0, 60)}`,
        toastType: 'error',
      });
    }
  }, [dispatch, adapters, isInstalled, review.bridgeMode, review.running, selectedMode, selectedTool]);

  useInput((input, key) => {
    // Column switching
    if (input === 'h' || key.leftArrow) {
      dispatch({ type: 'REVIEW_SET_FOCUS_COLUMN', column: 'tool' });
    }
    if (input === 'l' || key.rightArrow) {
      dispatch({ type: 'REVIEW_SET_FOCUS_COLUMN', column: 'mode' });
    }

    // Selection within column
    if (input === 'j' || key.downArrow) {
      if (review.focusColumn === 'tool') {
        const next = Math.min(ADAPTER_NAMES.length - 1, review.selectedTool + 1);
        dispatch({ type: 'REVIEW_SET_TOOL', index: next });
      } else {
        const next = Math.min(REVIEW_MODES.length - 1, review.selectedMode + 1);
        dispatch({ type: 'REVIEW_SET_MODE', index: next });
      }
    }
    if (input === 'k' || key.upArrow) {
      if (review.focusColumn === 'tool') {
        const next = Math.max(0, review.selectedTool - 1);
        dispatch({ type: 'REVIEW_SET_TOOL', index: next });
      } else {
        const next = Math.max(0, review.selectedMode - 1);
        dispatch({ type: 'REVIEW_SET_MODE', index: next });
      }
    }

    // Bridge mode toggle
    if (input === 'b') {
      dispatch({ type: 'REVIEW_TOGGLE_BRIDGE' });
    }

    // Start review
    if (key.return) {
      startReview();
    }
  });

  const miniBarItems = Object.entries(categories).map(([cat, count]) => ({
    label: cat,
    value: count,
    color: categoryColor(cat),
  }));

  const focusTool = review.focusColumn === 'tool';
  const focusMode = review.focusColumn === 'mode';

  return (
    <Box flexDirection="row" width="100%" paddingY={1} gap={1}>
      {/* Tool column */}
      <Panel title="SELECT TOOL" width={22} borderColor={focusTool ? colors.accent : colors.surface0}>
        <Box flexDirection="column" marginTop={1}>
          {ADAPTER_NAMES.map((tool, i) => {
            const isSelected = i === review.selectedTool;
            const adapter = adapters.find((a) => a.name === tool);
            const installed = adapter?.installed ?? false;
            const isCursor = isSelected && focusTool;
            return (
              <Box key={tool} flexDirection="row" gap={1}>
                <Text color={isCursor ? colors.accent : colors.textDim}>
                  {isCursor ? CHARS.selected : ' '}
                </Text>
                <Text color={isSelected ? colors.green : colors.textDim}>
                  {isSelected ? CHARS.radioOn : CHARS.radioOff}
                </Text>
                <Text
                  color={installed ? toolColor(tool) : colors.textDim}
                  bold={isSelected}
                  strikethrough={!installed}
                >
                  {tool.padEnd(8)}
                </Text>
                <Text color={installed ? colors.green : colors.red}>
                  {installed ? CHARS.installed : CHARS.missing}
                </Text>
              </Box>
            );
          })}
        </Box>
      </Panel>

      {/* Mode column */}
      <Panel title="SELECT MODE" width={22} borderColor={focusMode ? colors.accent : colors.surface0}>
        <Box flexDirection="column" marginTop={1}>
          {REVIEW_MODES.map((mode, i) => {
            const isSelected = i === review.selectedMode;
            const isCursor = isSelected && focusMode;
            return (
              <Box key={mode} flexDirection="row" gap={1}>
                <Text color={isCursor ? colors.accent : colors.textDim}>
                  {isCursor ? CHARS.selected : ' '}
                </Text>
                <Text color={isSelected ? colors.green : colors.textDim}>
                  {isSelected ? CHARS.radioOn : CHARS.radioOff}
                </Text>
                <Text color={isSelected ? colors.text : colors.textMuted} bold={isSelected}>
                  {mode}
                </Text>
              </Box>
            );
          })}
        </Box>
      </Panel>

      {/* Context preview column */}
      <Panel title="CONTEXT PREVIEW" flexGrow={1} borderColor={colors.surface0}>
        <Box flexDirection="column" marginTop={1}>
          <Text color={colors.text}>
            {fileCount !== null ? `${fileCount} files changed` : 'scanning...'}
          </Text>
          {miniBarItems.length > 0 && (
            <Box flexDirection="column" marginTop={1} gap={0}>
              {miniBarItems.slice(0, 6).map((item) => (
                <Box key={item.label} flexDirection="row" gap={1}>
                  <Text color={colors.textMuted}>{item.label.padEnd(14)}</Text>
                  <MiniBar items={[item]} width={8} />
                  <Text color={item.color}>{item.value}</Text>
                </Box>
              ))}
            </Box>
          )}
          <Box marginTop={1} flexDirection="column" gap={0}>
            <Box flexDirection="row" gap={1}>
              <Text color={review.bridgeMode ? colors.green : colors.textDim}>
                {review.bridgeMode ? CHARS.radioOn : CHARS.radioOff}
              </Text>
              <Text color={review.bridgeMode ? colors.accent : colors.textMuted}>
                Bridge Mode {review.bridgeMode ? 'ON' : 'OFF'}
              </Text>
            </Box>
            {review.bridgeMode || isInstalled ? (
              <Text bold color={colors.green}>Enter START  |  b Bridge</Text>
            ) : (
              <Text color={colors.red}>Tool not installed</Text>
            )}
          </Box>
        </Box>
      </Panel>
    </Box>
  );
}
