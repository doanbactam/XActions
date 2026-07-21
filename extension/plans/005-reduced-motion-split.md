# 005 — prefers-reduced-motion: keep feedback, drop movement

- **Status**: TODO
- **Commit**: 250125f
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Estimated scope**: 1 file, ~10 lines

## Problem

The `prefers-reduced-motion` media query nukes ALL transitions and animations to 0.001s — including color, background, and border-color transitions that aid comprehension. Per AUDIT.md §6: "Reduced motion means fewer and gentler animations, not zero — keep transitions that aid comprehension, remove position changes."

`src/popup/styles/theme.css:597-599` — current:

```css
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.001s !important; transition-duration: 0.001s !important; }
}
```

This removes ALL feedback — buttons won't show color changes on hover, tabs won't show border-color transitions, inputs won't show focus ring transitions. The user gets zero visual feedback for interactions.

## Target

Split the reduced-motion handling: keep `color`, `background`, `background-color`, `border-color`, `box-shadow`, and `opacity` transitions (comprehension aids). Only zero out `transform`, `translate`, `scale`, `rotate`, and `animation` (position changes).

```css
/* target */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.001s !important;
    animation-iteration-count: 1 !important;
    transition-property: color, background-color, border-color, box-shadow, opacity !important;
    transition-duration: 0.18s !important;
  }
}
```

This keeps color/border/opacity transitions at the normal 180ms duration, but drops all `transform`-based movement and keyframe animations. The `animation-iteration-count: 1` ensures any keyframes that remain run once (not looping).

**Note**: The `transition-property` override restricts which properties transition — `transform` is excluded, so any `transform` changes will be instant. This is the correct behavior for reduced motion.

## Repo conventions to follow

- Duration: `0.18s` is the standard UI transition duration in this codebase (used on lines 155, 251, 274, 339)
- The `*` selector is already used in the current reduced-motion rule — follow the same pattern
- AUDIT.md §6: "keep transitions that aid comprehension, remove position changes"

## Steps

1. Open `src/popup/styles/theme.css`.
2. Find the `@media (prefers-reduced-motion: reduce)` block at line 597.
3. Replace the entire block with the target version above.
4. Verify the block is still at the end of the file (after all other rules).

## Boundaries

- Do NOT change any transitions outside this media query — the base transitions stay as-is.
- Do NOT add `will-change` or `contain` properties.
- Do NOT touch any component TSX files.
- Do NOT add new dependencies.

## Verification

- **Mechanical**: `cd extension && npm run check` — expect "Popup type-check passed" and "Popup bundle built".
- **Feel check**: Load the extension. Open DevTools → Rendering panel → set "Emulate CSS media feature prefers-reduced-motion" to `reduce`.
  - Hover a tab — the text color and border-color should still transition (180ms, visible).
  - Hover a primary button — the box-shadow should still transition (color feedback remains).
  - Focus an input — the border-color and box-shadow (focus ring) should still transition.
  - Press a button — the `transform: scale(0.97)` should NOT animate (instant snap, no movement).
  - If a toast appears — it should fade in (opacity transition) but NOT slide down (transform is dropped).
  - If a dialog opens — it should fade in (opacity) but NOT scale up (transform is dropped).
  - Toggle reduced-motion back to `no-preference` — all movement should return.
- **Done when**: Under `prefers-reduced-motion: reduce`, color/background/border/opacity transitions still play at 180ms, but all `transform`-based movement and keyframe animations are instant.
