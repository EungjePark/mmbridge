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
    orchestrateReview,
    runBridge,
  } = await importCore();

  const { defaultRegistry, runReviewAdapter } = await importAdapters();
  const { SessionStore } = await importSessionStore();
  const { renderReviewConsole } = await importTui();

  const tool = options.tool ?? 'kimi';

  if (tool === 'all') {
    const installedTools = await defaultRegistry.listInstalled();

    if (installedTools.length === 0) {
      exitWithError('No tools are installed. Run `mmbridge doctor` to check.');
    }

    const workspace = await createContext({
      projectDir,
      mode,
      baseRef: options.baseRef,
      commit: options.commit,
    });

    const orchResult = await orchestrateReview({
      tools: installedTools,
      workspace: workspace.workspace,
      mode,
      baseRef: options.baseRef,
      changedFiles: workspace.changedFiles,
      runAdapter: (tool, opts) => runReviewAdapter(tool, opts),
    });

    const bridgeProfile = options.bridge ?? 'standard';
    const isInterpreted = bridgeProfile === 'interpreted';

    const bridgeResult = await runBridge({
      profile: isInterpreted ? 'standard' : bridgeProfile,
      interpret: isInterpreted,
      workspace: workspace.workspace,
      changedFiles: workspace.changedFiles,
      results: orchResult.results.map((r) => ({
        tool: r.tool,
        findings: r.findings,
        summary: r.summary,
        skipped: r.skipped,
      })),
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

    const resultIndex = buildResultIndex({
      summary: bridgeResult.summary,
      findings: bridgeResult.findings,
      bridgeSummary: bridgeResult.summary,
    });

    const sessionStore = new SessionStore(projectDir);
    const savedSession = await sessionStore.save({
      tool: 'bridge',
      mode,
      projectDir,
      workspace: workspace.workspace,
      externalSessionId: null,
      batchId: null,
      summary: bridgeResult.summary,
      findings: bridgeResult.findings,
      contextIndex,
      resultIndex,
    });

    const allReport = {
      localSessionId: savedSession.id,
      workspace: workspace.workspace,
      summary: bridgeResult.summary,
      findings: bridgeResult.findings,
      resultIndex,
      changedFiles: workspace.changedFiles.length,
      copiedFiles: workspace.copiedFileCount,
      toolResults: orchResult.results.map((r) => ({
        tool: r.tool,
        findingCount: r.findings.length,
        skipped: r.skipped,
        error: r.error,
      })),
      interpretation: bridgeResult.interpretation,
    };

    if (options.export) {
      const { exportReport } = await import('./export.js');
      await exportReport(allReport, options.export);
    }

    if (options.json) {
      jsonOutput(allReport);
      return;
    }

    await renderReviewConsole(allReport);
    return;
  }

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

  const { parseFindings } = await importCore();
  const rawFindings = parseFindings(adapterResult.text);
  const enriched = enrichFindings(rawFindings, workspace.changedFiles);

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
    findings: enriched.findings,
    contextIndex,
    resultIndex,
  });

  if (options.bridge) {
    const projectContext = await buildProjectContext({ projectDir });
    await runBridge({
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

  await renderReviewConsole(report);
}
