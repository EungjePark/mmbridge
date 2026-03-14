import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import { colors, toolColor, severityColor } from '../theme.js';
import { HRule } from '../components/Header.js';

const TOOLS = ['kimi', 'qwen', 'codex', 'gemini'] as const;
const MODES = ['review', 'security', 'architecture'] as const;

type Tool = typeof TOOLS[number];
type Mode = typeof MODES[number];
type ReviewState = 'setup' | 'running' | 'complete';

interface Finding {
  severity?: string;
  file?: string;
  line?: number;
  message?: string;
}

// Mock data — replace with real runner output
const MOCK_FINDINGS: Finding[] = [
  { severity: 'WARNING', file: 'src/index.ts', line: 42, message: 'Unhandled promise rejection' },
  { severity: 'INFO',    file: 'src/theme.ts',  line: 5,  message: 'Consider extracting color tokens' },
];

// Key-value row with fixed-width dim label
function KVRow({ label, value, valueColor }: {
  label: string;
  value: string;
  valueColor?: string;
}): React.ReactElement {
  return (
    <Box flexDirection="row" marginBottom={0}>
      <Text color={colors.textMuted}>{label.padEnd(11)}</Text>
      <Text color={valueColor ?? colors.text}>{value}</Text>
    </Box>
  );
}

// Tool card — colored name header + kv details
function ToolCard({ tool, checked }: { tool: Tool; checked: boolean }): React.ReactElement {
  const statusLabel = checked ? '\u2713 selected' : '';
  const statusColor = checked ? colors.green : colors.textMuted;
  const sessions = 0;

  return (
    <Box flexDirection="column" marginBottom={1} paddingLeft={1}>
      <Box flexDirection="row" justifyContent="space-between">
        <Text color={toolColor(tool)} bold>{tool}</Text>
        <Text color={statusColor}>{statusLabel}</Text>
      </Box>
      <Box flexDirection="column" paddingLeft={2} marginTop={0}>
        <KVRow label="Binary" value={tool} />
        <KVRow label="Sessions" value={String(sessions)} />
        <KVRow label="Status" value="Ready" valueColor={colors.green} />
      </Box>
    </Box>
  );
}

