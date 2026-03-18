# mmbridge Operations Layer Design

Date: 2026-03-18
Status: Approved for planning

## Summary

This design adds a lightweight operations layer to `mmbridge` by connecting three capabilities into one flow:

1. A persistent review runtime state machine for `mmbridge review`
2. A warn-only `mmbridge gate` command for freshness and risk checks
3. A guided `mmbridge resume` command that continues work from the latest handoff

The goal is to make `mmbridge` feel less like a one-shot review CLI and more like a review workflow tool that can track state, warn before risky actions, and help users continue from the most relevant next step.

## Why This Fits mmbridge

`mmbridge` already has the right building blocks:

- review orchestration in `packages/core/src/review-pipeline.ts`
- parallel tool execution in `packages/core/src/orchestrate.ts`
- live telemetry in `packages/core/src/live-state.ts`
- handoff and memory generation in `packages/session-store/src/project-memory.ts`
- CLI review entrypoint in `packages/cli/src/commands/review.ts`
- Claude hook integration in `packages/integrations/src/hooks.ts`

This design keeps those boundaries and adds a shared operational model on top of them.

## Goals

- Persist review execution state in a form that other commands can reuse
- Add a standalone `mmbridge gate` command that reports warnings without blocking workflows
- Add a guided `mmbridge resume` command that uses handoff and session history to continue work safely
- Reuse the same state in CLI, hooks, TUI, and MCP
- Keep rollout safe by default: warn-only, opt-in hooks, soft-fail behavior

## Non-Goals

- No tmux worker orchestration
- No large agent hierarchy or autonomous workflow engine
- No blocking gate behavior in the first release
- No background daemon or queue system in the first release
- No changes to the core meaning of bridge consensus itself

## Chosen Product Decisions

- Gate mode starts as `warn-only`
- Gate is exposed as an independent CLI command: `mmbridge gate`
- Hooks call the CLI command instead of embedding policy logic directly
- Resume uses a guided confirmation flow, not automatic execution
- Runtime uses persistent review run snapshots plus the existing live-state mirror

## Architecture

The shared backbone is a new review run model. `review`, `gate`, and `resume` all depend on it.

- `review` creates and updates run snapshots
- `gate` evaluates the latest relevant run plus handoff state
- `resume` reads the latest handoff and run state, then executes the next action after confirmation

Responsibility boundaries:

- `@mmbridge/core`: state transitions, policy evaluation, action recommendation
- `@mmbridge/session-store`: run persistence, handoff lookup, resume history, gate snapshots
- `@mmbridge/cli`: user-facing commands and guided confirmation
- `@mmbridge/integrations`: thin hook wrappers that call CLI commands
- `@mmbridge/tui`: live and historical presentation of runtime state
- `@mmbridge/mcp`: optional access to the same operational state

## Review Runtime State Machine

### Runtime Model

Introduce a persistent `ReviewRun` record and per-tool `ToolLane` state.

`ReviewRun` fields:

- `id`
- `projectDir`
- `mode`
- `baseRef`
- `status`
- `phase`
- `startedAt`
- `completedAt`
- `warnings`
- `findingsSoFar`
- `sourceSessionId`

`ToolLane` fields:

- `tool`
- `status`
- `attempt`
- `startedAt`
- `completedAt`
- `error`
- `findingCount`
- `externalSessionId`
- `followupSupported`

### Status Model

Run status:

- `queued`
- `running`
- `completed`
- `partial`
- `failed`
- `cancelled`

Lane status:

- `queued`
- `running`
- `done`
- `error`
- `timed_out`
- `skipped`
- `cancelled`

### Flow

1. `mmbridge review` creates a new `ReviewRun`
2. Each selected tool is registered as a `ToolLane`
3. Lane updates are persisted as each tool starts, completes, or fails
4. Bridge, interpret, enrich, and handoff phases update run phase metadata
5. Final session, handoff, and memory artifacts are linked back to the run

### Storage Strategy

- Persist full review run data in `@mmbridge/session-store`
- Keep `packages/core/src/live-state.ts` as a fast mirror of the active run

This preserves existing TUI behavior while making the underlying state reusable for `gate` and `resume`.

