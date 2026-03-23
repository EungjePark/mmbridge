# mmbridge Roadmap Design

Date: 2026-03-23
Status: Approved for implementation

## Summary

This design adds a roadmap document that translates the new `mmbridge` vision into concrete priority structure.

The roadmap should not be a flat backlog. It should express both:

- what capability area a piece of work strengthens
- when that work should matter relative to other work

The chosen structure is a mixed model:

- capability axes first
- `Now / Next / Later` within each axis

## Problem

The repo now has:

- an external vision
- an internal operating model

What it does not yet have is a document that turns those ideas into planning pressure.

Without a roadmap document:

- contributors have the "why" but not the "what next"
- future work risks drifting into unrelated features
- the product can regress toward either a review-only tool or an overclaimed agent OS narrative

## Goals

- Convert the product vision into a planning artifact
- Make trade-offs visible across product areas
- Keep roadmap decisions tied to the product stance
- Give coding assistants a durable way to prioritize proposed work

## Non-Goals

- No issue-level backlog in this phase
- No sprint planning or release planning detail
- No commit to exact dates
- No over-detailed technical implementation plan

## Structure Decision

The roadmap will use four capability axes:

- `Thinking`
- `Trust`
- `Continuity`
- `Control Plane`

Each axis will include:

- a goal
- `Now`
- `Next`
- `Later`
- `Not Now`

This is better than a pure time-based roadmap because it preserves product shape.
It is better than a pure capability map because it still forces sequencing.

## Axis Intent

### Thinking

Represents pre-execution exploration, comparison, and synthesis.

### Trust

Represents post-execution validation, review, security, and freshness.

### Continuity

Represents session memory, handoff, resume, follow-up, and state persistence.

### Control Plane

Represents the unifying layer that makes the whole workflow observable, coordinated, and resumable.

## Ordering Rule

When work competes across axes, the roadmap should prefer:

1. `Thinking`
2. `Trust`
3. `Continuity`
4. `Control Plane`

The last axis matters, but should not dominate too early. It should emerge from the first three rather than pretending the runtime layer is already the main product.

## Artifact Plan

This design should create one new roadmap document:

- `docs/vision/roadmap.md`

It should also update existing vision documents with pointers to the roadmap so the reader can move from:

- vision
- to operating model
- to roadmap

## Content Requirements

The roadmap must:

- reflect current product capabilities honestly
- distinguish near-term focus from longer-term direction
- include explicit `Not Now` boundaries
- give contributors and coding assistants clear planning heuristics

## Success Criteria

- a contributor can map a proposed feature to a capability axis and time horizon
- roadmap drift becomes easier to spot
- the roadmap reinforces the product thesis instead of diluting it
