# MMBridge TUI Redesign — Full Spec

**Date**: 2026-03-14
**Status**: Draft
**Framework**: ink (React for CLI) replacing blessed
**Goal**: Transform read-only dashboard into a polished, interactive command hub accessible to both developers and vibe coders.

---

## 1. Design Philosophy

**Kaku principle**: Zero-config, sensible defaults, GUI-like feel in the terminal.
**Yazi principle**: 3-pane context awareness, async everything, keyboard-first but discoverable.
**MMBridge principle**: "Open mmbridge, do everything." No memorizing CLI flags.

### Color Palette (ANSI 256)

| Role | Color | ANSI | Usage |
|------|-------|------|-------|
| Background | #0F172A | 234 | Screen bg |
| Surface | #1E293B | 236 | Panels, cards |
| Border idle | #334155 | 240 | Unfocused borders |
| Border focus | #22C55E | 78 | Active panel border |
| Text primary | #F8FAFC | 255 | Body text |
| Text muted | #94A3B8 | 248 | Labels, hints |
| Accent green | #22C55E | 78 | Success, CTA, active tab |
| Accent yellow | #EAB308 | 220 | Warnings |
| Accent red | #EF4444 | 196 | Critical, errors |
| Accent cyan | #06B6D4 | 44 | Info, links |
| Accent dim | #64748B | 244 | Refactor, disabled |

### Typography

- Mono only (inherits terminal font)
- Headers: UPPERCASE + bold
- Labels: dim + lowercase
- Values: normal weight
- Status badges: inverse color blocks (e.g., ` CRITICAL ` white-on-red)

---

## 2. Architecture

### Component Tree

```
<App>
  <Header />           ← logo + tab bar + clock
  <Body>
    <Sidebar />         ← context-dependent list (models, sessions, files)
    <MainPanel />       ← context-dependent detail/action view
  </Body>
  <StatusBar />         ← git info + keybindings + toast messages
  <HelpOverlay />       ← ? key toggles full keybinding reference
</App>
```

### State Management

Single Zustand-like store (or React context + useReducer):

```ts
interface TuiState {
  activeTab: 'review' | 'config' | 'sessions' | 'diff';
  sidebar: {
    selectedIndex: number;
    items: SidebarItem[];
  };
  review: {
    selectedTool: string;
    mode: string;
    baseRef: string;
    running: boolean;
    progress: string;
    result: ReviewReport | null;
  };
  config: {
    adapters: AdapterConfig[];
    editingAdapter: string | null;
  };
  sessions: {
    list: SessionSummary[];
    selected: SessionDetail | null;
    filter: { tool?: string; mode?: string };
  };
  diff: {
    baseRef: string;
    sessionId: string | null;
    lines: AnnotatedDiffLine[];
  };
  toast: { message: string; type: 'success' | 'error' | 'info' } | null;
  helpVisible: boolean;
  focusZone: 'sidebar' | 'main';
}
```

---

## 3. Tab Designs

### Tab 1: REVIEW (Main Hub)

The primary screen. Select model, configure, run, see results — all in one place.

```
┌─ MMBRIDGE ──────────────── [REVIEW] Config  Sessions  Diff ──────┐
│                                                                    │
│  ┌─ MODELS ──────┐  ┌─ REVIEW SETUP ────────────────────────┐    │
│  │               │  │                                        │    │
│  │  ● kimi   ✓  │  │  Tool:     kimi                        │    │
│  │  ○ qwen   ✓  │  │  Mode:     review  ▾                   │    │
│  │  ○ codex  ✓  │  │  Base ref: origin/main                 │    │
│  │  ○ gemini ✓  │  │  Files:    12 changed                  │    │
│  │               │  │                                        │    │
│  │───────────────│  │  ┌──────────────────────────────┐      │    │
│  │  MODE         │  │  │      ⏎  START REVIEW         │      │    │
│  │  ○ review     │  │  └──────────────────────────────┘      │    │
│  │  ● security   │  │                                        │    │
│  │  ○ architect  │  │  -- or --                              │    │
│  │               │  │                                        │    │
│  │───────────────│  │  ┌──────────────────────────────┐      │    │
│  │  OPTIONS      │  │  │   ⇧B  BRIDGE (multi-model)   │      │    │
│  │  export: off  │  │  └──────────────────────────────┘      │    │
│  │  bridge: std  │  │                                        │    │
│  └───────────────┘  └────────────────────────────────────────┘    │
│                                                                    │
│  main · 3eed5ff · 12 dirty │ ↹Focus  1-4Tab  j/k Nav  ?Help     │
└────────────────────────────────────────────────────────────────────┘
```

