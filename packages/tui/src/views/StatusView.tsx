import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { colors, CHARS, toolColor } from '../theme.js';
import { Panel } from '../components/Panel.js';
import { Sparkline } from '../components/Sparkline.js';
import { SeverityBar } from '../components/SeverityBar.js';
import { KVRow } from '../components/KVRow.js';
import { useTui } from '../store.js';
import { computeSessionStats } from '../hooks/session-analytics.js';
import { formatRelativeTime } from '../utils/format.js';
import type { AdapterStatus } from '../store.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortenPath(p: string): string {
  const home = process.env['HOME'] ?? '';
  if (home && p.startsWith(home)) return '~' + p.slice(home.length);
  return p;
}

/** dailyCounts[0]=today … [6]=6d ago → reverse so oldest is left */
function reversedCounts(counts: number[]): number[] {
  return [...counts].reverse();
}

function avgPerDay(counts: number[]): string {
  if (counts.length === 0) return '0.0';
  const total = counts.reduce((a, b) => a + b, 0);
  return (total / counts.length).toFixed(1);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface AdapterRowProps {
  adapter: AdapterStatus;
  toolDailyCounts: number[];
}

function AdapterRow({ adapter, toolDailyCounts }: AdapterRowProps): React.ReactElement {
  const icon = adapter.installed ? CHARS.installed : CHARS.missing;
  const iconColor = adapter.installed ? colors.green : colors.red;
  const sessText = adapter.installed ? String(adapter.sessionCount) : '-';
  const lastText = adapter.lastSessionDate ? formatRelativeTime(adapter.lastSessionDate) : '-';

  return (
    <Box flexDirection="row" gap={1}>
      <Text color={iconColor}>{icon}</Text>
      <Text color={toolColor(adapter.name)} bold>{adapter.name.padEnd(7)}</Text>
      <Text color={colors.textMuted}>{sessText.padStart(3)} sess</Text>
      <Box marginX={1}>
        {adapter.installed && toolDailyCounts.some((c) => c > 0) ? (
          <Sparkline data={toolDailyCounts} color={toolColor(adapter.name)} width={6} />
        ) : (
          <Text color={colors.textDim}>{'  -   '}</Text>
        )}
      </Box>
      <Text color={colors.textDim}>{lastText}</Text>
    </Box>
  );
}

// ─── Panels ───────────────────────────────────────────────────────────────────

interface AdaptersPanelProps {
  adapters: AdapterStatus[];
  toolDistribution: Record<string, number>;
  sessionDailyCounts: number[];
}

function AdaptersPanel({ adapters, toolDistribution, sessionDailyCounts }: AdaptersPanelProps): React.ReactElement {
  const totalSessions = Object.values(toolDistribution).reduce((a, b) => a + b, 0);

  return (
    <Panel title="ADAPTERS" flexGrow={1}>
      <Box flexDirection="column" marginTop={1} gap={0}>
        {adapters.map((adapter) => {
          const toolShare = toolDistribution[adapter.name] ?? 0;
          const ratio = totalSessions > 0 ? toolShare / totalSessions : 0;
          const toolDailyCounts = sessionDailyCounts.map((c) => Math.round(c * ratio));

          return (
            <AdapterRow
              key={adapter.name}
              adapter={adapter}
              toolDailyCounts={reversedCounts(toolDailyCounts)}
            />
          );
        })}
        {adapters.length === 0 && (
          <Text color={colors.textDim}>No adapters configured</Text>
        )}
      </Box>
    </Panel>
  );
}

interface ProjectPanelProps {
  projectInfo: import('../store.js').ProjectInfo | null;
}

function ProjectPanel({ projectInfo }: ProjectPanelProps): React.ReactElement {
  return (
    <Panel title="PROJECT" flexGrow={1}>
      <Box flexDirection="column" marginTop={1}>
        {projectInfo ? (
          <>
            <KVRow
              label="Path"
              value={shortenPath(projectInfo.path)}
            />
            <KVRow
              label="Branch"
              value={`${projectInfo.branch} (${projectInfo.head.slice(0, 7)})`}
            />
            <KVRow
              label="Dirty"
              value={`${projectInfo.dirtyCount} files`}
              valueColor={projectInfo.dirtyCount > 0 ? colors.yellow : colors.green}
            />
            <KVRow
              label="Base"
              value={projectInfo.baseRef}
            />
          </>
        ) : (
          <Text color={colors.textDim}>Not a git repository</Text>
        )}
      </Box>
    </Panel>
  );
}

interface ActivityPanelProps {
  dailyCounts: number[];
  aggregateSeverity: { critical: number; warning: number; info: number; refactor: number };
}

function ActivityPanel({ dailyCounts, aggregateSeverity }: ActivityPanelProps): React.ReactElement {
  const reversed = reversedCounts(dailyCounts);
  const avg = avgPerDay(dailyCounts);
  const total = dailyCounts.reduce((a, b) => a + b, 0);

  return (
    <Panel title="ACTIVITY (7 days)" flexGrow={1}>
      <Box flexDirection="column" marginTop={1} gap={1}>
        <Box flexDirection="row" gap={2}>
          <Sparkline data={reversed} color={colors.accent} width={7} />
          <Text color={colors.textMuted}>avg {avg}/day</Text>
          <Text color={colors.textDim}>({total} total)</Text>
        </Box>
        {total > 0 ? (
          <SeverityBar counts={aggregateSeverity} />
        ) : (
          <Text color={colors.textDim}>No sessions in last 7 days</Text>
        )}
      </Box>
    </Panel>
  );
}

interface LastReviewPanelProps {
  lastReview: import('../store.js').LastReview | null;
}

function LastReviewPanel({ lastReview }: LastReviewPanelProps): React.ReactElement {
  return (
    <Panel title="LAST REVIEW" flexGrow={1}>
      <Box flexDirection="column" marginTop={1}>
        {lastReview ? (
          <>
            <Box flexDirection="row" gap={1}>
              <Text color={toolColor(lastReview.tool)} bold>{lastReview.tool}</Text>
              <Text color={colors.textDim}>/</Text>
              <Text color={colors.textMuted}>{lastReview.mode}</Text>
              <Text color={colors.textDim}>/</Text>
              <Text color={colors.textDim}>{formatRelativeTime(lastReview.date)}</Text>
            </Box>
            <Box marginTop={1}>
              <SeverityBar counts={lastReview.findingCounts} />
            </Box>
            <Box marginTop={1}>
              <Text color={colors.textDim}>
                {lastReview.summary.length > 50
                  ? lastReview.summary.slice(0, 50) + '…'
                  : lastReview.summary}
              </Text>
            </Box>
          </>
        ) : (
          <Text color={colors.textDim}>No reviews yet</Text>
        )}
      </Box>
    </Panel>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function StatusView(): React.ReactElement {
  const [state] = useTui();
  const { adapters, adaptersLoading, projectInfo, lastReview, sessions } = state;

  const stats = useMemo(() => computeSessionStats(sessions), [sessions]);

  if (adaptersLoading) {
    return (
      <Box paddingX={2} paddingY={1}>
        <Text color={colors.green}><Spinner type="dots" /></Text>
        <Text color={colors.textMuted}> Loading adapter status...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width="100%" flexGrow={1} paddingX={1} gap={1}>
      {/* Row 1: Adapters + Project */}
      <Box flexDirection="row" gap={1}>
        <AdaptersPanel
          adapters={adapters}
          toolDistribution={stats.toolDistribution}
          sessionDailyCounts={stats.dailyCounts}
        />
        <ProjectPanel projectInfo={projectInfo} />
      </Box>

      {/* Row 2: Activity + Last Review */}
      <Box flexDirection="row" gap={1}>
        <ActivityPanel
          dailyCounts={stats.dailyCounts}
          aggregateSeverity={stats.aggregateSeverity}
        />
        <LastReviewPanel lastReview={lastReview} />
      </Box>
    </Box>
  );
}
