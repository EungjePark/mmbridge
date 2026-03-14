import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { colors, toolColor } from '../theme.js';
import { HRule } from '../components/Header.js';

const ADAPTERS = ['kimi', 'qwen', 'codex', 'gemini'] as const;
const SETTINGS = ['classifiers', 'redaction', 'context', 'bridge'] as const;

type Adapter = typeof ADAPTERS[number];
type Setting = typeof SETTINGS[number];

interface AdapterInfo {
  binary: string;
  installed: boolean;
  latency: string | null;
}

const ADAPTER_INFO: Record<Adapter, AdapterInfo> = {
  kimi:   { binary: 'kimi',      installed: true,  latency: '1.2s' },
  qwen:   { binary: 'qwen',      installed: true,  latency: '3.4s' },
  codex:  { binary: 'codex',     installed: false, latency: null },
  gemini: { binary: 'opencode',  installed: true,  latency: '0.8s' },
};

const SETTINGS_VALUES: Record<Setting, Array<{ label: string; value: string }>> = {
  classifiers: [
    { label: 'Severity levels', value: 'critical, warning, info, refactor' },
    { label: 'Custom patterns', value: '(none)' },
  ],
  redaction: [
    { label: 'Redact tokens',   value: 'enabled' },
    { label: 'Redact PII',      value: 'enabled' },
    { label: 'Custom rules',    value: '(none)' },
  ],
  context: [
    { label: 'Max files',       value: '200' },
    { label: 'Context window',  value: '128k' },
    { label: 'Include tests',   value: 'true' },
  ],
  bridge: [
    { label: 'Workspace dir',   value: '/tmp/mmctx-*' },
    { label: 'Auth model',      value: 'claude-sonnet' },
    { label: 'Timeout',         value: '120s' },
  ],
};

type SelectionState =
  | { section: 'adapters'; index: number }
  | { section: 'settings'; index: number };

function KVRow({ label, value, valueColor }: {
  label: string;
  value: string;
  valueColor?: string;
}): React.ReactElement {
  return (
    <Box flexDirection="row">
      <Text color={colors.textMuted}>{label.padEnd(16)}</Text>
      <Text color={valueColor ?? colors.text}>{value}</Text>
    </Box>
  );
}

function AdapterCard({ adapter, isSelected, testing }: {
  adapter: Adapter;
  isSelected: boolean;
  testing: boolean;
}): React.ReactElement {
  const info = ADAPTER_INFO[adapter];
  const installStatus = info.installed ? '\u2713 installed' : '\u2717 missing';
  const installColor = info.installed ? colors.green : colors.red;
  const statusValue = info.installed
    ? (info.latency != null ? `Connected (${info.latency})` : 'Connected')
    : 'Not installed';

  return (
    <Box flexDirection="column" marginBottom={1} paddingLeft={1}>
      <Box flexDirection="row" justifyContent="space-between">
        <Text color={toolColor(adapter)} bold>{adapter}</Text>
        <Text color={installColor}>{installStatus}</Text>
      </Box>
      <Box flexDirection="column" paddingLeft={2} marginTop={0}>
        <KVRow label="Binary" value={info.binary} />
        <KVRow label="Status" value={statusValue} valueColor={info.installed ? colors.green : colors.red} />
        <KVRow label="Args" value="(default)" />
      </Box>
      {isSelected && (
        <Box paddingLeft={2} marginTop={1}>
          {testing ? (
            <Text color={colors.yellow}>Testing connection...</Text>
          ) : (
            <Text bold color={colors.green}>[ \u23CE TEST CONNECTION ]</Text>
          )}
        </Box>
      )}
    </Box>
  );
}

function SettingsPanel({ setting }: { setting: Setting }): React.ReactElement {
  const fields = SETTINGS_VALUES[setting];
  return (
    <Box flexDirection="column" paddingLeft={1}>
      <Text color={colors.textMuted}>SETTINGS \u00B7 {setting}</Text>
      <Box flexDirection="column" paddingLeft={2} marginTop={1}>
        {fields.map((f) => (
          <KVRow key={f.label} label={f.label} value={f.value} />
        ))}
      </Box>
    </Box>
  );
}

