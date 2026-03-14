import {
  resolveProjectDir,
  importCore,
  importAdapters,
  importSessionStore,
  importTui,
} from './helpers.js';

export interface DashboardOptions {
  mode?: string;
  project?: string;
  json?: boolean;
}

export async function runDashboardCommand(options: DashboardOptions): Promise<void> {
  const projectDir = resolveProjectDir(options.project);

  const { commandExists } = await importCore();
  const { defaultRegistry } = await importAdapters();
  const { SessionStore } = await importSessionStore();
  const { renderDashboard } = await importTui();

  const sessionStore = new SessionStore(projectDir);
  const sessions = await sessionStore.list({ projectDir });

  const toolNames = defaultRegistry.list();
  const models = await Promise.all(
    toolNames.map(async (tool) => {
      const binary = defaultRegistry.get(tool)?.binary ?? tool;
      const installed = await commandExists(binary);
      const toolSessions = sessions.filter((s: { tool: string }) => s.tool === tool);
      const latest = toolSessions[0] ?? null;
      return {
        tool,
        binary,
        installed,
        totalSessions: toolSessions.length,
        latestMode: latest?.mode ?? null,
        latestCreatedAt: latest?.createdAt ?? null,
        latestSummary: latest?.summary ?? null,
        latestExternalSessionId: latest?.externalSessionId ?? null,
        latestResultIndex: latest?.resultIndex ?? null,
        latestContextIndex: latest?.contextIndex ?? null,
        latestBatchId: latest?.batchId ?? null,
        latestFollowupSupported: latest?.resultIndex
          ? Boolean((latest.resultIndex as Record<string, unknown>).followupSupported)
          : undefined,
        aggregateStats: null,
      };
    }),
  );

  const payload = {
    sessions,
    models,
    modeFilter: options.mode ?? 'all',
    projectDir,
    ui: options.json ? 'json' : undefined,
  };

  await renderDashboard(payload);
}
