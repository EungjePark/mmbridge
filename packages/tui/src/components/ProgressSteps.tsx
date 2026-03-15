import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { colors } from '../theme.js';

export type StepStatus = 'done' | 'active' | 'pending';

interface Step {
  label: string;
  status: StepStatus;
}

interface ProgressStepsProps {
  steps: Step[];
}

function StepIndicator({ status }: { status: StepStatus }): React.ReactElement {
  if (status === 'done') {
    return <Text color={colors.green}>✓</Text>;
  }
  if (status === 'active') {
    return (
      <Text color={colors.yellow}>
        <Spinner type="dots" />
      </Text>
    );
  }
  return <Text color={colors.overlay0}>○</Text>;
}

export function ProgressSteps({ steps }: ProgressStepsProps): React.ReactElement {
  return (
    <Box flexDirection="row" gap={1}>
      {steps.map((step, i) => (
        <Box key={step.label} flexDirection="row" gap={1}>
          {i > 0 && <Text color={colors.overlay0}>│</Text>}
          <Text color={step.status === 'pending' ? colors.overlay0 : colors.text}>
            {step.label}
          </Text>
          <StepIndicator status={step.status} />
        </Box>
      ))}
    </Box>
  );
}
