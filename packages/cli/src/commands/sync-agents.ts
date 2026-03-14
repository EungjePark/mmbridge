import { importIntegrations } from './helpers.js';

export interface SyncAgentsOptions {
  dryRun?: boolean;
}

export async function runSyncAgentsCommand(options: SyncAgentsOptions): Promise<void> {
  const { syncClaudeAgents } = await importIntegrations();
  await syncClaudeAgents({ dryRun: options.dryRun ?? false });
}
