import React from 'react';
import { Box, Text } from 'ink';

interface MiniBarItem {
  label: string;
  value: number;
  color: string;
}

interface MiniBarProps {
  items: MiniBarItem[];
  width?: number;
}

export function MiniBar({ items, width = 20 }: MiniBarProps): React.ReactElement {
  const total = items.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return (
      <Box flexDirection="row">
        <Text dimColor>{'░'.repeat(width)}</Text>
      </Box>
    );
  }

  const segments = items.map((item) => ({
    ...item,
    chars: Math.max(item.value > 0 ? 1 : 0, Math.round((item.value / total) * width)),
  }));

  // Clamp total chars to width
  let allocated = segments.reduce((s, seg) => s + seg.chars, 0);
  while (allocated > width) {
    const largest = segments.reduce((a, b) => (a.chars >= b.chars ? a : b));
    largest.chars -= 1;
    allocated -= 1;
  }

  return (
    <Box flexDirection="row">
      {segments.map((seg, i) =>
        seg.chars > 0 ? (
          <Text key={i} color={seg.color}>
            {'█'.repeat(seg.chars)}
          </Text>
        ) : null,
      )}
    </Box>
  );
}
