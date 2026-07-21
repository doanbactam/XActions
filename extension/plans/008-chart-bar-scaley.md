# 008 — Chart bar: use scaleY instead of height

- **Status**: TODO
- **Commit**: 250125f
- **Severity**: LOW
- **Category**: Performance
- **Estimated scope**: 1 file, ~5 lines

## Problem

The 24-hour activity chart bar animates `height` — a layout property that triggers layout + paint + composite. While the chart only updates when the activity log changes (not high-frequency), animating `height` is avoidable.

`src/popup/styles/theme.css:453-455` — current:

```css
.xa-log-chart-bars { display: flex; align-items: flex-end; gap: 1px; height: 36px; }
.xa-log-chart-bar { flex: 1; background: linear-gradient(to top, var(--xa-accent), var(--xa-accent-soft, #8b6d2f)); border-radius: 1px 1px 0 0; min-height: 2px; transition: height 0.2s; }
.xa-log-chart-bar:hover { background: var(--xa-accent); }
```

The `transition: height 0.2s` animates the `height` property, which triggers layout recalculation for the flex container.

## Target

Replace `height` animation with `transform: scaleY()`. The bar's height is set via inline style (`height: X%`), so we keep that as the layout value but animate the visual scale instead.

**Important**: This requires a two-part change:
1. The bar's `height` stays as-is (set by inline style) — it's the layout target.
2. The bar uses `transform: scaleY()` to animate from 0 to 1, with `transform-origin: bottom`.

But since the bar's height is set via React inline style (`style={{ height: 'X%' }}`), we can't easily separate "layout height" from "visual height" without a JS change. The simplest CSS-only fix is:

```css
/* target */
.xa-log-chart-bars { display: flex; align-items: flex-end; gap: 1px; height: 36px; }
.xa-log-chart-bar {
  flex: 1;
  background: linear-gradient(to top, var(--xa-accent), var(--xa-accent-soft, #8b6d2f));
  border-radius: 1px 1px 0 0;
  min-height: 2px;
  transform-origin: bottom;
  transition: transform 200ms var(--xa-ease);
}
.xa-log-chart-bar:hover { background: var(--xa-accent); }
```

Then in `ActivityTab.tsx`, change the inline style from `height` to `transform: scaleY()`:

`src/popup/components/tabs/ActivityTab.tsx:160-166` — current:

```tsx
{stats.byHour.map((b) => (
  <div
    key={b.hour}
    className="xa-log-chart-bar"
    style={{ height: `${(b.count / maxHour) * 100}%` }}
    title={`${b.hour}:00 — ${b.count} events`}
  />
))}
```

Target:

```tsx
{stats.byHour.map((b) => (
  <div
    key={b.hour}
    className="xa-log-chart-bar"
    style={{ height: '100%', transform: `scaleY(${b.count / maxHour})` }}
    title={`${b.hour}:00 — ${b.count} events`}
  />
))}
```

The bar's container is `height: 36px` with `align-items: flex-end`. Each bar gets `height: 100%` (full container height) and `transform: scaleY(ratio)` to visually scale it down. `transform-origin: bottom` keeps it anchored to the bottom.

**Note**: When `b.count === 0`, `scaleY(0)` would make the bar invisible. The `min-height: 2px` in CSS won't help because `transform` doesn't respect `min-height`. Fix: clamp the ratio to a minimum:

```tsx
style={{ height: '100%', transform: `scaleY(${Math.max(b.count / maxHour, 0.06)})` }}
```

This ensures empty bars still show a 2px sliver (0.06 * 36px ≈ 2.2px).

## Repo conventions to follow

- Easing token: `--xa-ease: cubic-bezier(0.22, 1, 0.36, 1)` at `theme.css:44`
- AUDIT.md §5: "Animate `transform` and `opacity` only. `width`/`height`/`margin`/`padding`/`top`/`left` trigger layout + paint + composite."

## Steps

1. Open `src/popup/styles/theme.css`.
2. Find `.xa-log-chart-bar` at line 454. Replace `transition: height 0.2s;` with `transform-origin: bottom; transition: transform 200ms var(--xa-ease);`.
3. Open `src/popup/components/tabs/ActivityTab.tsx`.
4. Find the chart bar map at line 160. Change the `style` prop from `height: percentage` to `height: '100%', transform: scaleY(clamped ratio)`.

## Boundaries

- Do NOT change the chart container height (36px) or the `align-items: flex-end`.
- Do NOT change the bar's `background`, `border-radius`, or `flex` value.
- Do NOT add new dependencies.
- The `min-height: 2px` in CSS can stay — it won't affect transformed bars, but it's harmless.

## Verification

- **Mechanical**: `cd extension && npm run check` — expect "Popup type-check passed" and "Popup bundle built".
- **Feel check**: Load the extension. Go to the Log tab.
  - The 24h chart bars should render at the correct heights (same visual as before).
  - If there are activity entries, the bars should animate their height changes via `scaleY` (smooth, GPU-accelerated).
  - Empty hours should show a tiny 2px sliver at the bottom.
  - Hover a bar — the background should change (existing hover rule).
  - In DevTools → Performance panel, record a session while the chart updates. Confirm no "Layout" events are triggered by the bar animation (only "Composite" events).
- **Done when**: Chart bars use `transform: scaleY()` instead of `height` for animation, with `transform-origin: bottom`, and empty bars show a 2px minimum sliver.
