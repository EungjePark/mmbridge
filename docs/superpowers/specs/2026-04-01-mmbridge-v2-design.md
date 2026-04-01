# mmbridge v2 — Conversational Multi-Model Orchestrator

Date: 2026-04-01
Status: approved
Scope: full product redesign (5 phases)

## One-Line

mmbridge v2 becomes a conversational CLI that orchestrates multiple AI models, with Claude as the thinking backbone and kimi/qwen/codex/gemini as specialized tools.

## Position Shift

```
v1: "thinking layer alongside coding assistants"
v2: "conversational orchestrator that subsumes coding assistants"

v1: Claude Code (주인) → mmbridge (도구)
v2: mmbridge (주인) → Claude, Kimi, Qwen, Codex (도구)
```

## Reference Architectures

- **Claude Code** (`/Users/parkeungje/project/claude-code/src/`): REPL, hooks, swarm, compaction, permissions, tool system
- **Hermes Agent** (`~/.hermes/`): OAuth multi-provider, skills, SOUL, SQLite state, agent loop
- **Claw Code** (`instructkr/claw-code`): Python port patterns, Rust rewrite direction

## Architecture

```
┌─────────────────────────────────────────────────┐
│                 mmbridge v2 CLI                  │
│  ┌───────────────────────────────────────────┐  │
│  │           Conversational REPL              │  │
│  │  mmbridge> 이 PR 리뷰해줘                  │  │
│  │  → Claude orchestrator → tool_use          │  │
│  │  → kimi review + qwen security (parallel)  │  │
│  │  → Claude synthesizes → inline response    │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌──────────┐ ┌──────────┐ ┌────────────────┐  │
│  │   Auth    │ │  Agent   │ │   Skills       │  │
│  │  OAuth +  │ │  Loop    │ │  File-based    │  │
│  │  Keychain │ │  Claude  │ │  plugins       │  │
│  └──────────┘ │  tool_use│ └────────────────┘  │
│               └──────────┘                      │
│  ┌──────────┐ ┌──────────┐ ┌────────────────┐  │
│  │  Memory  │ │  Tools   │ │   Adapters     │  │
│  │  SQLite  │ │  review  │ │  kimi, qwen,   │  │
│  │  SOUL.md │ │  security│ │  codex, gemini │  │
│  │  sessions│ │  research│ │  droid, pi     │  │
│  └──────────┘ └──────────┘ └────────────────┘  │
└─────────────────────────────────────────────────┘
```

## Phase 1: Auth + Agent Core

### Auth (`packages/auth/`)

- `mmbridge login` → OAuth flow (Anthropic, OpenAI)
- Token storage: macOS Keychain (primary), encrypted file (fallback)
- Multi-provider: Anthropic (Claude), OpenAI (Codex/GPT), API keys (Kimi, Qwen, Gemini)
- Token refresh: automatic, silent
- `mmbridge logout`, `mmbridge auth status`

Reference: Hermes `auth.json` (provider-based token structure), Claude Code `secureStorage/`

### Agent Core (`packages/agent/`)

- Claude API as orchestrator (tool_use enabled)
- mmbridge features registered as tools:
  - `review`: run multi-model review
  - `security`: run security audit
  - `research`: multi-model research
  - `debate`: structured debate
  - `memory_search`: search project memory
  - `gate`: check review coverage
  - `followup`: continue review session
- Streaming response rendering
- Agent loop: max_turns (configurable), abort on ESC, retry on transient errors
- System prompt: mmbridge identity + available tools + project context

Reference: Claude Code `QueryEngine.ts`, Hermes agent loop

## Phase 2: CLI/UX (Full Redesign)

- Kill tab-based TUI entirely
- Single-stream REPL (like Claude Code)
- Markdown rendering in terminal (code blocks, headers, lists)
- Syntax highlighting for code
- Streaming token-by-token output
- Theme: keep Catppuccin Mocha, add light mode
- Responsive: auto single-column under 70 cols
- Status line: model, project, token usage

Reference: Claude Code `ink.ts`, `theme.ts`, `terminal.ts`

## Phase 3: Multi-Model Tool Integration

- Existing adapters (kimi, qwen, codex, gemini, droid, pi) → registered as Claude tools
- Claude decides which tool to invoke based on conversation
- Results fed back to Claude for synthesis
- Parallel tool execution for multi-model reviews
- Bridge consensus maintained

## Phase 4: Memory + Persistence

- SQLite state DB (replace JSON file sessions)
- Session history with full conversation
- SOUL.md: persistent agent identity/preferences
- Context compaction (Claude Code pattern): 9-section summary
- Cross-session recall with relevance scoring
- Handoff artifacts preserved

Reference: Hermes `state.db`, Claude Code compaction system

## Phase 5: Skills + Extensibility

- File-based skill loading (`~/.mmbridge/skills/`)
- Skill = system prompt + tools + hooks
- Skill marketplace (later) or local-only (now)
- Hook system: PreToolUse, PostToolUse, SessionStart, SessionEnd
- Plugin API for custom adapters and tools

Reference: Hermes skills system, Claude Code plugin/hook system

## Package Changes

```
packages/
  auth/           ← NEW: OAuth + keychain
  agent/          ← NEW: Claude tool_use agent loop
  cli/            ← REWRITE: single-stream REPL
  tui/            ← DEPRECATE: merge into cli
  core/           ← KEEP: pipeline, context
  adapters/       ← KEEP: model adapters
  session-store/  ← EVOLVE: → SQLite
  context-broker/ ← KEEP: recall, compaction
  mcp/            ← KEEP: MCP server
  skills/         ← NEW: skill loader
```

## Non-Goals (v2)

- Mobile app or web UI
- Self-hosting the models
- Replacing git or CI/CD
- Agent-to-agent communication (v3)

## Success Criteria

- `mmbridge login` → OAuth → ready in 30 seconds
- `mmbridge` → conversational REPL with Claude as backbone
- "리뷰해줘" → Claude invokes kimi/qwen, synthesizes, responds in Korean
- Session persists across restarts (SQLite)
- Skills loadable from filesystem