## Gate Command

### Command Shape

Introduce:

- `mmbridge gate`
- `mmbridge gate --project <path>`
- `mmbridge gate --base-ref <ref>`
- `mmbridge gate --format compact|json`

Initial behavior remains warn-only. Exit code stays `0`.

### Gate Inputs

`gate` reads:

- the latest relevant review run
- the latest session and handoff for the project
- current git/base-ref information

### Initial Warning Rules

- `stale-review`: no recent review matches the current diff/base-ref
- `unresolved-critical`: latest session or handoff still contains unresolved critical findings
- `coverage-gap`: a required review type is missing for the current change class
- `bridge-gap`: a large or risky change only has single-tool review coverage

### Output Style

Warnings must always include a suggested next action.

Examples:

- `WARN stale-review`
  Latest review does not match the current diff.
  Next: run `mmbridge review --tool all --bridge standard`

- `WARN unresolved-critical`
  Latest handoff contains unresolved critical blockers.
  Next: run `mmbridge resume`

### Integration

Hook integration remains intentionally thin:

- hooks call `mmbridge gate`
- hooks do not own policy logic
- failures in hook-triggered gate execution must not break developer workflows

## Resume Command

### Command Shape

Introduce:

- `mmbridge resume`
- `mmbridge resume --yes`
- `mmbridge resume --action followup|rerun|bridge-rerun`
- `mmbridge resume --session <id>`

### Guided Resume Flow

1. Read latest handoff and related run/session state
2. Show current summary, blockers, and recommended action
3. Let the user confirm the recommended action or choose another valid action
4. Execute the selected follow-up or rerun path
5. Save a new run/session and update handoff artifacts

### Action Selection Rules

- If follow-up is supported and an external session exists, recommend `followup`
- If the latest review is stale, recommend `rerun`
- If unresolved critical findings or missing bridge coverage exist, recommend `bridge-rerun`
- If no action is needed, show summary only and exit successfully

### Safety Rules

- Never overwrite the prior handoff on a failed resume attempt
- Persist failed attempts as new runs/sessions
- After failure, present the next-best alternative action if one exists

## Error Handling

The operations layer must soft-fail wherever possible.

- A failing tool lane should not automatically fail the entire review
- `gate` should emit `WARN unable-to-evaluate` if data is missing or evaluation is ambiguous
- `resume` should preserve prior handoff state on failure
- hook-triggered gate checks should fail open in the first release

This keeps the system trustworthy without making it disruptive.

## Testing Strategy

### Core Tests

- review run creation and transition behavior
- lane partial-failure behavior
- stale/fresh review evaluation
- resume action recommendation logic

### Session Store Tests

- latest run lookup
- latest handoff lookup
- unresolved blocker aggregation
- gate input assembly
- resume history recording

### CLI Tests

- `mmbridge gate` output and formatting
- `mmbridge gate --format json`
- `mmbridge resume` guided prompt flow
- `mmbridge resume --yes`
- `mmbridge resume --action ...`
- soft-fail behavior when underlying data is missing

### TUI Tests

- mapping run snapshot state into live monitor display
- rendering freshness warning and recommended action

## Rollout Plan

### Step 1

Implement persistent review run snapshots and lane state.

### Step 2

Implement `mmbridge gate` as a standalone warn-only CLI.

### Step 3

Implement guided `mmbridge resume`.

### Step 4

Update TUI/live state presentation to surface freshness and next action.

### Step 5

Update Claude hook integration to call the new `mmbridge gate` command.

## Acceptance Criteria

- `mmbridge review` persists run state that captures per-tool execution progress
- `mmbridge gate` can evaluate the latest project state and emit warnings with next actions
- `mmbridge resume` can continue work from the latest handoff using guided confirmation
- Hooks can call `mmbridge gate` safely without breaking the workflow
- TUI can display the same operational state without inventing separate logic

## Risks

- Too much runtime/state complexity could blur the current clean package boundaries
- Weak freshness heuristics could cause noisy warnings
- Resume recommendations could feel brittle if tied too tightly to a single handoff format

Mitigations:

- keep policy logic centralized
- start with a small rule set
- keep warn-only rollout until real usage validates the heuristics