export function ConfigView(): React.ReactElement {
  const [selection, setSelection] = useState<SelectionState>({
    section: 'adapters',
    index: 0,
  });
  const [testing, setTesting] = useState(false);

  const currentAdapter: Adapter =
    selection.section === 'adapters'
      ? (ADAPTERS[selection.index] ?? 'kimi')
      : 'kimi';

  const currentSetting: Setting =
    selection.section === 'settings'
      ? (SETTINGS[selection.index] ?? 'classifiers')
      : 'classifiers';

  const handleTest = (): void => {
    if (testing) return;
    setTesting(true);
    setTimeout(() => setTesting(false), 1500);
  };

  useInput((_input, key) => {
    if (key.upArrow || key.downArrow) {
      const dir = key.downArrow ? 1 : -1;
      if (selection.section === 'adapters') {
        const next = Math.max(0, Math.min(ADAPTERS.length - 1, selection.index + dir));
        setSelection({ section: 'adapters', index: next });
      } else {
        const next = Math.max(0, Math.min(SETTINGS.length - 1, selection.index + dir));
        setSelection({ section: 'settings', index: next });
      }
    }
    if (key.tab) {
      if (selection.section === 'adapters') setSelection({ section: 'settings', index: 0 });
      else setSelection({ section: 'adapters', index: 0 });
    }
    if (key.return && selection.section === 'adapters') handleTest();
  });

  return (
    <Box flexDirection="row" width="100%">
      {/* Sidebar */}
      <Box flexDirection="column" width={26} paddingX={1} paddingY={1}>
        <Text color={colors.textMuted}>ADAPTERS</Text>
        <Box flexDirection="column" marginTop={0} marginBottom={1}>
          {ADAPTERS.map((adapter, i) => {
            const info = ADAPTER_INFO[adapter];
            const isSelected = selection.section === 'adapters' && selection.index === i;
            return (
              <Box key={adapter} flexDirection="row" paddingLeft={2}>
                <Text color={isSelected ? colors.green : colors.textMuted}>
                  {isSelected ? '\u25CF' : '\u25CB'}{' '}
                </Text>
                <Text color={toolColor(adapter)}>{adapter}</Text>
                <Text color={info.installed ? colors.green : colors.red}>
                  {'  '}{info.installed ? '\u2713' : '\u2717'}
                </Text>
              </Box>
            );
          })}
        </Box>
        <Text color={colors.textMuted}>SETTINGS</Text>
        <Box flexDirection="column" marginTop={0}>
          {SETTINGS.map((s, i) => {
            const isSelected = selection.section === 'settings' && selection.index === i;
            return (
              <Box key={s} flexDirection="row" paddingLeft={2}>
                <Text color={isSelected ? colors.green : colors.textMuted}>
                  {isSelected ? '\u25CF' : '\u25CB'}{' '}
                </Text>
                <Text color={isSelected ? colors.text : colors.textMuted}>{s}</Text>
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* Main panel */}
      <Box flexDirection="column" flexGrow={1} paddingY={1}>
        <Box flexDirection="column" paddingLeft={1} marginBottom={1}>
          <Text color={colors.textMuted}>Adapters</Text>
        </Box>
        {ADAPTERS.map((adapter, i) => (
          <AdapterCard
            key={adapter}
            adapter={adapter}
            isSelected={selection.section === 'adapters' && selection.index === i}
            testing={selection.section === 'adapters' && selection.index === i && testing}
          />
        ))}
        <HRule />
        <Box marginTop={1}>
          {selection.section === 'settings' && (
            <SettingsPanel setting={currentSetting} />
          )}
          {selection.section === 'adapters' && (
            <Box paddingLeft={1} flexDirection="column">
              <Text color={colors.textMuted}>Settings</Text>
              <Box flexDirection="column" paddingLeft={2} marginTop={1}>
                <KVRow label="Classifiers" value="21 rules (default)" />
                <KVRow label="Redaction" value="9 patterns active" />
                <KVRow label="Context" value="128 KB max" />
                <KVRow label="Bridge" value="standard (threshold: 2)" />
              </Box>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
