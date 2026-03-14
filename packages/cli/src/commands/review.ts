import {
  resolveProjectDir,
  jsonOutput,
  exitWithError,
  importCore,
  importAdapters,
  importSessionStore,
  importTui,
} from './helpers.js';

export interface ReviewCommandOptions {
  tool?: string;
  mode?: string;
  bridge?: string;
  baseRef?: string;
  commit?: string;
  project?: string;
  json?: boolean;
  export?: string;
}

export async function runReviewCommand(options: ReviewCommandOptions): Promise<void> {
  const projectDir = resolveProjectDir(options.project);
  const mode = options.mode ?? 'review';

  const {
    buildContextIndex,
    buildProjectContext,
    buildResultIndex,
    commandExists,
    createContext,
    enrichFindings,
    runBridge,
  } = await importCore();

  const { defaultRegistry, runReviewAdapter } = await importAdapters();
  const { SessionStore } = await importSessionStore();
  const { renderReviewConsole } = await importTui();

  const tool = options.tool ?? 'kimi';
  const adapter = defaultRegistry.get(tool);
  if (!adapter) {
    exitWithError(`Unknown tool: ${tool}. Available: ${defaultRegistry.list().join(', ')}`);
  }
  const isInstalled = await commandExists(adapter.binary);
  if (!isInstalled) {
    exitWithError(
      `Binary "${adapter.binary}" not found in PATH. Install it to use the "${tool}" adapter.`,
    );
  }

  const workspace = await createContext({
    projectDir,
    mode,
    baseRef: options.baseRef,
    commit: options.commit,
  });

  const contextIndex = buildContextIndex({
    workspace: workspace.workspace,
    projectDir: workspace.projectDir,
    mode: workspace.mode,
    baseRef: workspace.baseRef,
    head: workspace.head,
    changedFiles: workspace.changedFiles,
    copiedFileCount: workspace.copiedFileCount,
    redaction: workspace.redaction,
  });

  const adapterResult = await runReviewAdapter(tool, {
    workspace: workspace.workspace,
    cwd: projectDir,
    mode,
    baseRef: options.baseRef,
    commit: options.commit,
    changedFiles: workspace.changedFiles,
    sessionId: workspace.workspace,
  });

  const enriched = enrichFindings([], workspace.changedFiles);

  const resultIndex = buildResultIndex({
    summary: adapterResult.text,
    findings: enriched.findings,
    filteredCount: enriched.filteredCount,
    promotedCount: enriched.promotedCount,
    followupSupported: adapterResult.followupSupported,
    rawOutput: adapterResult.text,
    parseState: 'raw',
  });

  const sessionStore = new SessionStore(projectDir);
  const savedSession = await sessionStore.save({
    tool,
    mode,
    projectDir,
    workspace: workspace.workspace,
    externalSessionId: adapterResult.externalSessionId,
    batchId: null,
    summary: adapterResult.text,
    findings: enriched.findings as unknown as Array<Record<string, unknown>>,
    contextIndex: contextIndex as unknown as Record<string, unknown>,
    resultIndex: resultIndex as unknown as Record<string, unknown>,
  });

  if (options.bridge) {
    const projectContext = await buildProjectContext({ projectDir });
    runBridge({
      profile: options.bridge,
      projectContext,
      results: [
        {
          tool,
          findings: enriched.findings,
          summary: adapterResult.text,
        },
      ],
    });
  }

  const report = {
    localSessionId: savedSession.id,
    externalSessionId: adapterResult.externalSessionId ?? undefined,
    workspace: workspace.workspace,
    summary: adapterResult.text,
    findings: enriched.findings,
    resultIndex,
    changedFiles: workspace.changedFiles.length,
    copiedFiles: workspace.copiedFileCount,
    followupSupported: adapterResult.followupSupported,
  };

  if (options.export) {
    const { exportReport } = await import('./export.js');
    await exportReport(report, options.export);
  }

  if (options.json) {
    jsonOutput(report);
    return;
  }

  await renderReviewConsole(report as unknown as Parameters<typeof renderReviewConsole>[0]);
}
