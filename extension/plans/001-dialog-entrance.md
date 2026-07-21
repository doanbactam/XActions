# 001 — Dialog entrance animation

- **Status**: TODO
- **Commit**: 250125f
- **Severity**: HIGH
- **Category**: Physicality & origin
- **Estimated scope**: 1 file, ~15 lines

## Problem

The onboarding dialog (the only `Dialog` in the popup) has zero entrance animation. Both the backdrop and the popup teleport in instantly — a jarring state change on a first-run moment that should feel deliberate.

`src/popup/styles/theme.css:417-432` — current:

```css
.xa-dialog-backdrop { position: fixed; inset: 0; background: rgba(4, 2, 2, 0.72); z-index: 90; backdrop-filter: blur(2px); }
.xa-dialog-popup {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 91;
  width: 340px;
  max-height: 540px;
  overflow-y: auto;
  background: var(--xa-bg-elevated);
  border: 1px solid var(--xa-border);
  border-radius: var(--xa-radius);
  box-shadow: var(--xa-shadow);
  padding: 20px;
}
```

The dialog is centered (`transform: translate(-50%, -50%)`) — `transform-origin: center` is correct for modals (per AUDIT.md, modals are exempt from the trigger-origin rule). But there is no entrance transition at all.

## Target

Add a scale + opacity entrance using `@starting-style` (supported in Chrome 117+, which is the extension's runtime). The backdrop gets a pure opacity fade. The popup scales from 0.96 with opacity 0.

```css
/* target */
.xa-dialog-backdrop {
  position: fixed; inset: 0; background: rgba(4, 2, 2, 0.72); z-index: 90; backdrop-filter: blur(2px);
  opacity: 0;
  transition: opacity 200ms var(--xa-ease);
}
.xa-dialog-backdrop:popover-open,
.xa-dialog-backdrop[data-open] {
  opacity: 1;
}
@starting-style {
  .xa-dialog-backdrop[data-open] { opacity: 0; }
}

.xa-dialog-popup {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) scale(0.96);
  opacity: 0;
  z-index: 91;
  width: 340px;
  max-height: 540px;
  overflow-y: auto;
  background: var(--xa-bg-elevated);
  border: 1px solid var(--xa-border);
  border-radius: var(--xa-radius);
  box-shadow: var(--xa-shadow);
  padding: 20px;
  transition: transform 200ms var(--xa-ease), opacity 200ms var(--xa-ease);
}
.xa-dialog-popup[data-open] {
  transform: translate(-50%, -50%) scale(1);
  opacity: 1;
}
@starting-style {
  .xa-dialog-popup[data-open] {
    transform: translate(-50%, -50%) scale(0.96);
    opacity: 0;
  }
}
```

**Note**: Base UI's `Dialog.Popup` and `Dialog.Backdrop` render a `data-open` attribute when open. Verify the exact attribute name by checking the rendered DOM — if it's `data-open` use that; if it's something else (e.g., `[open]`), adjust accordingly.

**Fallback if `@starting-style` is not supported**: The transition will simply not play the entrance animation — the dialog will appear at its final state. This is acceptable (same as current behavior). No JS fallback needed.

## Repo conventions to follow

- Easing token: `--xa-ease: cubic-bezier(0.22, 1, 0.36, 1)` defined at `theme.css:44`
- All transitions in this codebase use `var(--xa-ease)` — follow that pattern
- Durations: UI transitions use `0.18s`–`0.22s` in this codebase; 200ms is within range
- Modals/dialogs are exempt from `transform-origin: trigger` — center is correct (AUDIT.md §3)

## Steps

1. Open `src/popup/styles/theme.css`.
2. Find `.xa-dialog-backdrop` at line 417. Replace it with the target version above (adds `opacity: 0`, `transition`, `[data-open]` rule, and `@starting-style` block).
3. Find `.xa-dialog-popup` at line 418. Replace it with the target version above (adds `scale(0.96)`, `opacity: 0`, `transition`, `[data-open]` rule, and `@starting-style` block).
4. Verify the `@starting-style` blocks are placed AFTER the `[data-open]` rules (CSS requires `@starting-style` to reference the final state).

## Boundaries

- Do NOT touch `OnboardingDialog.tsx` — markup stays the same.
- Do NOT change the dialog's `width`, `max-height`, `padding`, or `background`.
- Do NOT add JS-driven animation (no `useEffect`, no `requestAnimationFrame`).
- Do NOT add new dependencies.
- If the `data-open` attribute name doesn't match what Base UI renders, STOP and report — do not guess.

## Verification

- **Mechanical**: `cd extension && npm run check` — expect "Popup type-check passed" and "Popup bundle built".
- **Feel check**: Load the extension (`chrome://extensions` → Load unpacked). Trigger the onboarding dialog by setting `firstRun: true` in `chrome.storage.local` and reopening the popup.
  - The backdrop should fade in over ~200ms (not instant).
  - The popup should scale up from 0.96 to 1.0 while fading in — subtle, not bouncy.
  - In DevTools → Animations panel, set playback to 10% and confirm the scale starts at 0.96 (not 0) and the opacity ramps smoothly.
  - Toggle `prefers-reduced-motion` in DevTools → Rendering panel. The dialog should still appear (opacity-only, no scale movement) — this will be handled by plan 005.
- **Done when**: The dialog entrance plays a scale(0.96)→1 + opacity 0→1 transition over 200ms with `--xa-ease`, and the backdrop fades in over the same duration.