**Running state**: START REVIEW button replaced with spinner + streaming output:

```
│  │  ┌─ RUNNING kimi review ──────────────────┐      │
│  │  │  ◐ Preparing context... (2.1s)         │      │
│  │  │    ├ 12 files copied                   │      │
│  │  │    ├ 3 secrets redacted                │      │
│  │  │    └ context: 48.2 KB                  │      │
│  │  │  ◑ Waiting for kimi response...        │      │
│  │  └────────────────────────────────────────┘      │
```

**Result state**: Findings appear inline, scrollable:

```
│  │  ┌─ RESULT ─── 5 findings ────────────────┐      │
│  │  │   CRITICAL  src/api.ts:42              │      │
│  │  │   Unsafe type assertion                │      │
│  │  │                                        │      │
│  │  │   WARNING   src/utils.ts:18            │      │
│  │  │   Missing null check                   │      │
│  │  │                                        │      │
│  │  │   INFO      src/config.ts:7            │      │
│  │  │   Consider extracting constant         │      │
│  │  │                                        │      │
│  │  │  ⏎ Detail  e Export  f Followup  d Diff│      │
│  │  └────────────────────────────────────────┘      │
```

**Interactions**:
- `j/k` in sidebar: select tool, then mode, then options
- `Enter` on START: runs review
- After result: `e` exports, `f` opens followup prompt, `d` switches to Diff tab with this session

---

### Tab 2: CONFIG (Kaku-style Setup)

No file editing. Everything via TUI forms.

```
┌─ MMBRIDGE ──────────────── Review  [CONFIG]  Sessions  Diff ─────┐
│                                                                    │
│  ┌─ ADAPTERS ────┐  ┌─ KIMI ADAPTER ────────────────────────┐    │
│  │               │  │                                        │    │
│  │  ● kimi   ✓  │  │  Binary:    kimi                       │    │
│  │  ○ qwen   ✓  │  │  Status:    ✓ installed                │    │
│  │  ○ codex  ✓  │  │  Version:   1.2.3                      │    │
│  │  ○ gemini ✓  │  │                                        │    │
│  │               │  │  ── Connection Test ──                 │    │
│  │───────────────│  │  Last test:  2m ago ✓                  │    │
│  │  + Add custom │  │  Latency:   1.2s                       │    │
│  │               │  │  ┌──────────────────────────┐          │    │
│  │───────────────│  │  │    ⏎  TEST CONNECTION     │          │    │
│  │  SETTINGS     │  │  └──────────────────────────┘          │    │
│  │  ○ classifiers│  │                                        │    │
│  │  ○ redaction  │  │  ── Custom Args ──                     │    │
│  │  ○ context    │  │  args: (default)                       │    │
│  │  ○ bridge     │  │                                        │    │
│  └───────────────┘  │  ⏎ Edit  t Test  r Reset defaults      │    │
│                      └────────────────────────────────────────┘    │
│                                                                    │
│  .mmbridge.config.json │ ↹Focus  1-4Tab  j/k Nav  ?Help         │
└────────────────────────────────────────────────────────────────────┘
```

**Sidebar sections**:
- ADAPTERS: built-in 4 + custom adapters from config
- `+ Add custom`: opens inline form (name, npm module or binary path)
- SETTINGS: global config categories

**Settings sub-screens**:

| Setting | UI | What it does |
|---------|-----|-------------|
| classifiers | Editable list with `a` add / `d` delete / `Enter` edit | File pattern → category mapping |
| redaction | Toggle list + custom rule form | Which secrets to redact |
| context | Slider-like number input | Max context bytes |
| bridge | Radio select (standard/strict/relaxed) | Consensus threshold |

**Save behavior**: Changes written to `.mmbridge.config.json` on `Ctrl+S` with toast confirmation. Unsaved changes shown as `*` in tab title.

---

### Tab 3: SESSIONS (History Browser)

