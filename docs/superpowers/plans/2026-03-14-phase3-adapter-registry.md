# Phase 3: Adapter Registry — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded switch-case adapter dispatch with a registry that supports built-in and third-party adapters.

**Architecture:** AdapterRegistry manages AdapterDefinition objects. Built-in adapters register at import time. Third-party adapters load dynamically from config. CLI discovers available adapters from the registry instead of a hardcoded map.

**Tech Stack:** TypeScript, node:test, pnpm workspace

---

## Approach Comparison

### Current State

```
CLI (TOOL_BINARY_MAP hardcoded) → index.ts (switch-case) → runXxxReview/Followup functions
```

- `AdapterDefinition` interface exists but NO adapter implements it
- Each adapter exports standalone functions (`runKimiReview`, `runKimiFollowup`)
- CLI has its own `TOOL_BINARY_MAP` duplicating adapter knowledge
- Adding a new adapter requires: modify index.ts switch + modify CLI map

### Approach A: Class-based (BaseAdapter + Inheritance)

**Pattern:**
```typescript
// base-adapter.ts
export abstract class BaseAdapter implements AdapterDefinition {
  abstract name: string;
  abstract binary: string;

  protected async ensureBinary(): Promise<void> { /* shared */ }
  protected async invoke(args: string[], opts?: RunCommandOptions): Promise<RunResult> { /* shared */ }
  protected assertResultOk(result: RunResult): void { /* shared */ }

  abstract review(options: ReviewOptions): Promise<AdapterResult>;
  abstract followup(options: FollowupOptions): Promise<AdapterResult>;
}

// kimi.ts
export class KimiAdapter extends BaseAdapter {
  name = 'kimi';
  binary = 'kimi';
  async review(options: ReviewOptions): Promise<AdapterResult> { /* ... */ }
  async followup(options: FollowupOptions): Promise<AdapterResult> { /* ... */ }
}
```

**File changes:**
| Action | File | LOC delta |
|--------|------|-----------|
| Create | `adapters/src/base-adapter.ts` | +60 |
| Create | `adapters/src/registry.ts` | +80 |
| **Rewrite** | `adapters/src/kimi.ts` | ~0 |
| **Rewrite** | `adapters/src/qwen.ts` | ~0 |
| **Rewrite** | `adapters/src/codex.ts` | -20 |
| **Rewrite** | `adapters/src/gemini.ts` | -10 |
| Modify | `adapters/src/index.ts` | -17 |
| Modify | `adapters/src/utils.ts` | -30 (moved to base) |
| Modify | `cli/src/index.ts` | -10 |
| Modify | `create-adapter/src/index.ts` | ~0 |
| Create | `adapters/test/registry.test.ts` | +60 |
| **Total** | **11 files, 4 full rewrites** | **+113 net** |

### Approach B+C: Function-based + Dynamic Loading (Recommended)

**Pattern:**
```typescript
// kimi.ts — add adapter object wrapping existing functions (NO rewrite)
export const kimiAdapter: AdapterDefinition = {
  name: 'kimi',
  binary: 'kimi',
  review: (options) => runKimiReview(options),
  followup: (options) => runKimiFollowup(options),
};

// registry.ts
export class AdapterRegistry {
  private adapters = new Map<string, AdapterDefinition>();

  register(adapter: AdapterDefinition): void { this.adapters.set(adapter.name, adapter); }
  get(name: string): AdapterDefinition | undefined { return this.adapters.get(name); }
  has(name: string): boolean { return this.adapters.has(name); }
  list(): string[] { return [...this.adapters.keys()]; }

  async loadFromConfig(config: MmbridgeConfig): Promise<void> {
    for (const [name, cfg] of Object.entries(config.adapters ?? {})) {
      if (cfg.module && !this.has(name)) {
        const mod = await import(cfg.module);
        const adapter = mod.default ?? mod.adapter;
        if (adapter?.review && adapter?.followup) this.register(adapter);
      }
    }
  }
}

// index.ts — replace switch with registry lookup
const registry = createDefaultRegistry();
export function runReviewAdapter(tool: string, options: ReviewOptions) {
  const adapter = registry.get(tool);
  if (!adapter) throw new Error(`Unknown adapter: ${tool}`);
  return adapter.review(options);
}
```

