# 004 — Toast interruptibility (replace keyframes with transition)

- **Status**: TODO
- **Commit**: 250125f
- **Severity**: MEDIUM
- **Category**: Interruptibility
- **Estimated scope**: 1 file, ~15 lines

## Problem

The toast entrance uses `@keyframes`, which restart from zero every time a new toast mounts. When toasts stack rapidly (e.g., starting multiple automations triggers multiple success toasts), each new toast's keyframe restarts from `opacity: 0; translateY(-6px)` — a visible jump if the previous toast hasn't finished animating.

`src/popup/styles/theme.css:584` — current:

```css
.xa-toast {
  /* ... */
  animation: xa-toast-in 0.22s var(--xa-ease);
}
```

`src/popup/styles/theme.css:592-595` — current keyframes:

```css
@keyframes xa-toast-in {
  from { opacity: 0; transform: translateY(-6px); }
  to { opacity: 1; transform: translateY(0); }
}
```

CSS transitions retarget from the current state mid-animation; keyframes restart from zero. Toasts are rapidly-triggered UI that must be interruptible (AUDIT.md §4).

## Target

Replace the `@keyframes` animation with a CSS `transition` + `@starting-style` for entry. The toast starts at `opacity: 0; transform: translateY(-6px)` and transitions to `opacity: 1; transform: translateY(0)`.

```css
/* target */
.xa-toast {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border-radius: var(--xa-radius-sm);
  background: var(--xa-bg-elevated);
  border: 1px solid var(--xa-border);
  box-shadow: var(--xa-shadow);
  font-size: 11.5px;
  color: var(--xa-ink);
  pointer-events: auto;
  opacity: 1;
  transform: translateY(0);
  transition: opacity 220ms var(--xa-ease), transform 220ms var(--xa-ease);
}

@starting-style {
  .xa-toast {
    opacity: 0;
    transform: translateY(-6px);
  }
}
```

Then **delete** the `@keyframes xa-toast-in` block entirely (lines 592-595).

**Note**: `@starting-style` is supported in Chrome 117+. The extension runs in Chrome, so this is safe. If `@starting-style` is not supported, the toast will appear at its final state with no animation — acceptable fallback (same as no animation, which is better than a jarring restart).

**Base UI Toast mounting**: Base UI's `Toast.Root` renders the toast element when it mounts. The `@starting-style` rule will apply on first render. Verify that the toast element gets the `@starting-style` transition by checking DevTools → Animations panel.

## Repo conventions to follow

- Easing token: `--xa-ease: cubic-bezier(0.22, 1, 0.36, 1)` at `theme.css:44`
- Duration: 220ms (current toast duration is 0.22s — keep it)
- The `translateY(-6px)` distance is already defined in the keyframe — preserve it

## Steps

1. Open `src/popup/styles/theme.css`.
2. Find `.xa-toast` at line 572. Replace the `animation: xa-toast-in 0.22s var(--xa-ease);` line with:
   ```
   opacity: 1;
   transform: translateY(0);
   transition: opacity 220ms var(--xa-ease), transform 220ms var(--xa-ease);
   ```
3. Immediately after the `.xa-toast` rules (after the `data-kind` and icon/msg rules, around line 590), add the `@starting-style` block:
   ```css
   @starting-style {
     .xa-toast {
       opacity: 0;
       transform: translateY(-6px);
     }
   }
   ```
4. **Delete** the `@keyframes xa-toast-in` block at lines 592-595.

## Boundaries

- Do NOT touch `ToastProvider.tsx` — no JS changes needed.
- Do NOT change the toast viewport positioning (`.xa-toast-viewport`).
- Do NOT change toast colors, padding, or border-radius.
- Do NOT add new dependencies.
- If `@starting-style` doesn't trigger on Base UI's Toast component, STOP and report — the fallback is no entrance animation (acceptable).

## Verification

- **Mechanical**: `cd extension && npm run check` — expect "Popup type-check passed" and "Popup bundle built".
- **Feel check**: Load the extension. Trigger multiple toasts rapidly:
  - Go to the Log tab and click "Clear" (triggers a toast). Immediately click "Clear" again (if possible) or trigger another action that shows a toast.
  - Alternatively, start an automation and immediately stop it — two toasts should fire in quick succession.
  - Confirm each toast slides in from -6px with a smooth 220ms transition.
  - Spam toasts: if a new toast appears while the previous one is still animating in, the new toast should start from its own `@starting-style` state (opacity 0, translateY -6px) — NOT restart a keyframe from zero (which would cause a visible jump if the element was already partially visible).
  - In DevTools → Animations panel, set playback to 10% and confirm the toast fades in and slides down smoothly.
  - Toggle `prefers-reduced-motion` in DevTools → Rendering panel. The toast should appear without movement (opacity-only, per plan 005).
- **Done when**: The toast entrance uses `transition` + `@starting-style` instead of `@keyframes`, and the `@keyframes xa-toast-in` block is deleted.
