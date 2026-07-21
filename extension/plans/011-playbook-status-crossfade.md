# 011 — Playbook step status crossfade

- **Status**: TODO
- **Commit**: 250125f
- **Severity**: LOW
- **Category**: Missed opportunity
- **Estimated scope**: 1 file, ~3 lines

## Problem

When a playbook step completes or fails during execution, the status icon (`.xa-step-status`) swaps instantly — no color crossfade. The step goes from pending to done/failed with a jarring icon teleport.

`src/popup/styles/theme.css:548` — current:

```css
.xa-step-status { font-size: 12px; flex-shrink: 0; }
```

No transition. The status icon (emoji like ⏳→✅→❌) changes instantly when `step.status` updates in React.

`src/popup/components/agent/PlaybookCard.tsx` renders the status. The status text/emoji is set based on `step.status` — it's a content change, not a class change, so we can't transition the content itself. But we CAN transition the opacity of the status element when it re-renders.

## Target

Add a subtle opacity transition on `.xa-step-status` to soften the icon swap:

```css
/* target */
.xa-step-status {
  font-size: 12px;
  flex-shrink: 0;
  opacity: 1;
  transition: opacity 150ms var(--xa-ease);
}
```

**Why this works**: When React re-renders the step with a new status, the `.xa-step-status` element's text content changes. The `transition: opacity` won't animate the content change itself, but if the element briefly flashes (e.g., via React's reconciliation), the opacity transition will smooth it out.

**Better approach (requires JS)**: Add a `key={step.status}` to the status element so React remounts it on status change, then use `@starting-style`:

```tsx
<span className="xa-step-status" key={step.status}>
  {statusIcon}
</span>
```

With CSS:
```css
.xa-step-status {
  font-size: 12px;
  flex-shrink: 0;
  opacity: 1;
  transition: opacity 150ms var(--xa-ease);
}
@starting-style {
  .xa-step-status {
    opacity: 0;
  }
}
```

The `key={step.status}` forces React to remount the element when the status changes, which triggers `@starting-style` for a clean fade-in of the new icon.

## Repo conventions to follow

- Easing token: `--xa-ease: cubic-bezier(0.22, 1, 0.36, 1)` at `theme.css:44`
- AUDIT.md §2: 150ms for small status changes (within 125–200ms range)
- AUDIT.md §8: "State changes that teleport where a brief transition would prevent a jarring change"

## Steps

1. Open `src/popup/styles/theme.css`.
2. Find `.xa-step-status` at line 548. Add `opacity: 1; transition: opacity 150ms var(--xa-ease);` to the rule.
3. Immediately after the `.xa-step-status` rule, add:
   ```css
   @starting-style {
     .xa-step-status {
       opacity: 0;
     }
   }
   ```
4. Open `src/popup/components/agent/PlaybookCard.tsx`. Find the step status rendering. Add `key={step.status}` to the `.xa-step-status` span element to force remount on status change.

**Note**: Read `PlaybookCard.tsx` to find the exact line where `.xa-step-status` is rendered. The current code at commit `250125f` renders it as `<span className="xa-step-status">...</span>` — add `key={step.status}` to that span.

## Boundaries

- Do NOT change the status icons themselves (emojis stay the same).
- Do NOT add `transform` or `scale` — opacity-only is enough for a status icon swap.
- Do NOT change the step layout, padding, or border.
- Do NOT add new dependencies.
- If `PlaybookCard.tsx` doesn't render `.xa-step-status` as expected (drift since commit), STOP and report.

## Verification

- **Mechanical**: `cd extension && npm run check` — expect "Popup type-check passed" and "Popup bundle built".
- **Feel check**: Load the extension. Go to the Plan tab. Run a strategy analysis → execute the playbook.
  - When a step transitions from pending to done, the status icon should fade in over ~150ms (not instant swap).
  - When a step fails, the error icon should fade in similarly.
  - In DevTools → Animations panel, set playback to 10% and confirm the opacity ramps from 0 to 1 on the status icon.
  - Toggle `prefers-reduced-motion` — the opacity transition should still play (comprehension aid, per plan 005).
- **Done when**: The `.xa-step-status` element fades in over 150ms with `--xa-ease` when the step status changes, using `key={step.status}` + `@starting-style`.
