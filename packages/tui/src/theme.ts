// Design tokens — Kaku-inspired minimal TUI theme
export const colors = {
  bg: '#0F172A',
  surface: '#1E293B',
  border: '#334155',        // used only for dim horizontal rules
  text: '#F8FAFC',
  textMuted: '#64748B',
  textDim: '#475569',
  green: '#22C55E',
  yellow: '#EAB308',
  red: '#EF4444',
  cyan: '#06B6D4',
  blue: '#3B82F6',
  purple: '#A855F7',
  orange: '#F97316',
  pink: '#EC4899',
} as const;

// Each adapter gets its own unique color
export const toolColors: Record<string, string> = {
  kimi: colors.green,
  qwen: colors.purple,
  codex: colors.blue,
  gemini: colors.cyan,
};

export function toolColor(name: string): string {
  return toolColors[name.toLowerCase()] ?? colors.text;
}

export function severityColor(severity: string): string {
  switch (severity.toUpperCase()) {
    case 'CRITICAL': return colors.red;
    case 'WARNING':  return colors.yellow;
    case 'INFO':     return colors.cyan;
    case 'REFACTOR': return colors.textDim;
    default:         return colors.text;
  }
}
