import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../theme.js';

type TabId = 'review' | 'config' | 'sessions' | 'diff';

const TAB_LABELS: Record<TabId, string> = {
  review: 'review',
  config: 'config',
  sessions: 'sessions',
  diff: 'diff',
};

interface HeaderProps {
  activeTab: TabId;
}

// Dim horizontal rule — used as section separator throughout the TUI
export function HRule(): React.ReactElement {
  return (
    <Box paddingX={1}>
      <Text color={colors.border}>{'─'.repeat(80)}</Text>
    </Box>
  );
}

export function Header({ activeTab }: HeaderProps): React.ReactElement {
  const statusDot = '\u25CF'; // ●

  return (
    <Box flexDirection="column">
      <Box paddingX={1} paddingY={0} flexDirection="row" justifyContent="space-between">
        <Box flexDirection="row" gap={1}>
          <Text color={colors.green} bold>mmbridge</Text>
          <Text color={colors.textMuted}>{'\u00B7'}</Text>
          <Text color={colors.green}>{statusDot}</Text>
          <Text color={colors.textMuted}>Ready</Text>
          <Text color={colors.textMuted}>{'\u00B7'}</Text>
          <Text color={colors.text}>{TAB_LABELS[activeTab]} mode</Text>
        </Box>
        <Text color={colors.textMuted}>v0.2.0</Text>
      </Box>
      <HRule />
    </Box>
  );
}
