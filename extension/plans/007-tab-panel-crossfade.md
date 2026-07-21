# 007 — Tab panel crossfade

- **Status**: TODO
- **Commit**: 250125f
- **Severity**: MEDIUM
- **Category**: Missed opportunity
- **Estimated scope**: 1 file, ~8 lines

## Problem

When switching between the 3 tabs (Plan · Log · Cài đặt), the panel content swaps instantly — no crossfade, no transition. The old tab content disappears and the new content teleports in. This is a jarring state change that happens 100+ times/day.

`src/popup/styles/theme.css:256-259` — current:

```css
.xa-tabs-panel { flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; }
.xa-tabs-panel[hidden] { display: none; }

.xa-tab-content { flex: 1; min-height: 0; overflow-y: auto; padding: 12px 14px 16px; }
```

Base UI's `Tabs.Panel` sets `[hidden]` on inactive panels. The active panel appears instantly.

## Target

Add a subtle opacity entrance on the tab content using `@starting-style`:

```css
/* target */
.xa-tabs-panel { flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; }
.xa-tabs-panel[hidden] { display: none; }

.xa-tab-content {
  flex: 1; min-height: 0; overflow-y: auto; padding: 12px 14px 16px;
  opacity: 1;
  transition: opacity 150ms var(--xa-ease);
}

@starting-style {
  .xa-tab-content {
    opacity: 0;
  }
}
```

**Why 150ms**: Tab switching is high-frequency (100+/day). Per AUDIT.md §2, tooltips/small popovers are 125–200ms. 150ms is fast enough to not slow down the user, but smooth enough to prevent the jarring teleport. The opacity-only transition avoids any layout or transform work — it's the cheapest possible crossfade.

**Why not a full crossfade (old fades out + new fades in)**: Base UI's `Tabs.Panel` uses `[hidden]` (display: none) on inactive panels. You can't transition from `display: none`. The `@starting-style` approach only animates the entering panel — the old panel just disappears. This is the standard pattern for tab panels and feels fine with a fast 150ms fade.

## Repo conventions to follow

- Easing token: `--xa-ease: cubic-bezier(0.22, 1, 0.36, 1)` at `theme.css:44`
- AUDIT.md §2: tooltips/small popovers 125–200ms — 150ms is within range
- AUDIT.md §8: "State changes that teleport where a brief transition would prevent a jarring change"

## Steps

1. Open `src/popup/styles/theme.css`.
2. Find `.xa-tab-content` at line 259. Add `opacity: 1;` and `transition: opacity 150ms var(--xa-ease);` to the rule.
3. Immediately after the `.xa-tab-content` rule, add the `@starting-style` block:
   ```css
   @starting-style {
     .xa-tab-content {
       opacity: 0;
     }
   }
   ```

## Boundaries

- Do NOT add `transform` or `translateY` to the tab content — opacity-only is the cheapest and least jarring for high-frequency tab switches.
- Do NOT change the `[hidden]` rule — `display: none` must stay for inactive panels.
- Do NOT touch `App.tsx` or any tab component — markup stays the same.
- Do NOT add new dependencies.
- If `@starting-style` doesn't trigger on Base UI's `Tabs.Panel`, STOP and report.

## Verification

- **Mechanical**: `cd extension && npm run check` — expect "Popup type-check passed" and "Popup bundle built".
- **Feel check**: Load the extension. Open the popup.
  - Click the "Log" tab — the log content should fade in over ~150ms (not instant).
  - Click "Cài đặt" — same fade.
  - Click "Plan" — same fade.
  - Switch tabs rapidly (Plan → Log → Plan → Log) — each switch should show a quick fade-in. It should NOT feel slow or laggy.
  - In DevTools → Animations panel, set playback to 10% and confirm the opacity ramps from 0 to 1 smoothly.
  - Toggle `prefers-reduced-motion` — the opacity transition should still play (it's a comprehension aid, per plan 005).
- **Done when**: Tab panel content fades in over 150ms with `--xa-ease` on every tab switch, using `@starting-style` for the entry.
