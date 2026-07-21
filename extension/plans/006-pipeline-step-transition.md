# 006 — Pipeline step state transition

- **Status**: TODO
- **Commit**: 250125f
- **Severity**: MEDIUM
- **Category**: Missed opportunity
- **Estimated scope**: 1 file, ~3 lines

## Problem

The pipeline progress indicator (`.xa-pipe`) changes state instantly — when the stage advances from setup→analyze→playbook→run, the `.xa-pipe-num` background and color swap with no transition. This is a jarring teleport on a progress indicator that should feel like it's flowing forward.

`src/popup/styles/theme.css:497-504` — current:

```css
.xa-pipeline { display: flex; list-style: none; gap: 4px; margin-bottom: 14px; }
.xa-pipe { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 2px; border-radius: var(--xa-radius-sm); border: 1px solid var(--xa-border-soft); background: var(--xa-bg-card); }
.xa-pipe-num { width: 18px; height: 18px; border-radius: 50%; display: grid; place-items: center; font-size: 10px; font-weight: 700; background: var(--xa-bg-soft); color: var(--xa-ink-3); }
.xa-pipe-label { font-size: 9px; color: var(--xa-ink-3); text-align: center; }
.xa-pipe.is-active { border-color: rgba(182, 144, 79, 0.5); }
.xa-pipe.is-active .xa-pipe-num { background: var(--xa-accent); color: #fff; }
.xa-pipe.is-active .xa-pipe-label { color: var(--xa-ink); }
.xa-pipe.is-done .xa-pipe-num { background: var(--xa-success-soft); color: var(--xa-success); }
```

The `.xa-pipe-num` has no `transition` — the `background` and `color` change instantly when `.is-active` or `.is-done` classes are added.

## Target

Add a `transition` on `.xa-pipe-num` for `background` and `color`:

```css
/* target — update .xa-pipe-num */
.xa-pipe-num {
  width: 18px; height: 18px; border-radius: 50%;
  display: grid; place-items: center;
  font-size: 10px; font-weight: 700;
  background: var(--xa-bg-soft); color: var(--xa-ink-3);
  transition: background 200ms var(--xa-ease), color 200ms var(--xa-ease);
}
```

Also add a transition on `.xa-pipe` for the `border-color` change:

```css
/* target — update .xa-pipe */
.xa-pipe {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 8px 2px; border-radius: var(--xa-radius-sm);
  border: 1px solid var(--xa-border-soft); background: var(--xa-bg-card);
  transition: border-color 200ms var(--xa-ease);
}
```

And on `.xa-pipe-label` for the color change:

```css
/* target — update .xa-pipe-label */
.xa-pipe-label { font-size: 9px; color: var(--xa-ink-3); text-align: center; transition: color 200ms var(--xa-ease); }
```

## Repo conventions to follow

- Easing token: `--xa-ease: cubic-bezier(0.22, 1, 0.36, 1)` at `theme.css:44`
- Duration: 200ms — within the 150–250ms range for UI state changes (AUDIT.md §2)
- Color/background transitions are comprehension aids — they should animate, not teleport

## Steps

1. Open `src/popup/styles/theme.css`.
2. Find `.xa-pipe` at line 498. Add `transition: border-color 200ms var(--xa-ease);` to the rule.
3. Find `.xa-pipe-num` at line 499. Add `transition: background 200ms var(--xa-ease), color 200ms var(--xa-ease);` to the rule.
4. Find `.xa-pipe-label` at line 500. Add `transition: color 200ms var(--xa-ease);` to the rule.

## Boundaries

- Do NOT change the `.is-active` or `.is-done` rules — they stay as-is.
- Do NOT add `transform` or `scale` to the pipeline — this is a color/border transition only.
- Do NOT touch `PipelineSteps.tsx` — markup stays the same.
- Do NOT add new dependencies.

## Verification

- **Mechanical**: `cd extension && npm run check` — expect "Popup type-check passed" and "Popup bundle built".
- **Feel check**: Load the extension. Go to the Plan tab.
  - The pipeline shows 4 steps: Grok → Phân tích → Kịch bản → Chạy.
  - If you have xAI OAuth signed in, the stage should advance from "setup" to "analyze". Watch the first step's number circle — the background should transition from `--xa-bg-soft` to `--xa-success-soft` (done state) over ~200ms, and the second step's number should transition to `--xa-accent` (active state).
  - If you can't trigger a stage change naturally, add a temporary `console.log` or use React DevTools to force a stage change.
  - In DevTools → Animations panel, set playback to 10% and confirm the background color crossfades smoothly.
  - Toggle `prefers-reduced-motion` — the color transitions should still play (they're comprehension aids, per plan 005).
- **Done when**: The `.xa-pipe-num` background/color and `.xa-pipe` border-color transition over 200ms with `--xa-ease` when the active/done state changes.
