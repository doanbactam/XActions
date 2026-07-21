# 003 — Press feedback on all buttons

- **Status**: TODO
- **Commit**: 250125f
- **Severity**: MEDIUM
- **Category**: Physicality & origin
- **Estimated scope**: 1 file, ~5 lines

## Problem

The shared button rule declares `transform 0.1s` in its transition but has no `:active` rule to trigger it. Only `.xa-icon-btn:active` has press feedback (`scale(0.94)`). All other buttons — primary, secondary, danger, quiet, small, sm, send — have zero press feedback.

`src/popup/styles/theme.css:264-275` — current shared button rule:

```css
.xa-btn-primary,
.xa-btn-secondary,
.xa-btn-danger,
.xa-btn-quiet,
.xa-btn-small,
.xa-btn-sm {
  font-family: inherit;
  cursor: pointer;
  border-radius: var(--xa-radius-sm);
  border: 1px solid var(--xa-border);
  transition: background 0.18s var(--xa-ease), border-color 0.18s, color 0.18s, box-shadow 0.18s, transform 0.1s;
}
```

The `transform 0.1s` is declared but never used by these buttons. Compare with `.xa-icon-btn:active` at line 158 which correctly does:

```css
.xa-icon-btn:active { transform: scale(0.94); }
```

Also, `.xa-btn-send` at line 565 has no transition at all and no press feedback.

## Target

Add a shared `:active` rule for all buttons. Per AUDIT.md §3: "Press feedback: `transform: scale(0.97)` on `:active` with `transition: transform 160ms ease-out`. Keep it subtle (0.95–0.98)."

The existing `transform 0.1s` (100ms) is close to the 160ms target — update it to `0.16s` and add the easing token:

```css
/* target — update the shared transition */
.xa-btn-primary,
.xa-btn-secondary,
.xa-btn-danger,
.xa-btn-quiet,
.xa-btn-small,
.xa-btn-sm {
  font-family: inherit;
  cursor: pointer;
  border-radius: var(--xa-radius-sm);
  border: 1px solid var(--xa-border);
  transition: background 0.18s var(--xa-ease), border-color 0.18s, color 0.18s, box-shadow 0.18s, transform 0.16s var(--xa-ease);
}

/* add after the shared rule */
.xa-btn-primary:active,
.xa-btn-secondary:active,
.xa-btn-danger:active,
.xa-btn-quiet:active,
.xa-btn-small:active,
.xa-btn-sm:active {
  transform: scale(0.97);
}
```

For `.xa-btn-primary`, the `:hover` rule at line 286 sets `transform: translateY(-1px)`. The `:active` rule will override this — the button settles down and shrinks. This is correct behavior.

For `.xa-btn-send` at line 565, add transition and press feedback:

```css
/* target — update .xa-btn-send */
.xa-btn-send {
  width: 32px; height: 32px; border-radius: var(--xa-radius-xs);
  border: 1px solid rgba(181, 42, 56, 0.6);
  background: linear-gradient(160deg, var(--xa-accent-bright), var(--xa-accent));
  color: #fff; font-size: 14px; cursor: pointer; flex-shrink: 0;
  transition: box-shadow 0.18s var(--xa-ease), transform 0.16s var(--xa-ease);
}
.xa-btn-send:active { transform: scale(0.97); }
```

## Repo conventions to follow

- `.xa-icon-btn:active { transform: scale(0.94) }` at `theme.css:158` is the existing exemplar — note it uses 0.94 (more pronounced for icon buttons, which is fine)
- Easing token: `--xa-ease` at `theme.css:44`
- AUDIT.md §3: press feedback `scale(0.97)` with `transition: transform 160ms ease-out`

## Steps

1. Open `src/popup/styles/theme.css`.
2. Find the shared button transition at line 274. Change `transform 0.1s` to `transform 0.16s var(--xa-ease)`.
3. Immediately after the closing `}` of the shared button rule (after line 275), add the `:active` rule with `transform: scale(0.97)` for all six button classes.
4. Find `.xa-btn-send` at line 565. Add `transition: box-shadow 0.18s var(--xa-ease), transform 0.16s var(--xa-ease);` to the rule.
5. Immediately after `.xa-btn-send`, add `.xa-btn-send:active { transform: scale(0.97); }`.

## Boundaries

- Do NOT change the `:hover` rules — they stay as-is.
- Do NOT change `transform: translateY(-1px)` on `.xa-btn-primary:hover` — the `:active` override is correct.
- Do NOT touch `.xa-icon-btn` — it already has press feedback.
- Do NOT change button colors, padding, or border-radius.
- Do NOT add new dependencies.

## Verification

- **Mechanical**: `cd extension && npm run check` — expect "Popup type-check passed" and "Popup bundle built".
- **Feel check**: Load the extension. Open the popup.
  - Click any primary button ("Bắt đầu" in onboarding, "Đăng nhập xAI" in config). It should shrink to 97% on press and spring back on release.
  - Click a secondary button ("Test Grok", "Lưu cài đặt"). Same press feedback.
  - Click the send button (↑ in chat drawer). Same press feedback.
  - Click a small button ("Clear" in log tab). Same press feedback.
  - In DevTools → Animations panel, set playback to 10% and confirm the scale goes to 0.97 (not 0.94 — that's for icon buttons only) and returns to 1.0.
  - Press and hold a primary button — confirm the `translateY(-1px)` hover lift is replaced by `scale(0.97)` on active (the button settles down).
- **Done when**: All buttons (primary, secondary, danger, quiet, small, sm, send) have `:active { transform: scale(0.97) }` with a 160ms transition.
