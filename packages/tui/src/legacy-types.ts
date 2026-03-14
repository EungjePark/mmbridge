// ─── Legacy domain interfaces (preserved for backward compatibility) ──────────

export interface DoctorReport {
  generatedAt: string;
  checks: Array<{ binary: string; installed: boolean }>;
  mmbridgeHome: string;
  claudeAgentsDir: string;
  runtimeAuthModel: string;
  sessionFileHints: Record<string, string>;
}

export interface ReviewReport {
  localSessionId?: string;
  externalSessionId?: string;
  workspace?: string;
  summary?: string;
  findings?: Array<{ severity?: string; file?: string; line?: number; message?: string }>;
  resultIndex?: Record<string, unknown>;
  changedFiles?: string | number;
  copiedFiles?: string | number;
  followupSupported?: boolean;
}
