import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../theme.js';

interface PanelProps {
  title: string;
  width?: number | string;
  flexGrow?: number;
  borderColor?: string;
  children: React.ReactNode;
}

export function Panel({
  title,
  width,
  flexGrow,
  borderColor = colors.surface0,
  children,
}: PanelProps): React.ReactElement {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={borderColor}
      width={flexGrow !== undefined ? undefined : width}
      flexGrow={flexGrow}
      paddingX={1}
    >
      <Text color={colors.subtext0} bold>
        {title}
      </Text>
      {children}
    </Box>
  );
}
