import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { colors, toolColor, CHARS, ADAPTER_NAMES } from '../theme.js';
import { ProgressSteps } from '../components/ProgressSteps.js';
import type { StepStatus } from '../components/ProgressSteps.js';
import { useTui, REVIEW_MODES } from '../store.js';

const PROGRESS_BAR_WIDTH = 20;

const PHASE_ORDER = ['context', 'redact', 'review', 'enrich'] as const;
type ReviewPhase = (typeof PHASE_ORDER)[number];

function buildSteps(phase: ReviewPhase | 'bridge' | null): Array<{ label: string; status: StepStatus }> {
  const phaseIndex = phase === 'bridge'
    ? PHASE_ORDER.length // all done in bridge mode
    : phase != null
      ? PHASE_ORDER.indexOf(phase as ReviewPhase)
      : -1;

  return PHASE_ORDER.map((p, i) => ({
    label: p.charAt(0).toUpperCase() + p.slice(1),
    status: i < phaseIndex ? 'done' : i === phaseIndex ? 'active' : 'pending',
  }));
}

function buildProgressBar(steps: Array<{ status: StepStatus }>): string {
  const doneCount = steps.filter((s) => s.status === 'done').length;
  const total = steps.length;
  const activeCount = steps.filter((s) => s.status === 'active').length;

  const filled = Math.round(
    ((doneCount + activeCount * 0.5) / total) * PROGRESS_BAR_WIDTH,
  );
  const empty = PROGRESS_BAR_WIDTH - filled;

  return (
    CHARS.progressFull.repeat(Math.max(0, filled)) +
    CHARS.progressEmpty.repeat(Math.max(0, empty))
  );
}

export function ReviewProgress(): React.ReactElement {
  const [state] = useTui();
  const { review } = state;

  const selectedTool = ADAPTER_NAMES[review.selectedTool] ?? 'kimi';
  const selectedMode = REVIEW_MODES[review.selectedMode] ?? 'review';
  const steps = buildSteps(review.progressPhase);
  const doneCount = steps.filter((s) => s.status === 'done').length;
  const activeCount = steps.filter((s) => s.status === 'active').length;
  const fraction = (doneCount + activeCount * 0.5) / steps.length;
  const progressBar = buildProgressBar(steps);
  const pct = Math.round(fraction * 100);

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1} gap={1} flexGrow={1}>
      {/* Header */}
      <Box flexDirection="row" gap={1}>
        <Text color={colors.yellow} bold>REVIEWING</Text>
        <Text color={toolColor(selectedTool)} bold>{selectedTool}</Text>
        <Text color={colors.textMuted}>/</Text>
        <Text color={colors.text}>{selectedMode}</Text>
      </Box>

      {/* Steps */}
      <ProgressSteps steps={steps} />

      {/* Progress bar */}
      <Box flexDirection="row" gap={2}>
        <Text color={colors.accent}>{progressBar}</Text>
        <Text color={colors.textMuted}>{pct}%</Text>
      </Box>

      {/* Elapsed */}
      {review.elapsed > 0 && (
        <Text color={colors.textMuted}>Elapsed: {review.elapsed.toFixed(1)}s</Text>
      )}

      {/* Current progress message */}
      <Box flexDirection="row" gap={1}>
        <Text color={colors.green}><Spinner type="dots" /></Text>
        <Text color={colors.text}>{review.progress || 'Initializing...'}</Text>
      </Box>

      {/* Bridge tool progress (when in bridge mode) */}
      {Object.keys(state.review.bridgeToolProgress).length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text color={colors.textDim} bold>Tool Progress</Text>
          {Object.entries(state.review.bridgeToolProgress).map(([tool, status]) => {
            const statusIcon = status === 'done' ? CHARS.installed : status === 'error' ? CHARS.missing : status === 'running' ? '⟳' : CHARS.radioOff;
            const statusColor = status === 'done' ? colors.green : status === 'error' ? colors.red : status === 'running' ? colors.yellow : colors.textDim;
            return (
              <Box key={tool} flexDirection="row" gap={1}>
                <Text color={statusColor}>{statusIcon}</Text>
                <Text color={toolColor(tool)}>{tool.padEnd(8)}</Text>
                <Text color={statusColor}>{status}</Text>
              </Box>
            );
          })}
        </Box>
      )}

      {/* Footer */}
      <Text color={colors.textMuted}>Ctrl+C Cancel</Text>
    </Box>
  );
}