**File changes:**
| Action | File | LOC delta |
|--------|------|-----------|
| Create | `adapters/src/registry.ts` | +70 |
| Modify | `adapters/src/kimi.ts` | +7 |
| Modify | `adapters/src/qwen.ts` | +7 |
| Modify | `adapters/src/codex.ts` | +7 |
| Modify | `adapters/src/gemini.ts` | +7 |
| Modify | `adapters/src/index.ts` | -10 |
| Modify | `cli/src/index.ts` | -15 |
| Modify | `core/src/types.ts` | +5 |
| Modify | `create-adapter/src/index.ts` | +3 |
| Create | `adapters/test/registry.test.ts` | +50 |
| **Total** | **10 files, 0 rewrites** | **+131 net** |

### Head-to-Head

| Dimension | A (Class) | B+C (Function) |
|-----------|-----------|----------------|
| Files changed | 11 (4 rewrites) | 10 (0 rewrites) |
| Regression risk | **High** — 4 adapter rewrites | **Low** — additive only |
| Code style alignment | Low (introduces OOP into functional codebase) | **High** (keeps existing style) |
| Common logic reuse | Base class methods | utils.ts (already exists) |
| Third-party adapter DX | `extends BaseAdapter` | Implement `AdapterDefinition` interface |
| Testing | Must mock base class | Functions directly testable |
| Dynamic loading | Same | Same |
| `create-adapter` template | Class extending BaseAdapter | Object implementing AdapterDefinition |
| Backward compat | Breaking (function exports gone) | **Non-breaking** (old functions still exist) |

### Verdict: **B+C wins**

1. **Zero rewrites** = dramatically lower regression risk
2. **Consistent** with existing functional codebase style
3. `AdapterDefinition` interface already designed and used by `create-adapter`
4. Common logic (ensureBinary, invoke, assertResultOk) already in `utils.ts` after security fixes
5. **Non-breaking** — existing function exports remain, registry is additive
6. BaseAdapter's only unique value (shared methods) is already solved by utils

---

## Implementation Plan (Approach B+C)

### Task 1: Create AdapterRegistry class

**Files:**
- Create: `packages/adapters/src/registry.ts`
- Create: `packages/adapters/test/registry.test.ts`

- [ ] **Step 1: Write failing tests for AdapterRegistry**

```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { AdapterRegistry } from '../src/registry.js';
import type { AdapterDefinition, ReviewOptions, FollowupOptions, AdapterResult } from '../src/types.js';

function createMockAdapter(name: string): AdapterDefinition {
  return {
    name,
    binary: name,
    async review(_options: ReviewOptions): Promise<AdapterResult> {
      return { tool: name, text: 'mock', ok: true, code: 0, stdout: '', stderr: '', combined: '', args: [], command: name, externalSessionId: null, followupSupported: false };
    },
    async followup(_options: FollowupOptions): Promise<AdapterResult> {
      return { tool: name, text: 'mock', ok: true, code: 0, stdout: '', stderr: '', combined: '', args: [], command: name, externalSessionId: null, followupSupported: false };
    },
  };
}

test('register and retrieve adapter', () => {
  const registry = new AdapterRegistry();
  const adapter = createMockAdapter('test-tool');
  registry.register(adapter);
  assert.equal(registry.has('test-tool'), true);
  assert.equal(registry.get('test-tool'), adapter);
});

test('list returns registered adapter names', () => {
  const registry = new AdapterRegistry();
  registry.register(createMockAdapter('a'));
  registry.register(createMockAdapter('b'));
  assert.deepEqual(registry.list().sort(), ['a', 'b']);
});

test('get returns undefined for unknown adapter', () => {
  const registry = new AdapterRegistry();
  assert.equal(registry.get('nonexistent'), undefined);
});

test('has returns false for unknown adapter', () => {
  const registry = new AdapterRegistry();
  assert.equal(registry.has('nonexistent'), false);
});

test('register overwrites existing adapter', () => {
  const registry = new AdapterRegistry();
  const first = createMockAdapter('tool');
  const second = createMockAdapter('tool');
  registry.register(first);
  registry.register(second);
  assert.equal(registry.get('tool'), second);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/adapters && node --import tsx --test test/registry.test.ts`
