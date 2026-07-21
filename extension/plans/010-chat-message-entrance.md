# 010 — Chat message entrance animation

- **Status**: TODO
- **Commit**: 250125f
- **Severity**: LOW
- **Category**: Missed opportunity
- **Estimated scope**: 1 file, ~10 lines

## Problem

New chat messages in the ChatDrawer appear instantly — no entrance animation. When the Agent responds, the message teleports into the conversation flow. A subtle fade-in + slide-up would polish the conversation.

`src/popup/styles/theme.css:559` — current:

```css
.xa-chat-msg { padding: 8px 10px; border-radius: var(--xa-radius-sm); font-size: 11.5px; line-height: 1.5; max-width: 90%; }
```

No transition, no animation, no `@starting-style`.

`src/popup/components/agent/ChatDrawer.tsx:49-53` — messages are rendered as:

```tsx
history.map((m, i) => (
  <div key={i} className={`xa-chat-msg xa-chat-msg-${m.role}`}>
    {m.content}
  </div>
))
```

## Target

Add a subtle `opacity 0→1` + `translateY(4px)→0` entrance using `@starting-style`:

```css
/* target — update .xa-chat-msg */
.xa-chat-msg {
  padding: 8px 10px;
  border-radius: var(--xa-radius-sm);
  font-size: 11.5px;
  line-height: 1.5;
  max-width: 90%;
  opacity: 1;
  transform: translateY(0);
  transition: opacity 200ms var(--xa-ease), transform 200ms var(--xa-ease);
}

@starting-style {
  .xa-chat-msg {
    opacity: 0;
    transform: translateY(4px);
  }
}
```

**Why 200ms**: Chat messages are occasional (not high-frequency). 200ms is within the 150–250ms range for UI entrances (AUDIT.md §2). The `translateY(4px)` is subtle — just enough to suggest the message "settling in" from below.

**Why `@starting-style`**: Each new message mounts as a new DOM element. `@starting-style` triggers the transition on mount without JS. This is interruptible (CSS transition, not keyframes) — if multiple messages arrive rapidly, each animates independently.

## Repo conventions to follow

- Easing token: `--xa-ease: cubic-bezier(0.22, 1, 0.36, 1)` at `theme.css:44`
- AUDIT.md §2: UI entrances 150–250ms
- AUDIT.md §3: `translateY(4px)` is subtle (not `scale(0)`)

## Steps

1. Open `src/popup/styles/theme.css`.
2. Find `.xa-chat-msg` at line 559. Add `opacity: 1; transform: translateY(0); transition: opacity 200ms var(--xa-ease), transform 200ms var(--xa-ease);` to the rule.
3. Immediately after the `.xa-chat-msg` rules (after `.xa-chat-msg-assistant` at line 561), add:
   ```css
   @starting-style {
     .xa-chat-msg {
       opacity: 0;
       transform: translateY(4px);
     }
   }
   ```

## Boundaries

- Do NOT touch `ChatDrawer.tsx` — markup stays the same.
- Do NOT add `transform: scale()` — opacity + translateY is enough for messages.
- Do NOT change message colors, padding, or border-radius.
- Do NOT add stagger (messages arrive one at a time, not in a batch).
- Do NOT add new dependencies.

## Verification

- **Mechanical**: `cd extension && npm run check` — expect "Popup type-check passed" and "Popup bundle built".
- **Feel check**: Load the extension. Go to the Plan tab → open the Chat drawer → send a message.
  - The user message should fade in + slide up 4px over ~200ms.
  - When the Agent responds, the assistant message should fade in + slide up similarly.
  - In DevTools → Animations panel, set playback to 10% and confirm the opacity ramps from 0 to 1 and the translateY goes from 4px to 0.
  - Toggle `prefers-reduced-motion` — the opacity transition should still play, but the translateY should be dropped (per plan 005).
- **Done when**: Chat messages fade in + slide up 4px over 200ms with `--xa-ease` on mount, using `@starting-style`.
