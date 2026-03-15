import React from 'react';
import { Text } from 'ink';
import { severityColor, colors } from '../theme.js';

type BadgeSeverity = 'CRITICAL' | 'WARNING' | 'INFO' | 'REFACTOR' | string;
type BadgeVariant = 'pill' | 'tag' | 'inline';

interface BadgeProps {
  severity: BadgeSeverity;
  variant?: BadgeVariant;
}

export function Badge({ severity, variant = 'pill' }: BadgeProps): React.ReactElement {
  const label = severity.toUpperCase();
  const color = severityColor(label);

  if (variant === 'tag') {
    return <Text color={color}>{`[${label}]`}</Text>;
  }

  if (variant === 'inline') {
    return <Text color={color}>{label}</Text>;
  }

  // pill (default): inverse rendering with colored background
  return (
    <Text color={colors.crust} backgroundColor={color} bold>
      {` ${label} `}
    </Text>
  );
}
