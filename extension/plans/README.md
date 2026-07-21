# Animation Plans — XActions Extension Popup

Audit by `improve-animations` at commit `250125f`. All plans modify only `src/popup/styles/theme.css` and (for plans 008, 011) one TSX file each. No new dependencies.

## Plans

| # | Title | Severity | Status | Files |
|---|---|---|---|---|
| 001 | Dialog entrance animation | HIGH | TODO | theme.css |
| 002 | Select popup transform-origin + entrance | HIGH | TODO | theme.css |
| 003 | Press feedback on all buttons | MEDIUM | TODO | theme.css |
| 004 | Toast interruptibility (keyframes → transition) | MEDIUM | TODO | theme.css |
| 005 | prefers-reduced-motion: keep feedback, drop movement | MEDIUM | TODO | theme.css |
| 006 | Pipeline step state transition | MEDIUM | TODO | theme.css |
| 007 | Tab panel crossfade | MEDIUM | TODO | theme.css |
| 008 | Chart bar: scaleY instead of height | LOW | TODO | theme.css, ActivityTab.tsx |
| 009 | Duration tokens + easing consistency | LOW | TODO | theme.css |
| 010 | Chat message entrance animation | LOW | TODO | theme.css |
| 011 | Playbook step status crossfade | LOW | TODO | theme.css, PlaybookCard.tsx |

## Recommended execution order

1. **009** (duration tokens) — establishes `--xa-dur-*` tokens that all other plans reference. Do this first so subsequent plans can use the tokens directly.
2. **005** (reduced-motion split) — fixes the global media query. Should be done early so all subsequent plans can verify against it.
3. **003** (press feedback) — adds `:active` rules. References `--xa-dur-fast` from plan 009.
4. **001** (dialog entrance) — standalone, high impact.
5. **002** (select popup origin) — standalone, high impact.
6. **004** (toast interruptibility) — replaces `@keyframes` with `@starting-style`.
7. **006** (pipeline steps) — standalone, medium impact.
8. **007** (tab panel crossfade) — standalone, medium impact.
9. **008** (chart bar scaleY) — touches ActivityTab.tsx, standalone.
10. **010** (chat message entrance) — standalone, low impact.
11. **011** (playbook status crossfade) — touches PlaybookCard.tsx, standalone.

## Dependencies

- **009 before all others** — plans 001–008 and 010–011 reference `--xa-dur-*` tokens. If 009 is not done first, use the hardcoded values from each plan (they're specified inline).
- **005 before 001, 002, 004, 007, 010, 011** — these plans add `@starting-style` entrances that produce movement. Plan 005 ensures reduced-motion users get opacity-only. If 005 is not done first, the entrances will still work but reduced-motion users will see full movement.
- **003 before 009** — plan 003 changes `transform 0.1s` to `0.16s`. Plan 009 then tokenizes it. If done in reverse, plan 003 will overwrite the token with a hardcoded value. **Recommended**: do 003 first, then 009.
- All other plans are independent.

## After execution

Run `cd extension && npm run check` to verify type-check + bundle. Then load the extension in Chrome and feel-check each interaction per the plan's verification section.
