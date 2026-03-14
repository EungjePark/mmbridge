import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { colors } from '../theme.js';
import { HRule } from './Header.js';

interface ToastInfo {
  message: string;
  type: 'success' | 'error' | 'info';
  at: number;
}

interface StatusBarProps {
  toast?: ToastInfo | null;
  hints?: string;
}

const DEFAULT_HINTS = '\u21B9 Navigate \u2502 \u23CE Select \u2502 1-4 Tabs \u2502 ? Help \u2502 q Quit';
const TOAST_DURATION_MS = 3000;

function toastColor(type: ToastInfo['type']): string {
  switch (type) {
    case 'success': return colors.green;
    case 'error':   return colors.red;
    case 'info':    return colors.cyan;
  }
}

export function StatusBar({ toast, hints = DEFAULT_HINTS }: StatusBarProps): React.ReactElement {
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    if (!toast) {
      setShowToast(false);
      return;
    }
    setShowToast(true);
    const elapsed = Date.now() - toast.at;
    const remaining = TOAST_DURATION_MS - elapsed;
    if (remaining <= 0) {
      setShowToast(false);
      return;
    }
    const timer = setTimeout(() => setShowToast(false), remaining);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <Box flexDirection="column">
      <HRule />
      <Box paddingX={1} paddingY={0}>
        {showToast && toast ? (
          <Text color={toastColor(toast.type)} bold>{toast.message}</Text>
        ) : (
          <Text color={colors.textMuted}>{hints}</Text>
        )}
      </Box>
    </Box>
  );
}
