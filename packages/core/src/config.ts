import fs from 'node:fs/promises';
import path from 'node:path';
import type { MmbridgeConfig, FileClassifierRule } from './types.js';

const CONFIG_FILENAMES = ['.mmbridge.config.json', 'mmbridge.config.json'];

export const DEFAULT_CLASSIFIERS: FileClassifierRule[] = [
  { pattern: 'src/api/', category: 'API' },
  { pattern: 'src/routes/', category: 'Routes' },
  { pattern: 'api/', category: 'API' },
  { pattern: 'routes/', category: 'Routes' },
  { pattern: 'src/components/', category: 'Component' },
  { pattern: 'components/', category: 'Component' },
  { pattern: 'src/lib/', category: 'Library' },
  { pattern: 'lib/', category: 'Library' },
  { pattern: 'src/hooks/', category: 'Hook' },
  { pattern: 'hooks/', category: 'Hook' },
  { pattern: 'src/stores/', category: 'State' },
  { pattern: 'stores/', category: 'State' },
  { pattern: 'src/utils/', category: 'Utility' },
  { pattern: 'utils/', category: 'Utility' },
  { pattern: 'test/', category: 'Test' },
  { pattern: 'tests/', category: 'Test' },
  { pattern: '__tests__/', category: 'Test' },
  { pattern: 'spec/', category: 'Test' },
  { pattern: '.github/', category: 'CI/CD' },
  { pattern: 'scripts/', category: 'Script' },
  { pattern: 'docs/', category: 'Documentation' },
];

export async function loadConfig(projectDir: string): Promise<MmbridgeConfig> {
  for (const filename of CONFIG_FILENAMES) {
    const configPath = path.join(projectDir, filename);
    try {
      const raw = await fs.readFile(configPath, 'utf8');
      return JSON.parse(raw) as MmbridgeConfig;
    } catch {
      continue;
    }
  }
  return {};
}

export function resolveClassifiers(config: MmbridgeConfig): FileClassifierRule[] {
  if (!config.classifiers) return DEFAULT_CLASSIFIERS;
  if (config.extendDefaultClassifiers !== false) {
    return [...config.classifiers, ...DEFAULT_CLASSIFIERS];
  }
  return config.classifiers;
}

export function classifyFileWithRules(filePath: string, rules: FileClassifierRule[]): string {
  for (const rule of rules) {
    if (filePath.startsWith(rule.pattern)) {
      return rule.category;
    }
  }
  return 'Other';
}