```
┌─ MMBRIDGE ──────────────── Review  Config  [SESSIONS]  Diff ─────┐
│                                                                    │
│  ┌─ FILTERS ─────┐  ┌─ SESSION DETAIL ──────────────────────┐    │
│  │               │  │                                        │    │
│  │  TOOL         │  │  ID:      abc-123                      │    │
│  │  ◉ all        │  │  Tool:    kimi                         │    │
│  │  ○ kimi       │  │  Mode:    security                     │    │
│  │  ○ qwen       │  │  Date:    2026-03-14 15:30             │    │
│  │  ○ codex      │  │  Base:    origin/main                  │    │
│  │               │  │  Files:   12 changed                   │    │
│  │  MODE         │  │                                        │    │
│  │  ◉ all        │  │  ── Findings (5) ──                    │    │
│  │  ○ review     │  │   CRITICAL  src/api.ts:42              │    │
│  │  ○ security   │  │   WARNING   src/utils.ts:18            │    │
│  │               │  │   WARNING   src/config.ts:7            │    │
│  │───────────────│  │   INFO      src/types.ts:3             │    │
│  │  HISTORY      │  │   REFACTOR  src/old.ts:99              │    │
│  │  ● 03-14 kimi │  │                                        │    │
│  │  ○ 03-13 qwen │  │  ── Summary ──                         │    │
│  │  ○ 03-12 codex│  │  5 findings across 4 files.            │    │
│  │  ○ 03-11 kimi │  │  2 CRITICAL require immediate fix.     │    │
│  │               │  │                                        │    │
│  └───────────────┘  │  f Followup  e Export  d Diff  ⌫Delete │    │
│                      └────────────────────────────────────────┘    │
│                                                                    │
│  5 sessions │ ↹Focus  1-4Tab  j/k Nav  / Search  ?Help          │
└────────────────────────────────────────────────────────────────────┘
```

**Interactions**:
- Sidebar filters update the HISTORY list in real-time
- `/` opens search (fuzzy match on summary text)
- `f` on selected session → opens followup inline prompt
- `e` exports to markdown
- `d` opens Diff tab with this session's findings
- `Delete/Backspace` removes session (with confirmation)

---

### Tab 4: DIFF (Annotated Code View)

```
┌─ MMBRIDGE ──────────────── Review  Config  Sessions  [DIFF] ─────┐
│                                                                    │
│  ┌─ FILES ───────┐  ┌─ src/api.ts ──────────────────────────┐    │
│  │               │  │                                        │    │
│  │  src/         │  │  @@ -38,8 +38,12 @@                   │    │
│  │  ● api.ts  2  │  │   export async function handler(req) { │    │
│  │  ○ utils.ts 1 │  │  -  const body = req.body;             │    │
│  │  ○ config.ts 1│  │  +  const body = await req.json();     │    │
│  │  ○ types.ts 1 │  │     ╰─  CRITICAL  Unsafe parse: no    │    │
│  │               │  │         try/catch around req.json()     │    │
│  │               │  │  +  const validated = schema.parse(body)│    │
│  │               │  │     ╰─  WARNING  schema not imported   │    │
│  │               │  │     return NextResponse.json(validated);│    │
│  │               │  │   }                                    │    │
│  │               │  │                                        │    │
│  │               │  │  @@ -52,3 +56,7 @@                   │    │
│  │               │  │   export const config = {               │    │
│  │               │  │  +  timeout: 5000,                      │    │
│  │               │  │   };                                   │    │
│  │               │  │                                        │    │
│  └───────────────┘  └────────────────────────────────────────┘    │
│                                                                    │
│  session: abc-123 (kimi) │ j/k Scroll  n/N Finding  ?Help       │
└────────────────────────────────────────────────────────────────────┘
```

**Interactions**:
- Sidebar: file tree with finding count badges
- `n/N`: jump to next/previous finding
- `j/k`: scroll diff
- Findings are inline-annotated below the relevant diff line with `╰─` connector
- Color-coded: red line for CRITICAL, yellow for WARNING, cyan for INFO, dim for REFACTOR

---

## 4. Help Overlay

`?` at any time shows a context-aware help panel:

```
┌─ KEYBOARD SHORTCUTS ─────────────────────────────────────────┐
│                                                               │
│  NAVIGATION                    ACTIONS                        │
│  1-4      Switch tab           Enter   Select / Execute       │
│  Tab      Toggle focus         e       Export to markdown      │
│  j/k      Move up/down         f       Followup prompt        │
│  h/l      Collapse/Expand      d       Open in Diff view      │
│  /        Search               Ctrl+S  Save config            │
│                                                               │
│  REVIEW TAB                    DIFF TAB                       │
│  Enter    Start review         n/N     Next/Prev finding      │
│  Shift+B  Bridge mode          j/k     Scroll diff            │
│                                                               │
│                          Press ? or Esc to close              │
└───────────────────────────────────────────────────────────────┘
```

---