Expected: FAIL — `Cannot find module '../src/registry.js'`

- [ ] **Step 3: Implement AdapterRegistry**

```typescript
// packages/adapters/src/registry.ts
import type { AdapterDefinition, ReviewOptions, FollowupOptions, AdapterResult } from './types.js';
import type { MmbridgeConfig } from '@mmbridge/core';

export class AdapterRegistry {
  private readonly adapters = new Map<string, AdapterDefinition>();

  register(adapter: AdapterDefinition): void {
    this.adapters.set(adapter.name, adapter);
  }

  get(name: string): AdapterDefinition | undefined {
    return this.adapters.get(name);
  }

  has(name: string): boolean {
    return this.adapters.has(name);
  }

  list(): string[] {
    return [...this.adapters.keys()];
  }

  async loadFromConfig(config: MmbridgeConfig): Promise<void> {
    const adapterConfigs = config.adapters ?? {};
    for (const [name, cfg] of Object.entries(adapterConfigs)) {
      if (this.has(name)) continue;
      const modulePath = (cfg as Record<string, unknown>).module;
      if (typeof modulePath !== 'string') continue;
      try {
        const mod: Record<string, unknown> = await import(modulePath);
        const adapter = (mod.default ?? mod.adapter) as AdapterDefinition | undefined;
        if (adapter?.name && typeof adapter.review === 'function' && typeof adapter.followup === 'function') {
          this.register(adapter);
        }
      } catch {
        // skip adapters that fail to load — non-fatal
      }
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/adapters && node --import tsx --test test/registry.test.ts`
Expected: PASS (5/5)

- [ ] **Step 5: Commit**

```bash
git add packages/adapters/src/registry.ts packages/adapters/test/registry.test.ts
git commit -m "feat: add AdapterRegistry with register, get, list, loadFromConfig"
```

---

### Task 2: Export AdapterDefinition objects from each built-in adapter

**Files:**
- Modify: `packages/adapters/src/kimi.ts` (add export)
- Modify: `packages/adapters/src/qwen.ts` (add export)
- Modify: `packages/adapters/src/codex.ts` (add export)
- Modify: `packages/adapters/src/gemini.ts` (add export)

- [ ] **Step 1: Add adapter object exports to each adapter file**

Append to end of each file:

```typescript
// kimi.ts — append
export const kimiAdapter: AdapterDefinition = {
  name: 'kimi',
  binary: 'kimi',
  review: (options) => runKimiReview(options),
  followup: (options) => runKimiFollowup(options),
};
```

```typescript
// qwen.ts — append
export const qwenAdapter: AdapterDefinition = {
  name: 'qwen',
  binary: 'qwen',
  review: (options) => runQwenReview(options),
  followup: (options) => runQwenFollowup(options),
};
```

```typescript
// codex.ts — append
export const codexAdapter: AdapterDefinition = {
  name: 'codex',
  binary: 'codex',
  review: (options) => runCodexReview(options),
  followup: (options) => runCodexFollowup(options),
};
```

```typescript
// gemini.ts — append
export const geminiAdapter: AdapterDefinition = {
  name: 'gemini',
  binary: 'opencode',
  review: (options) => runGeminiReview({ workspace: options.workspace, changedFiles: options.changedFiles ?? [] }),
  followup: (options) => runGeminiFollowup(options),
};
```

Each file needs `import type { AdapterDefinition } from './types.js';` if not already present.

- [ ] **Step 2: Build to verify no type errors**

Run: `cd ~/project/mmbridge && pnpm run build`
Expected: 7/7 PASS

- [ ] **Step 3: Commit**

```bash
git add packages/adapters/src/kimi.ts packages/adapters/src/qwen.ts packages/adapters/src/codex.ts packages/adapters/src/gemini.ts
git commit -m "feat: export AdapterDefinition objects from all built-in adapters"
```

---

### Task 3: Replace switch-case dispatch with registry in index.ts

**Files:**
- Modify: `packages/adapters/src/index.ts`

- [ ] **Step 1: Rewrite index.ts to use registry**

