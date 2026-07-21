# 009 — Duration tokens + easing consistency

- **Status**: TODO
- **Commit**: 250125f
- **Severity**: LOW
- **Category**: Cohesion & tokens
- **Estimated scope**: 1 file, ~20 lines (mostly find-and-replace)

## Problem

Durations are hardcoded across 6 locations: `0.18s`, `0.1s`, `0.2s`, `0.22s`. The `transform 0.1s` on lines 155 and 274 has no easing token — it defaults to the CSS `ease` keyword, which is inconsistent with the rest of the codebase that uses `var(--xa-ease)`.

`src/popup/styles/theme.css:44` — current tokens:

```css
--xa-ease: cubic-bezier(0.22, 1, 0.36, 1);
```

Hardcoded durations:
- Line 155: `transform 0.1s` (no easing)
- Line 251: `color 0.18s var(--xa-ease), border-color 0.18s var(--xa-ease)`
- Line 274: `transform 0.1s` (no easing)
- Line 339: `border-color 0.18s var(--xa-ease), box-shadow 0.18s`
- Line 454: `transition: height 0.2s` (no easing)
- Line 584: `animation: xa-toast-in 0.22s var(--xa-ease)`

## Target

Add duration tokens to `:root` and replace all hardcoded durations:

```css
/* target — add to :root after --xa-ease */
--xa-ease: cubic-bezier(0.22, 1, 0.36, 1);
--xa-dur-fast: 100ms;    /* press feedback, micro-interactions */
--xa-dur-ui: 180ms;      /* standard UI transitions (hover, focus, tabs) */
--xa-dur-enter: 220ms;   /* entrances (toast, dialog, select) */
```

Then replace all hardcoded durations:

| Location | Current | Target |
|---|---|---|
| Line 155 (icon-btn) | `transform 0.1s` | `transform var(--xa-dur-fast) var(--xa-ease)` |
| Line 251 (tabs) | `0.18s var(--xa-ease)` | `var(--xa-dur-ui) var(--xa-ease)` |
| Line 274 (buttons) | `transform 0.1s` | `transform var(--xa-dur-fast) var(--xa-ease)` |
| Line 339 (inputs) | `0.18s var(--xa-ease), box-shadow 0.18s` | `var(--xa-dur-ui) var(--xa-ease), box-shadow var(--xa-dur-ui)` |
| Line 454 (chart) | `height 0.2s` | `transform var(--xa-dur-ui) var(--xa-ease)` (if plan 008 is applied) or `height var(--xa-dur-ui) var(--xa-ease)` |
| Line 584 (toast) | `0.22s var(--xa-ease)` | `var(--xa-dur-enter) var(--xa-ease)` |

**Note**: If plan 003 (button press feedback) is already applied, the `transform 0.16s` on line 274 should become `transform var(--xa-dur-fast) var(--xa-ease)` — but 160ms ≠ 100ms. Either:
- Add `--xa-dur-press: 160ms` token, or
- Change `--xa-dur-fast` to `160ms` (since press feedback is the only use of the "fast" duration)

**Recommended**: Use `--xa-dur-fast: 160ms` since press feedback is the primary consumer, and the icon-btn's `0.1s` can be updated to `var(--xa-dur-fast)` (160ms is still fast enough for an icon button press).

## Repo conventions to follow

- The existing `--xa-ease` token at `theme.css:44` is the pattern — all motion values should live as tokens in `:root`
- AUDIT.md §7: "Curves and durations should live as shared tokens. Five hand-typed cubic-beziers that almost match is a consolidation finding."

## Steps

1. Open `src/popup/styles/theme.css`.
2. Find `:root` at line 14. After `--xa-ease` (line 44), add:
   ```css
   --xa-dur-fast: 160ms;
   --xa-dur-ui: 180ms;
   --xa-dur-enter: 220ms;
   ```
3. Find line 155 (`.xa-icon-btn` transition). Replace `transform 0.1s` with `transform var(--xa-dur-fast) var(--xa-ease)`.
4. Find line 251 (`.xa-tab` transition). Replace `0.18s` with `var(--xa-dur-ui)`.
5. Find line 274 (shared button transition). Replace `0.18s` with `var(--xa-dur-ui)` and `transform 0.1s` (or `0.16s` if plan 003 applied) with `transform var(--xa-dur-fast) var(--xa-ease)`.
6. Find line 339 (`.xa-input` transition). Replace `0.18s` with `var(--xa-dur-ui)`. Add `var(--xa-ease)` to the `box-shadow` transition if missing.
7. Find line 454 (`.xa-log-chart-bar`). Replace `0.2s` with `var(--xa-dur-ui)` and add `var(--xa-ease)`.
8. Find line 584 (`.xa-toast`). Replace `0.22s` with `var(--xa-dur-enter)`.

## Boundaries

- Do NOT change the actual duration values — only replace hardcoded values with tokens that resolve to the same (or very close) value.
- Do NOT add new easing curves — only consolidate durations.
- Do NOT touch component TSX files.
- Do NOT add new dependencies.
- If a line has already been modified by another plan (e.g., plan 003 changed `0.1s` to `0.16s`), use the token that matches the current value.

## Verification

- **Mechanical**: `cd extension && npm run check` — expect "Popup type-check passed" and "Popup bundle built".
- **Feel check**: Load the extension. Open the popup.
  - Hover tabs, buttons, inputs — transitions should feel identical to before (same durations, same easing).
  - Press a button — press feedback should feel identical.
  - If a toast appears — entrance should feel identical.
  - In DevTools → Elements panel, inspect a button and confirm the computed `transition-duration` resolves to `0.16s` or `0.18s` (from the token).
- **Done when**: All hardcoded durations in `theme.css` are replaced with `var(--xa-dur-fast)`, `var(--xa-dur-ui)`, or `var(--xa-dur-enter)` tokens, and all `transform` transitions include `var(--xa-ease)`.
