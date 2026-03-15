import { enrichFindings, sortFindings } from './report.js';
import type { BridgeOptions, BridgeResult, Finding, InterpretResult } from './types.js';

const DEFAULT_PROFILE = 'standard';

const CONSENSUS_THRESHOLD: Record<string, number> = {
  standard: 2,
  strict: 1,
  relaxed: 3,
};

export async function runBridge(options: BridgeOptions = {}): Promise<BridgeResult> {
  const profile = options.profile ?? DEFAULT_PROFILE;
  const results = options.results ?? [];

  const nonSkipped = results.filter((r) => !r.skipped);
  const totalInputs = nonSkipped.length;

  if (totalInputs === 0) {
    return {
      profile,
      totalInputs: 0,
      consensusFindings: 0,
      counts: {},
      findings: [],
      summary: 'No inputs to bridge.',
      interpretation: undefined,
    };
  }

  const threshold = CONSENSUS_THRESHOLD[profile] ?? 2;

  // Aggregate findings by dedup key across all inputs
  const findingMap = new Map<string, { finding: Finding; count: number; sources: string[] }>();

  for (const result of nonSkipped) {
    const tool = result.tool;
    for (const finding of result.findings ?? []) {
      const key = `${finding.severity}:${finding.file}:${finding.line ?? ''}:${finding.message}`;
      const existing = findingMap.get(key);
      if (existing) {
        existing.count++;
        existing.sources.push(tool);
      } else {
        findingMap.set(key, {
          finding: { ...finding, sources: [tool] },
          count: 1,
          sources: [tool],
        });
      }
    }
  }

  // Apply consensus filter
  const consensusFindings: Finding[] = [];
  const counts: Record<string, number> = {};

  for (const { finding, count, sources } of findingMap.values()) {
    counts[finding.severity] = (counts[finding.severity] ?? 0) + 1;
    if (count >= threshold || finding.severity === 'CRITICAL') {
      consensusFindings.push({ ...finding, sources });
    }
  }

  const { findings: enriched, filteredCount, promotedCount } = enrichFindings(consensusFindings, []);
  const sorted = sortFindings(enriched);

  const critCount = sorted.filter((f) => f.severity === 'CRITICAL').length;
  const warnCount = sorted.filter((f) => f.severity === 'WARNING').length;

  const summary = [
    `Bridge (${profile}): ${sorted.length} consensus finding(s) from ${totalInputs} input(s)`,
    critCount > 0 ? `${critCount} CRITICAL` : '',
    warnCount > 0 ? `${warnCount} WARNING` : '',
    filteredCount > 0 ? `${filteredCount} out-of-scope filtered` : '',
    promotedCount > 0 ? `${promotedCount} promoted` : '',
  ]
    .filter(Boolean)
    .join(', ');

  let interpretation: InterpretResult | undefined;
  if (options.interpret && sorted.length > 0) {
    try {
      const { interpretFindings } = await import('./interpret.js');
      interpretation = await interpretFindings({
        mergedFindings: sorted,
        changedFiles: options.changedFiles ?? [],
        projectContext: '',
        workspace: options.workspace ?? '',
      });
    } catch {
      // Interpretation failure is non-critical
    }
  }

  return {
    profile,
    totalInputs,
    consensusFindings: sorted.length,
    counts,
    findings: sorted,
    summary,
    interpretation,
  };
}

export function mergeBridgeFindings(findings: Finding[]): Finding[] {
  const seen = new Set<string>();
  return findings.filter((f) => {
    const key = `${f.severity}:${f.file}:${f.line ?? ''}:${f.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
