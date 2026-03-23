# mmbridge Vision Design

Date: 2026-03-23
Status: Approved for implementation

## Summary

This design formalizes `mmbridge` vision across two audiences:

- external users evaluating the product on GitHub or npm
- internal contributors, especially coding assistants, deciding how the product should evolve

The external message should be:

`mmbridge` is a multi-model thinking layer for coding assistants.

The internal direction should be:

build `mmbridge` as an early control plane for coding work that can grow toward a deeper assistant operating layer over time.

The gap between those two statements is deliberate. External language should stay tightly aligned with the current product surface. Internal direction should remain ambitious enough to guide future decisions.

## Problem

The current control-plane repositioning fixed an immediate problem: `mmbridge` no longer reads like a review-only bridge.

But it still lacks a stable long-term story:

- external readers can understand what `mmbridge` does today, but not why it should exist long-term
- internal contributors can see the command surface growing, but not the product boundaries or intended evolution
- future changes risk drifting back toward "review tool with extras" or overcorrecting into "agent OS" claims too early

What is missing is a written vision that stabilizes both the public product thesis and the internal design direction.

## Goals

- Give external users a crisp explanation of why `mmbridge` exists
- Explain how `mmbridge` complements primary coding assistants instead of replacing them
- Give internal contributors a durable north star for roadmap and PR decisions
- Preserve room for long-term evolution toward a stronger control plane without overclaiming current capability

## Non-Goals

- No new runtime or orchestration features in this phase
- No command changes
- No claim that `mmbridge` is already a full agent OS
- No marketing language that implies full autonomous execution ownership

## Audience Split

### External Audience

External readers need:

- a simple description
- clear differentiation from primary coding assistants
- a credible explanation of current value

The message for them should emphasize:

- multi-model thought expansion
- validation and trust
- workflow continuity

### Internal Audience

Internal contributors need:

- a product stance
- contribution heuristics
- roadmap pressure in the right direction

The message for them should emphasize:

- single-model execution with multi-model thinking
- review as a trust primitive
- memory and continuity as first-class surface
- gradual movement from thinking layer toward stronger control-plane behavior

## Positioning Decision

The chosen structure is:

- external positioning: `multi-model thinking layer for coding assistants`
- internal direction: `from thinking layer to assistant control plane`

This is better than leading with "review" because review is too narrow.
It is better than leading with "agent OS" because that overstates the current product.

## Core Product Thesis

The product thesis is:

1. let the primary coding assistant remain the main executor
2. widen perspective with multiple models when direction matters
3. strengthen trust with review, security, and freshness checks
4. preserve continuity with memory, handoff, follow-up, and resume

This keeps the system useful in its current state and extensible in its future state.

## Artifact Plan

This design should produce three visible artifacts:

1. `VISION.md`
   - short, externally legible product vision
   - suitable for GitHub readers

2. `docs/vision/coding-assistant-operating-model.md`
   - internal operating model
   - targeted at coding assistants and maintainers
   - defines design and roadmap heuristics

3. `README.md`
   - lightweight entry point linking to both documents

## Content Requirements

### `VISION.md`

Must include:

- what `mmbridge` is
- what it is not
- why the category matters
- product thesis
- near-term and longer-term direction

### `docs/vision/coding-assistant-operating-model.md`

Must include:

- internal north star
- design principles
- feature alignment heuristics
- PR and roadmap review heuristics

### `README.md`

Must include:

- a lightweight pointer to the external and internal vision docs near the introduction

## Success Criteria

- a new reader can understand why `mmbridge` exists beyond command enumeration
- a contributor can decide whether a feature aligns with the product without guessing
- external copy remains accurate to the current product
- internal direction is ambitious without becoming dishonest marketing
