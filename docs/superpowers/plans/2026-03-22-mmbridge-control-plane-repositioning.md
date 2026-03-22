# mmbridge Control Plane Repositioning Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reposition `mmbridge` from a review-only bridge into a multi-model thinking and review control plane across README, CLI help text, package metadata, and regression checks.

**Architecture:** Keep runtime behavior unchanged. Update public product surface in layers: README first, CLI wording second, package metadata third, then lock in the new narrative with targeted CLI help tests and a consistency verification pass.

**Tech Stack:** Node.js, TypeScript, Commander, pnpm workspaces, Node test runner, Biome

**Spec:** `docs/superpowers/specs/2026-03-22-mmbridge-control-plane-repositioning-design.md`

**Prerequisite:** Use the repo's currently working Node runtime for build/test verification. The existing `packages/cli` `.ts` test harness is not yet portable across the entire declared `Node >=22` range, and normalizing that harness is out of scope for this positioning-only change.

---

## Chunk 1: README Narrative And Public Surface

### Task 1: Rewrite README hero, feature model, quick start, and command taxonomy

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Rewrite the hero and introduction around the control-plane position**

Replace the opening lines so the first screen communicates:

- `mmbridge` works alongside coding agents
- it expands thinking before implementation
- it validates work after implementation
- it preserves continuity with memory, handoff, gate, and resume

Draft target shape:

```md
# mmbridge

Multi-model thinking and review control plane for coding agents.

`mmbridge` works alongside tools like Claude Code, Codex CLI, and similar coding agents. Use it to research with multiple models, debate approaches, review implementations, audit security, and continue workflows with memory and handoff context.
```

- [ ] **Step 2: Rebuild the feature list into product groups**

Update the feature section to use grouped bullets:

- Thinking: `research`, `debate`, `embrace`
- Review and Audit: `review`, `security`, bridge consensus, `diff`
- Workflow Continuity: `gate`, `resume`, `followup`, `memory`, `handoff`
- Operations: config, adapters, hooks, TUI

Expected outcome: a new reader can understand the command set as one product rather than a review-only CLI.

- [ ] **Step 3: Replace isolated quick-start snippets with a workflow**

Revise the quick start to show:

```bash
mmbridge init
mmbridge research "..."
mmbridge review --tool all --bridge standard
mmbridge diff
mmbridge gate
mmbridge resume
```

Also keep one security example and one `embrace` example if it still reads cleanly.

- [ ] **Step 4: Restructure the commands section by intent**

Replace the single flat command table with grouped tables or grouped subsections:

- Thinking
- Review and Audit
- Workflow Continuity
- Operations

Make sure every existing public command is represented:

- `review`
- `diff`
- `followup`
- `resume`
- `gate`
- `handoff`
- `memory`
- `research`
- `debate`
- `security`
- `embrace`
- `doctor`
- `init`
- `sync-agents`
- `tui`
- `hook install`
- `hook uninstall`

- [ ] **Step 5: Fix README surface drift**

Correct known stale references:

- replace `dashboard` with `tui`
- ensure command names match the CLI exactly
- add `@mmbridge/mcp` to the package table
- update requirements/install text to match the actual Node.js engine floor of `>=22`

- [ ] **Step 6: Run a focused README review**

Run: `rg -n "dashboard|code review bridge|review-only" README.md`
Expected: no stale positioning phrases remain unless intentionally retained

- [ ] **Step 7: Commit**

```bash
git add README.md
git commit -m "docs: reposition mmbridge README as control plane"
```

## Chunk 2: CLI Help Regression First

### Task 2: Add CLI help regression coverage before changing wording

**Files:**
- Create: `packages/cli/test/help-text.test.ts`

- [ ] **Step 1: Write a failing help-text regression test**

Create a test that runs the built CLI with `execFileSync` and asserts the new public wording is present.

Minimum assertions:

