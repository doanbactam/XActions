# 002 — Select popup transform-origin + entrance

- **Status**: TODO
- **Commit**: 250125f
- **Severity**: HIGH
- **Category**: Physicality & origin
- **Estimated scope**: 1 file, ~12 lines

## Problem

The Base UI Select popup (`.xa-select-popup`) has no `transform-origin` and no entrance animation. When a dropdown opens, it appears instantly from nowhere — no scale, no fade, no origin. Dropdowns should scale from their trigger, not from center.

`src/popup/styles/theme.css:376-385` — current:

```css
.xa-select-positioner { z-index: 60; }
.xa-select-popup {
  background: var(--xa-bg-elevated);
  border: 1px solid var(--xa-border);
  border-radius: var(--xa-radius-sm);
  box-shadow: var(--xa-shadow);
  padding: 4px;
  min-width: 140px;
  max-height: 240px;
  overflow-y: auto;
}
```

Base UI sets a `--transform-origin` CSS variable on the positioned popup element (equivalent to Radix's `--radix-popover-content-transform-origin`). Without referencing it, any scale animation would default to `center`.

## Target

Add `transform-origin: var(--transform-origin)` and a `scale(0.96) + opacity:0 → 1` entrance using `@starting-style`:

```css
/* target */
.xa-select-positioner { z-index: 60; }
.xa-select-popup {
  background: var(--xa-bg-elevated);
  border: 1px solid var(--xa-border);
  border-radius: var(--xa-radius-sm);
  box-shadow: var(--xa-shadow);
  padding: 4px;
  min-width: 140px;
  max-height: 240px;
  overflow-y: auto;
  transform-origin: var(--transform-origin, center);
  transform: scale(0.96);
  opacity: 0;
  transition: transform 180ms var(--xa-ease), opacity 180ms var(--xa-ease);
}
.xa-select-popup[data-open] {
  transform: scale(1);
  opacity: 1;
}
@starting-style {
  .xa-select-popup[data-open] {
    transform: scale(0.96);
    opacity: 0;
  }
}
```

**Note**: Base UI's `Select.Popup` renders a `data-open` attribute when open. Verify the exact attribute name by inspecting the rendered DOM in DevTools. If it uses a different attribute (e.g., `[data-starting-style]` or a class), adjust accordingly.

The `--transform-origin` variable is set by Base UI's positioning logic on the popup's container. The fallback `center` ensures no breakage if the variable is unset.

## Repo conventions to follow

- Easing token: `--xa-ease: cubic-bezier(0.22, 1, 0.36, 1)` at `theme.css:44`
- All transitions use `var(--xa-ease)` — follow that pattern
- Duration: 180ms is within the 150–250ms range for dropdowns (AUDIT.md §2)
- `scale(0.96)` is within the 0.9–0.97 range (AUDIT.md §3)

## Steps

1. Open `src/popup/styles/theme.css`.
2. Find `.xa-select-popup` at line 376. Replace the entire rule with the target version above.
3. Add the `[data-open]` rule and `@starting-style` block immediately after.
4. Verify in DevTools that `--transform-origin` is set on the popup element when a Select is opened. If the variable name is different (e.g., `--base-ui-transform-origin`), update the `var()` reference.

## Boundaries

- Do NOT touch `ConfigPanel.tsx`, `ActivityTab.tsx`, or any component that uses Select — markup stays the same.
- Do NOT change the popup's `background`, `border`, `padding`, `min-width`, or `max-height`.
- Do NOT add JS-driven animation.
- Do NOT add new dependencies.
- If `--transform-origin` is not provided by Base UI, use the fallback `center` and note it in the plan — the scale animation still works, just from center.

## Verification

- **Mechanical**: `cd extension && npm run check` — expect "Popup type-check passed" and "Popup bundle built".
- **Feel check**: Load the extension. Open the popup. Go to the Plan tab → click the "Grok" config button → open the Provider or Model select dropdown.
  - The dropdown should scale up from 0.96 to 1.0, originating from the trigger button (not from center).
  - The opacity should fade in simultaneously over ~180ms.
  - Open and close the dropdown rapidly — the transition should retarget smoothly (no restart from zero, since this is a `transition` not `@keyframes`).
  - In DevTools → Animations panel, set playback to 10% and confirm the scale origin is at the trigger, not center.
  - Toggle `prefers-reduced-motion` in DevTools → Rendering panel. The dropdown should appear without scaling (opacity-only).
- **Done when**: The select popup scales from 0.96→1 with `transform-origin: var(--transform-origin)` over 180ms with `--xa-ease`, and the origin is at the trigger, not center.