```typescript
// packages/adapters/src/index.ts
import { kimiAdapter } from './kimi.js';
import { qwenAdapter } from './qwen.js';
import { codexAdapter } from './codex.js';
import { geminiAdapter } from './gemini.js';
import { AdapterRegistry } from './registry.js';
import type { ReviewOptions, FollowupOptions, AdapterResult } from './types.js';

export type { ReviewOptions, FollowupOptions, AdapterResult } from './types.js';
export type { AdapterDefinition } from './types.js';
export { AdapterRegistry } from './registry.js';

const defaultRegistry = new AdapterRegistry();
defaultRegistry.register(kimiAdapter);
defaultRegistry.register(qwenAdapter);
defaultRegistry.register(codexAdapter);
defaultRegistry.register(geminiAdapter);

export { defaultRegistry };

export async function runReviewAdapter(
  tool: string,
  options: ReviewOptions,
): Promise<AdapterResult> {
  const adapter = defaultRegistry.get(tool);
  if (!adapter) throw new Error(`Unsupported tool: ${tool}. Available: ${defaultRegistry.list().join(', ')}`);
  return adapter.review(options);
}

export async function runFollowupAdapter(
  tool: string,
  options: FollowupOptions,
): Promise<AdapterResult> {
  const adapter = defaultRegistry.get(tool);
  if (!adapter) throw new Error(`Unsupported tool: ${tool}. Available: ${defaultRegistry.list().join(', ')}`);
  return adapter.followup(options);
}
```

- [ ] **Step 2: Build to verify**

Run: `cd ~/project/mmbridge && pnpm run build`
Expected: 7/7 PASS

- [ ] **Step 3: Commit**

```bash
git add packages/adapters/src/index.ts
git commit -m "refactor: replace switch-case dispatch with AdapterRegistry lookup"
```

---

### Task 4: Use registry in CLI instead of hardcoded TOOL_BINARY_MAP

**Files:**
- Modify: `packages/cli/src/index.ts`

- [ ] **Step 1: Replace TOOL_BINARY_MAP with registry**

Changes in `packages/cli/src/index.ts`:

1. Remove `TOOL_BINARY_MAP` and `TOOL_NAMES` constants
2. Import `defaultRegistry` from `@mmbridge/adapters`
3. In `runReviewCommand`: use `defaultRegistry.get(tool)` to get binary
4. In `runDoctorCommand`: use `defaultRegistry.list()` to enumerate tools
5. In `runDashboardCommand`: use `defaultRegistry.list()` to enumerate tools

Key change in `runReviewCommand`:
```typescript
const adapter = defaultRegistry.get(tool);
if (!adapter) {
  exitWithError(`Unknown tool: ${tool}. Valid tools: ${defaultRegistry.list().join(', ')}`);
}
const isInstalled = await commandExists(adapter.binary);
```

Key change in `runDoctorCommand`:
```typescript
const toolNames = defaultRegistry.list();
const binaries = toolNames.map((t) => defaultRegistry.get(t)!.binary);
// ... plus 'claude' which is not an adapter
const allBinaries = [...new Set([...binaries, 'claude'])];
```

- [ ] **Step 2: Build to verify**

Run: `cd ~/project/mmbridge && pnpm run build`
Expected: 7/7 PASS

- [ ] **Step 3: Commit**

```bash
git add packages/cli/src/index.ts
git commit -m "refactor: replace hardcoded TOOL_BINARY_MAP with AdapterRegistry in CLI"
```

---

### Task 5: Update MmbridgeConfig to support third-party adapter module paths

**Files:**
- Modify: `packages/core/src/types.ts`
- Modify: `examples/mmbridge.config.json`

- [ ] **Step 1: Extend adapter config type**

In `packages/core/src/types.ts`, change the `adapters` field:

```typescript
/** Adapter-specific configuration overrides */
adapters?: Record<string, {
  /** Override the binary/command name */
  command?: string;
  /** Override default CLI arguments */
  args?: string[];
  /** npm package or file path to load as a third-party adapter */
  module?: string;
}>;
```

- [ ] **Step 2: Update example config**

Add to `examples/mmbridge.config.json`:
```json
{
  "adapters": {
    "deepseek": {
      "module": "mmbridge-adapter-deepseek"
    }
  }
}
```

- [ ] **Step 3: Build to verify**