- root `--help` contains `thinking and review control plane`
- root `--help` lists `research`, `debate`, `security`, `embrace`, `gate`, `resume`, and `tui`
- `research --help` contains the research-oriented description
- `embrace --help` contains lifecycle wording
- `memory --help` still renders and includes subcommands

Use a real filesystem path for `cwd`, for example `path.resolve(import.meta.dirname, '..')`, so the test runs from `packages/cli`.

Example test shape:

```ts
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { describe, it } from 'node:test';

const pkgDir = path.resolve(import.meta.dirname, '..');

function help(args: string[]): string {
  return execFileSync('node', ['dist/bin/mmbridge.js', ...args], {
    cwd: pkgDir,
    encoding: 'utf8',
  });
}

describe('CLI help text', () => {
  it('shows control-plane root help', () => {
    const output = help(['--help']);
    assert.match(output, /thinking and review control plane/i);
    assert.match(output, /\bresearch\b/);
    assert.match(output, /\bembrace\b/);
  });
});
```

- [ ] **Step 2: Build and verify the new test fails first**

Run:

```bash
pnpm --filter @mmbridge/cli build
pnpm --filter @mmbridge/cli test
```

Expected: FAIL before the CLI wording changes are implemented, with the new `help-text.test.ts` assertions failing inside the package test run

- [ ] **Step 3: Commit**

```bash
git add packages/cli/test/help-text.test.ts
git commit -m "test(cli): add failing control-plane help regression"
```

## Chunk 3: CLI Help And Package Metadata

### Task 3: Align CLI root and command descriptions with the new taxonomy

**Files:**
- Modify: `packages/cli/src/index.ts`

- [ ] **Step 1: Update the root program description**

Change:

```ts
.description('Multi-model code review bridge')
```

to wording consistent with the spec, for example:

```ts
.description('Multi-model thinking and review control plane for coding agents')
```

- [ ] **Step 2: Rewrite command descriptions to match actual roles**

Update descriptions without changing command names or behavior.

Examples of the intended direction:

```ts
.description('Validate code changes with one or more AI review tools')
.description('Inspect git diff annotated with stored review findings')
.description('Check whether the current diff has fresh review coverage')
.description('Continue the latest review workflow with the recommended next action')
.description('Research a topic across multiple AI models')
.description('Run a multi-model debate on an implementation proposition')
.description('Run a multi-model security audit with CWE classification')
.description('Run the full think-to-review lifecycle across mmbridge phases')
```

Also update the `memory`, `handoff`, `doctor`, `hook`, `init`, `sync-agents`, and `tui` descriptions so they read as part of the same product family.

- [ ] **Step 3: Keep taxonomy visible in source comments**

Rename or expand the existing section comments in `packages/cli/src/index.ts` so the source is grouped by:

- Thinking
- Review and Audit
- Workflow Continuity
- Operations

This is for maintainability, not user-visible behavior.

- [ ] **Step 4: Build and smoke-check help output**

Run:

```bash
pnpm --filter @mmbridge/cli build
pnpm --filter @mmbridge/cli test
cd packages/cli
node dist/bin/mmbridge.js --help
node dist/bin/mmbridge.js review --help
node dist/bin/mmbridge.js diff --help
node dist/bin/mmbridge.js gate --help
node dist/bin/mmbridge.js resume --help
node dist/bin/mmbridge.js followup --help
node dist/bin/mmbridge.js handoff --help
node dist/bin/mmbridge.js memory --help
node dist/bin/mmbridge.js debate --help
node dist/bin/mmbridge.js research --help
node dist/bin/mmbridge.js security --help
node dist/bin/mmbridge.js embrace --help
node dist/bin/mmbridge.js doctor --help
node dist/bin/mmbridge.js init --help
node dist/bin/mmbridge.js sync-agents --help
node dist/bin/mmbridge.js tui --help
node dist/bin/mmbridge.js hook --help
```

