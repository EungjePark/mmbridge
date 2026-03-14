import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { colors, toolColor, severityColor } from '../theme.js';
import { HRule } from '../components/Header.js';

interface Finding {
  severity: string;
  file: string;
  line: number | null;
  message: string;
}

interface SessionItem {
  id: string;
  tool: string;
  mode: string;
  date: string;
  findingCount: number;
  summary: string;
  findings: Finding[];
}

const MOCK_SESSIONS: SessionItem[] = [
  {
    id: 'abc-123',
    tool: 'kimi',
    mode: 'security',
    date: '2026-03-14 15:30',
    findingCount: 5,
    summary: '5 findings across 4 files. Unsafe input handling in API layer.',
    findings: [
      { severity: 'CRITICAL', file: 'src/api.ts',    line: 42,   message: 'Unsafe parse — no try/catch' },
      { severity: 'WARNING',  file: 'src/utils.ts',  line: 18,   message: 'Unvalidated user input passed downstream' },
      { severity: 'WARNING',  file: 'src/config.ts', line: 7,    message: 'Hardcoded secret in config' },
      { severity: 'INFO',     file: 'src/types.ts',  line: 3,    message: 'Consider using branded types' },
      { severity: 'REFACTOR', file: 'src/old.ts',    line: 99,   message: 'Dead code path' },
    ],
  },
  {
    id: 'def-456',
    tool: 'qwen',
    mode: 'review',
    date: '2026-03-13 10:12',
    findingCount: 2,
    summary: '2 findings. Minor naming issues and unused export.',
    findings: [
      { severity: 'INFO',     file: 'src/db.ts',      line: 55,   message: 'Function name does not follow convention' },
      { severity: 'REFACTOR', file: 'src/helpers.ts', line: null, message: 'Unused export' },
    ],
  },
  {
    id: 'ghi-789',
    tool: 'codex',
    mode: 'review',
    date: '2026-03-12 08:44',
    findingCount: 3,
    summary: '3 findings. Error handling gaps in async flows.',
    findings: [
      { severity: 'WARNING', file: 'src/fetch.ts', line: 23, message: 'Unhandled promise rejection' },
      { severity: 'WARNING', file: 'src/fetch.ts', line: 31, message: 'Missing timeout on fetch call' },
      { severity: 'INFO',    file: 'src/cache.ts', line: 10, message: 'Cache TTL is hardcoded' },
    ],
  },
];

const ALL_TOOLS = ['all', 'kimi', 'qwen', 'codex', 'gemini'];
const ALL_MODES = ['all', 'review', 'security', 'followup'];