Run: `cd ~/project/mmbridge && pnpm run build`
Expected: 7/7 PASS

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/types.ts examples/mmbridge.config.json
git commit -m "feat: add module field to adapter config for third-party loading"
```

---

### Task 6: Update create-adapter template

**Files:**
- Modify: `packages/create-adapter/src/index.ts`

- [ ] **Step 1: Update template to export AdapterDefinition object**

Update TEMPLATE in `packages/create-adapter/src/index.ts`:

```typescript
const TEMPLATE = `import type { AdapterDefinition, ReviewOptions, FollowupOptions, AdapterResult } from '@mmbridge/adapters';

export const adapter: AdapterDefinition = {
  name: '{{name}}',
  binary: '{{name}}',

  async review(options: ReviewOptions): Promise<AdapterResult> {
    throw new Error('Not implemented: review for {{name}}');
  },

  async followup(options: FollowupOptions): Promise<AdapterResult> {
    throw new Error('Not implemented: followup for {{name}}');
  },
};

export default adapter;
`;
```

(This is already correct — template already generates `AdapterDefinition` object. Verify and fix the catch handler type while here.)

- [ ] **Step 2: Fix catch handler type safety**

```typescript
main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
```

- [ ] **Step 3: Build to verify**

Run: `cd ~/project/mmbridge && pnpm run build`
Expected: 7/7 PASS

- [ ] **Step 4: Commit**

```bash
git add packages/create-adapter/src/index.ts
git commit -m "fix: improve create-adapter template and error handling"
```

---

### Task 7: Integration test — load third-party adapter from config

**Files:**
- Create: `packages/adapters/test/load-config.test.ts`

- [ ] **Step 1: Write integration test**

```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { AdapterRegistry } from '../src/registry.js';
import type { MmbridgeConfig } from '@mmbridge/core';

test('loadFromConfig skips adapters without module field', async () => {
  const registry = new AdapterRegistry();
  const config: MmbridgeConfig = {
    adapters: { custom: { command: 'custom-bin' } },
  };
  await registry.loadFromConfig(config);
  assert.equal(registry.has('custom'), false);
});

test('loadFromConfig skips already-registered adapters', async () => {
  const registry = new AdapterRegistry();
  const existing = {
    name: 'existing',
    binary: 'existing',
    review: async () => ({} as never),
    followup: async () => ({} as never),
  };
  registry.register(existing);
  const config: MmbridgeConfig = {
    adapters: { existing: { module: 'nonexistent-package' } },
  };
  await registry.loadFromConfig(config);
  assert.equal(registry.get('existing'), existing);
});

test('loadFromConfig loads adapter from file path', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mmbridge-test-'));
  const adapterPath = path.join(tmpDir, 'test-adapter.mjs');
  await fs.writeFile(adapterPath, `
    export default {
      name: 'test-file',
      binary: 'test',
      review: async () => ({ tool: 'test-file', text: 'ok', ok: true, code: 0, stdout: '', stderr: '', combined: '', args: [], command: 'test', externalSessionId: null, followupSupported: false }),
      followup: async () => ({ tool: 'test-file', text: 'ok', ok: true, code: 0, stdout: '', stderr: '', combined: '', args: [], command: 'test', externalSessionId: null, followupSupported: false }),
    };
  `);

  const registry = new AdapterRegistry();
  const config: MmbridgeConfig = {
    adapters: { 'test-file': { module: adapterPath } },
  };
  await registry.loadFromConfig(config);
  assert.equal(registry.has('test-file'), true);

  await fs.rm(tmpDir, { recursive: true });
});
```

- [ ] **Step 2: Run tests**

Run: `cd packages/adapters && node --import tsx --test test/load-config.test.ts`
Expected: PASS (3/3)

- [ ] **Step 3: Commit**

```bash
git add packages/adapters/test/load-config.test.ts
git commit -m "test: add integration tests for AdapterRegistry config loading"
```

---

## Summary

| Task | Description | Risk |
|------|-------------|------|
| 1 | AdapterRegistry class + unit tests | Low |
| 2 | Export AdapterDefinition from built-in adapters | Low |
| 3 | Replace switch-case with registry | Low |
| 4 | Use registry in CLI | Low |
| 5 | Extend config type for third-party modules | Low |
| 6 | Update create-adapter template | Low |
| 7 | Integration tests for config loading | Low |

**Total: 7 tasks, ~12 files, 0 full rewrites, all additive changes**