function ModeSelector({ selectedMode, onSelect }: {
  selectedMode: number;
  onSelect: (idx: number) => void;
}): React.ReactElement {
  return (
    <Box flexDirection="column" marginBottom={1} paddingLeft={1}>
      <Text color={colors.textMuted}>MODE</Text>
      <Box flexDirection="column" paddingLeft={2} marginTop={0}>
        {MODES.map((m, i) => {
          const isSelected = i === selectedMode;
          return (
            <Box key={m} flexDirection="row">
              <Text color={isSelected ? colors.green : colors.textMuted}>
                {isSelected ? '\u25CF' : '\u25CB'}{' '}
              </Text>
              <Text color={isSelected ? colors.text : colors.textMuted}>{m}</Text>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

function SetupPanel({ selectedTools, selectedMode }: {
  selectedTools: Set<Tool>;
  selectedMode: Mode;
}): React.ReactElement {
  const toolList = [...selectedTools].join(', ') || '(none)';
  return (
    <Box flexDirection="column">
      {/* Tool cards */}
      {TOOLS.map((t) => (
        <ToolCard key={t} tool={t} checked={selectedTools.has(t)} />
      ))}
      <HRule />
      <Box flexDirection="column" paddingLeft={1} marginTop={1}>
        <Text color={colors.textMuted}>Review Setup</Text>
        <Box flexDirection="column" paddingLeft={2} marginTop={0}>
          <KVRow label="Tools" value={toolList} />
          <KVRow label="Mode" value={selectedMode} />
          <KVRow label="Base ref" value="HEAD~1" />
          <KVRow label="Files" value="scanning..." />
        </Box>
        <Box justifyContent="center" marginTop={1}>
          <Text bold color={colors.green}>[ \u23CE START REVIEW ]</Text>
        </Box>
      </Box>
    </Box>
  );
}

function RunningPanel({ tool }: { tool: string }): React.ReactElement {
  return (
    <Box flexDirection="column" paddingLeft={1} marginTop={1}>
      <Box flexDirection="row" gap={1}>
        <Text color={colors.green}><Spinner type="dots" /></Text>
        <Text color={colors.text}>Running </Text>
        <Text bold color={toolColor(tool)}>{tool}</Text>
        <Text color={colors.textMuted}>...</Text>
      </Box>
      <Box marginTop={1}>
        <Text color={colors.textMuted}>This may take a minute.</Text>
      </Box>
    </Box>
  );
}

function FindingRow({ finding }: { finding: Finding }): React.ReactElement {
  const sev = (finding.severity ?? 'INFO').toUpperCase();
  const col = severityColor(sev);
  const loc = finding.file
    ? `${finding.file}${finding.line != null ? `:${finding.line}` : ''}`
    : '';
  return (
    <Box flexDirection="row" paddingLeft={2} marginBottom={0}>
      <Text bold color={col}>{sev.padEnd(10)}</Text>
      {loc !== '' && <Text color={colors.textMuted}>{loc}  </Text>}
      <Text color={colors.text}>{finding.message ?? ''}</Text>
    </Box>
  );
}

function ResultsPanel({ findings }: { findings: Finding[] }): React.ReactElement {
  return (
    <Box flexDirection="column" paddingLeft={1}>
      <Box flexDirection="row" justifyContent="space-between">
        <Text bold color={colors.green}>Review Complete</Text>
        <Text color={colors.textMuted}>
          {findings.length} finding{findings.length !== 1 ? 's' : ''}
        </Text>
      </Box>
      <Box flexDirection="column" marginTop={1}>
        {findings.map((f, i) => <FindingRow key={i} finding={f} />)}
        {findings.length === 0 && (
          <Box paddingLeft={2}>
            <Text color={colors.textMuted}>No findings \u2014 all clear.</Text>
          </Box>
        )}
      </Box>
      <Box marginTop={1}>
        <Text color={colors.textMuted}>e export  f follow-up  d details</Text>
      </Box>
    </Box>
  );
}

export function ReviewView(): React.ReactElement {
  const [selectedTools, setSelectedTools] = useState<Set<Tool>>(
    new Set<Tool>(['kimi', 'qwen']),
  );
  const [selectedMode, setSelectedMode] = useState(0);
  const [reviewState, setReviewState] = useState<ReviewState>('setup');
  const [runningTool, setRunningTool] = useState('');
  const [findings, setFindings] = useState<Finding[]>([]);

  const startReview = (): void => {
    const tools = [...selectedTools];
    if (tools.length === 0) return;
    setRunningTool(tools[0] ?? 'kimi');
    setReviewState('running');
    setTimeout(() => {
      setFindings(MOCK_FINDINGS);
      setReviewState('complete');
    }, 2500);
  };

  const toggleTool = (tool: Tool): void => {
    setSelectedTools((prev) => {
      const next = new Set(prev);
      if (next.has(tool)) next.delete(tool);
      else next.add(tool);
      return next;
    });
  };

  useInput((input, key) => {
    if (reviewState === 'setup' && key.return) startReview();
    if (reviewState === 'setup') {
      const toolIdx = TOOLS.findIndex((t) => t[0] === input);
      if (toolIdx >= 0) toggleTool(TOOLS[toolIdx] as Tool);
      const modeIdx = MODES.findIndex((m) => m[0] === input);
      if (modeIdx >= 0) setSelectedMode(modeIdx);
    }
  });

  const currentMode = MODES[selectedMode] ?? 'review';

  return (
    <Box flexDirection="row" width="100%">
      {/* Sidebar */}
      <Box flexDirection="column" width={26} paddingX={1} paddingY={1}>
        <Text color={colors.textMuted}>MODELS</Text>
        <Box flexDirection="column" marginTop={0} marginBottom={1}>
          {TOOLS.map((tool) => {
            const checked = selectedTools.has(tool);
            return (
              <Box key={tool} flexDirection="row" paddingLeft={2}>
                <Text color={checked ? colors.green : colors.textMuted}>
                  {checked ? '\u25CF' : '\u25CB'}{' '}
                </Text>
                <Text color={toolColor(tool)}>{tool}</Text>
                <Text color={checked ? colors.green : colors.textMuted}>
                  {'  '}{checked ? '\u2713' : ''}
                </Text>
              </Box>
            );
          })}
        </Box>
        <ModeSelector selectedMode={selectedMode} onSelect={setSelectedMode} />
      </Box>

      {/* Main panel */}
      <Box flexDirection="column" flexGrow={1} paddingY={1}>
        {reviewState === 'setup' && (
          <SetupPanel selectedTools={selectedTools} selectedMode={currentMode} />
        )}
        {reviewState === 'running' && <RunningPanel tool={runningTool} />}
        {reviewState === 'complete' && <ResultsPanel findings={findings} />}
      </Box>
    </Box>
  );
}