## 5. Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Renderer | ink v5 | React for CLI, Flexbox layout, active maintenance |
| Components | ink + custom | Box, Text, Spinner from ink; custom Tab, Sidebar, Badge |
| State | React useReducer + context | Lightweight, no extra deps |
| Input | ink useInput + useApp | Built-in keyboard handling |
| Config I/O | @mmbridge/core loadConfig | Reuse existing config system |
| Sessions | @mmbridge/session-store | Reuse existing store |
| Git | @mmbridge/core git module | Reuse getHead, getDiff, etc. |

### Package Changes

- **Remove**: `blessed` dependency from `@mmbridge/tui`
- **Add**: `ink@^5`, `react@^18`, `ink-spinner`, `ink-text-input`
- **Keep**: `@clack/prompts` in `@mmbridge/cli` for `mmbridge init` only

### File Structure

```
packages/tui/src/
  index.tsx              ← entry: renderTui() export
  App.tsx                ← root component with tab router
  store.ts               ← TuiState + reducer
  theme.ts               ← color constants, badge styles
  components/
    Header.tsx           ← logo + tab bar
    StatusBar.tsx         ← git info + keybinds + toast
    Sidebar.tsx           ← generic list with sections
    HelpOverlay.tsx       ← ? shortcut overlay
    Badge.tsx             ← severity/status badges
    Button.tsx            ← focusable action button
    RadioGroup.tsx        ← option selector
    InlineForm.tsx        ← key-value editor
  views/
    ReviewView.tsx        ← review setup + run + results
    ConfigView.tsx        ← adapter config + settings
    SessionsView.tsx      ← session browser + detail
    DiffView.tsx          ← annotated diff viewer
```

---

## 6. Data Flow

### Review Flow

```
User selects tool + mode → Press Enter
  → dispatch({ type: 'REVIEW_START' })
  → StatusBar shows spinner
  → core.createContext() → sidebar shows file count
  → adapters.runReviewAdapter() → MainPanel streams progress
  → core.enrichFindings() + core.parseFindings()
  → dispatch({ type: 'REVIEW_COMPLETE', result })
  → MainPanel shows findings list
  → User can: e(xport), f(ollowup), d(iff)
```

### Config Flow

```
User navigates to Config tab → selects adapter
  → MainPanel shows adapter detail + test button
  → Enter on TEST → runs commandExists() + test review
  → StatusBar shows toast: "kimi: connected (1.2s)"
  → Edit fields → changes buffered in state
  → Ctrl+S → writeConfig() → toast "Config saved"
```

### Session → Diff Flow

```
User in Sessions tab → selects session → presses d
  → dispatch({ type: 'SWITCH_TAB', tab: 'diff', sessionId })
  → DiffView loads session findings + git diff
  → Sidebar shows file tree with counts
  → MainPanel shows annotated diff
```

---

## 7. Launch Command

```bash
# Interactive TUI (replaces old dashboard)
mmbridge                    # default: opens TUI
mmbridge tui                # explicit
mmbridge tui --tab review   # open directly to a tab
mmbridge tui --tab config

# Old commands still work (non-TUI)
mmbridge review --tool kimi --json    # headless review
mmbridge doctor                        # quick check
mmbridge init                          # @clack wizard
```

When `mmbridge` is run with no arguments, it launches the TUI instead of showing help. This is the "open mmbridge, do everything" principle.

---

## 8. Migration Plan

| Phase | Scope | Deliverable |
|-------|-------|-------------|
| 1 | Core shell | App + Header + StatusBar + Tab routing + theme |
| 2 | Review tab | Model list + mode select + run + results display |
| 3 | Config tab | Adapter list + detail + test + settings forms |
| 4 | Sessions tab | Filter + history list + detail + actions |
| 5 | Diff tab | File tree + annotated diff + finding navigation |
| 6 | Polish | Help overlay, toast animations, error states, edge cases |
| 7 | Cutover | Remove blessed, update exports, CLI integration |

Each phase is independently testable and committable.

---

## 9. Non-Goals (YAGNI)

- Mouse support (keyboard-first)
- Themes/customization (ship one good dark theme)
- Plugin system for TUI (not needed yet)
- Split pane / multi-window (keep it simple)
- Web-based alternative (terminal only)

---

## 10. Success Criteria

1. `mmbridge` with no args opens TUI in < 500ms
2. A vibe coder can run their first review without reading docs
3. All 4 tabs functional with keyboard-only navigation
4. Config changes persist without editing JSON files
5. Session history browsable and searchable
6. Diff view shows findings inline on relevant code lines