Expected:

- help renders without throwing
- root description shows the new control-plane wording
- command descriptions match the intended taxonomy

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/index.ts
git commit -m "feat(cli): align help text with control-plane positioning"
```

### Task 4: Add package descriptions across the workspace

**Files:**
- Modify: `package.json`
- Modify: `packages/adapters/package.json`
- Modify: `packages/cli/package.json`
- Modify: `packages/core/package.json`
- Modify: `packages/create-adapter/package.json`
- Modify: `packages/integrations/package.json`
- Modify: `packages/mcp/package.json`
- Modify: `packages/session-store/package.json`
- Modify: `packages/tui/package.json`

- [ ] **Step 1: Add missing `description` fields**

Set concise, differentiated descriptions. Target direction:

```json
{
  "description": "Multi-model thinking and review control plane for coding agents"
}
```

Package-specific examples:

- `@mmbridge/cli`: main CLI
- `@mmbridge/core`: context, consensus, workflow primitives
- `@mmbridge/adapters`: adapters for external model CLIs
- `@mmbridge/session-store`: session, memory, handoff persistence
- `@mmbridge/tui`: terminal UI for workflow state
- `@mmbridge/mcp`: MCP server exposing mmbridge workflow context
- `@mmbridge/integrations`: hook and agent integrations
- `@mmbridge/create-adapter`: scaffolding for custom adapters

- [ ] **Step 2: Verify JSON shape and package formatting**

Run:

```bash
node -e "const fs=require('fs'); const files=['package.json','packages/adapters/package.json','packages/cli/package.json','packages/core/package.json','packages/create-adapter/package.json','packages/integrations/package.json','packages/mcp/package.json','packages/session-store/package.json','packages/tui/package.json']; for (const f of files) JSON.parse(fs.readFileSync(f,'utf8')); console.log('ok')"
```

Expected: `ok`

- [ ] **Step 3: If package manifest formatting trips Biome, normalize it before final verification**

Run:

```bash
pnpm exec biome check --write package.json packages/*/package.json
```

Expected: touched `package.json` files are formatted into a lint-clean state

- [ ] **Step 4: Commit**

```bash
git add package.json packages/*/package.json
git commit -m "docs: add control-plane package descriptions"
```

## Chunk 4: Full Verification

### Task 5: Run the full verification pass and perform manual consistency review

**Files:**
- No new files required

- [ ] **Step 1: Run static checks**

Run:

```bash
pnpm lint
pnpm typecheck
```

Expected: success

- [ ] **Step 2: Run builds and tests**

Run:

```bash
pnpm build
pnpm test
```

Expected: success across all packages

- [ ] **Step 3: Run CLI help verification commands**

Run:

```bash
node packages/cli/dist/bin/mmbridge.js --help
node packages/cli/dist/bin/mmbridge.js review --help
node packages/cli/dist/bin/mmbridge.js diff --help
node packages/cli/dist/bin/mmbridge.js gate --help
node packages/cli/dist/bin/mmbridge.js memory --help
node packages/cli/dist/bin/mmbridge.js hook --help
node packages/cli/dist/bin/mmbridge.js research --help
node packages/cli/dist/bin/mmbridge.js embrace --help
```

Expected:

- every command renders
- wording is consistent with the README and spec

- [ ] **Step 4: Perform manual consistency pass**

Check:

- every command named in `README.md` exists in CLI help
- `README.md` does not mention `dashboard`
- `README.md` package table includes `@mmbridge/mcp`
- `README.md` requirements/install text matches the real engine floor of Node.js `>=22`
- package descriptions and README hero use the same control-plane framing
- the README quick start only uses commands that actually exist

- [ ] **Step 5: Commit**

```bash
git add README.md packages/cli/src/index.ts packages/cli/test/help-text.test.ts package.json packages/*/package.json
git commit -m "chore: finalize mmbridge control-plane repositioning"
```
