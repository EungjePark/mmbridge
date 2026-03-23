# mmbridge Vision

`mmbridge` exists to expand how coding assistants think before, during, and after execution.

Today, most coding work still runs through a primary assistant such as Claude Code, Codex CLI, or a similar tool. That execution model is useful, but it is narrow: one model owns the main loop, one context window dominates the direction, and verification often happens too late.

`mmbridge` is the layer that widens that loop.

It works alongside the main coding assistant and brings in multiple model perspectives for research, debate, review, security, freshness checks, memory, and workflow continuation. The point is not to replace the coding assistant. The point is to help that assistant think with more surface area and resume work with more context.

## What mmbridge Is

`mmbridge` is a multi-model thinking layer for coding assistants.

In practice, that means:

- use multiple models before implementation to compare ideas and pressure-test plans
- use multiple models after implementation to review, audit, and find risk
- preserve context through memory, handoff, and session continuity
- keep workflows fresh with gate checks and follow-up loops

This makes `mmbridge` a control plane around coding work, not the coding runtime itself.

## What mmbridge Is Not

`mmbridge` is not:

- a replacement for Claude Code, Codex CLI, or other primary coding assistants
- a terminal multiplexer or worker farm
- a claim of full autonomous execution ownership
- an "agent OS" in the current product surface

Those boundaries matter. The product should stay credible. It should describe what exists now while leaving room to grow.

## Why This Matters

Single-model execution is usually good enough to write code. It is often not good enough to explore the space around that code.

The missing layer is:

- broader thinking before implementation
- better verification after implementation
- durable continuity between sessions, contributors, and tools

`mmbridge` focuses on that missing layer.

## The Product Thesis

The product thesis is simple:

1. keep execution anchored in the assistant the user already trusts
2. expand thinking with additional models when direction matters
3. preserve trust with review, security, and freshness checks
4. preserve continuity with memory, handoff, and resume flows

This keeps the system useful now and extensible later.

## Strategic Direction

The near-term direction is:

- become the best multi-model thinking layer for coding assistants
- make review, debate, research, security, and continuity feel like one product
- keep interoperability first-class across Claude Code, Codex CLI, and similar environments

The longer-term direction is:

- grow from a thinking layer into a deeper control plane for coding assistants
- coordinate more of the workflow lifecycle without overclaiming execution ownership
- become a foundation that could support richer agent operating patterns over time

The order matters. `mmbridge` should earn the right to become more central by first being the most reliable thinking and continuity layer.

## Product Principles

- Work alongside the main coding assistant instead of trying to replace it.
- Use multi-model thinking where breadth matters, not everywhere by default.
- Treat review as a trust primitive, not the entire identity of the product.
- Make continuity first-class through memory, handoff, follow-up, and resume.
- Keep product claims narrower than internal ambition.
- Preserve honest boundaries between current capability and future direction.

## One-Line Positioning

External positioning:

`mmbridge` is a multi-model thinking layer for coding assistants.

Expanded positioning:

`mmbridge` works alongside coding assistants like Claude Code and Codex CLI to widen model perspective, validate work, and continue workflows with memory and handoff context.

For internal direction, see [docs/vision/coding-assistant-operating-model.md](./docs/vision/coding-assistant-operating-model.md) and [docs/vision/roadmap.md](./docs/vision/roadmap.md).