function FilterRow({ label, options, selected, onSelect }: {
  label: string;
  options: string[];
  selected: string;
  onSelect: (v: string) => void;
}): React.ReactElement {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color={colors.textMuted}>{label}</Text>
      <Box flexDirection="column">
        {options.map((opt) => (
          <Box key={opt} flexDirection="row" paddingLeft={2}>
            <Text color={opt === selected ? colors.green : colors.textMuted}>
              {opt === selected ? '\u25CF' : '\u25CB'}{' '}
            </Text>
            <Text color={opt === selected ? colors.text : colors.textMuted}>{opt}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function SessionRow({ session, isSelected }: {
  session: SessionItem;
  isSelected: boolean;
}): React.ReactElement {
  const dateShort = session.date.slice(5, 10); // MM-DD
  const timeShort = session.date.slice(11, 16); // HH:MM
  const findLabel = `${session.findingCount} finding${session.findingCount !== 1 ? 's' : ''}`;
  return (
    <Box flexDirection="row" paddingLeft={1} marginBottom={0}>
      <Text color={isSelected ? colors.green : colors.textMuted}>
        {isSelected ? '\u25CF' : ' '}{' '}
      </Text>
      <Text color={isSelected ? colors.text : colors.textMuted}>
        {`${dateShort} ${timeShort}  `}
      </Text>
      <Text color={toolColor(session.tool)}>{session.tool.padEnd(6)}</Text>
      <Text color={colors.textMuted}>{session.mode.padEnd(9)}</Text>
      <Text color={session.findingCount > 0 ? colors.yellow : colors.textMuted}>{findLabel}</Text>
    </Box>
  );
}

function FindingRow({ finding }: { finding: Finding }): React.ReactElement {
  const loc = finding.line !== null
    ? `${finding.file}:${finding.line}`
    : finding.file;
  return (
    <Box flexDirection="row" paddingLeft={2} marginBottom={0}>
      <Text bold color={severityColor(finding.severity)}>
        {finding.severity.padEnd(10)}
      </Text>
      <Text color={colors.textMuted}>{loc}</Text>
      <Text color={colors.textDim}>{' \u2014 '}</Text>
      <Text color={colors.text}>{finding.message}</Text>
    </Box>
  );
}

function SessionDetail({ session }: { session: SessionItem }): React.ReactElement {
  return (
    <Box flexDirection="column" paddingLeft={1}>
      <Box flexDirection="row" justifyContent="space-between">
        <Text color={toolColor(session.tool)} bold>Session: {session.id}</Text>
        <Text color={colors.textMuted}>{session.date}</Text>
      </Box>
      <Box flexDirection="column" paddingLeft={2} marginTop={1}>
        <Box flexDirection="row">
          <Text color={colors.textMuted}>{'Tool       '}</Text>
          <Text color={toolColor(session.tool)}>{session.tool}</Text>
        </Box>
        <Box flexDirection="row">
          <Text color={colors.textMuted}>{'Mode       '}</Text>
          <Text color={colors.text}>{session.mode}</Text>
        </Box>
        <Box flexDirection="row">
          <Text color={colors.textMuted}>{'Files      '}</Text>
          <Text color={colors.text}>{session.findingCount} changed</Text>
        </Box>
        <Box flexDirection="row">
          <Text color={colors.textMuted}>{'Base       '}</Text>
          <Text color={colors.text}>origin/main</Text>
        </Box>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Box paddingLeft={2}>
          <Text color={colors.textMuted}>
            Findings ({session.findings.length})
          </Text>
        </Box>
        <Box flexDirection="column" marginTop={0}>
          {session.findings.map((f, i) => <FindingRow key={i} finding={f} />)}
        </Box>
      </Box>
    </Box>
  );
}

export function SessionsView(): React.ReactElement {
  const [toolFilter, setToolFilter] = useState('all');
  const [modeFilter, setModeFilter] = useState('all');
  const [selectedId, setSelectedId] = useState<string>(MOCK_SESSIONS[0]?.id ?? '');

  const filtered = MOCK_SESSIONS.filter((s) => {
    const toolMatch = toolFilter === 'all' || s.tool === toolFilter;
    const modeMatch = modeFilter === 'all' || s.mode === modeFilter;
    return toolMatch && modeMatch;
  });

  const selected = filtered.find((s) => s.id === selectedId) ?? filtered[0] ?? null;

  React.useEffect(() => {
    if (filtered.length > 0 && !filtered.find((s) => s.id === selectedId)) {
      setSelectedId(filtered[0]!.id);
    }
  }, [toolFilter, modeFilter, filtered, selectedId]);

  return (
    <Box flexDirection="row" width="100%">
      {/* Sidebar */}
      <Box flexDirection="column" width={26} paddingX={1} paddingY={1}>
        <FilterRow
          label="TOOL"
          options={ALL_TOOLS}
          selected={toolFilter}
          onSelect={setToolFilter}
        />
        <FilterRow
          label="MODE"
          options={ALL_MODES}
          selected={modeFilter}
          onSelect={setModeFilter}
        />
        <Box marginTop={1} flexDirection="column">
          <Text color={colors.textMuted}>HISTORY</Text>
          <Box flexDirection="column" marginTop={0}>
            {filtered.length === 0 && (
              <Box paddingLeft={2}>
                <Text color={colors.textDim}>No sessions</Text>
              </Box>
            )}
            {filtered.map((s) => (
              <SessionRow
                key={s.id}
                session={s}
                isSelected={s.id === (selected?.id ?? '')}
              />
            ))}
          </Box>
        </Box>
      </Box>

      {/* Main panel */}
      <Box flexDirection="column" flexGrow={1} paddingY={1}>
        {selected === null ? (
          <Box paddingLeft={1}>
            <Text color={colors.textMuted}>No session selected.</Text>
          </Box>
        ) : (
          <>
            <SessionDetail session={selected} />
            <HRule />
          </>
        )}
      </Box>
    </Box>
  );
}
