# mmbridge Operating Model for Coding Assistants

Date: 2026-03-23
Audience: coding assistants and maintainers contributing to `mmbridge`

## Purpose

This document defines how `mmbridge` should evolve from here.

Externally, `mmbridge` is a multi-model thinking layer for coding assistants.
Internally, it should be built as the early control plane for coding work that may grow into a stronger assistant operating layer over time.

The key rule is that external messaging must stay narrower than internal ambition.

## Product Stance

Build toward this sentence:

`mmbridge` helps a primary coding assistant think more broadly, verify more reliably, and continue work with more context.

That sentence implies three jobs:

1. widen thinking before execution
2. validate outcomes after execution
3. preserve continuity across sessions and tools

## Current Center of Gravity

The product already has credible building blocks:

- `research` for multi-model exploration
- `debate` for structured disagreement and synthesis
- `review` and `security` for trust and risk reduction
- `gate`, `followup`, and `resume` for workflow freshness
- `memory` and `handoff` for continuity
- `embrace` for higher-level lifecycle orchestration

When changing the repo, contributors should treat these as one system rather than unrelated commands.

## Internal North Star

Internally, `mmbridge` should move from:

- review bridge

to:

- thinking and continuity control plane

and eventually toward:

- assistant operating substrate

The phrase "assistant operating substrate" is intentional. It is stronger than a utility layer, but weaker and more honest than claiming a full agent OS today.

## Design Principles

### 1. Single-model execution, multi-model thinking

The default assumption is that a primary assistant still executes the main coding loop. `mmbridge` should improve the quality of that loop by widening thought, not by forcibly owning all execution.

### 2. Review is a primitive, not the whole product

Review remains strategically important because it creates trust, catches regressions, and anchors quality. But future work should not collapse back into "review tool with extras."

### 3. Continuity is product surface

Memory, handoff, gate, resume, and follow-up are not support features. They are part of the main product story because they let work survive across sessions, tools, and contributors.

### 4. Honest external claims

Do not market features as if `mmbridge` already owns execution, worker scheduling, or fully autonomous runtime behavior. Internal architecture may prepare for that future, but current copy must remain accurate.

### 5. Interoperability over capture

Prioritize clean integration with Claude Code, Codex CLI, OpenCode-style environments, and external adapter ecosystems over any attempt to force users into a closed runtime.

## Implications for Future Features

Features are more aligned when they:

- increase breadth of reasoning before code changes
- improve validation confidence after code changes
- preserve context between runs, agents, or humans
- expose workflow state clearly enough for the next actor to continue

Features are less aligned when they:

- duplicate what the primary coding assistant already does well
- add orchestration complexity without improving thought or continuity
- imply that `mmbridge` is now a full execution runtime when it is not
- optimize only for review throughput while weakening the broader product story

## Recommended Framing by Surface

- README and npm: thinking layer for coding assistants
- CLI help: thinking, validation, workflow continuity, operations
- internal docs: early control plane with room to become deeper infrastructure
- roadmap: sequence capabilities from thought expansion to continuity to stronger control-plane behavior

## Roadmap Heuristic

Evaluate roadmap items in this order:

1. Does this make pre-execution thinking better?
2. Does this make post-execution trust stronger?
3. Does this make cross-session continuity easier?
4. Does this make the control plane clearer without pretending to own execution?

If an item fails all four, it is probably drift.

## PR Review Heuristic

When reviewing work on `mmbridge`, ask:

- Does this help the primary assistant think, verify, or resume better?
- Does it reinforce the integrated product story across commands?
- Does it preserve honest boundaries about what `mmbridge` currently is?
- Does it move the system toward a stronger control plane without premature runtime sprawl?

If the answer is no, push back.
