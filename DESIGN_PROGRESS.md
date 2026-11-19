# Design progress

Audit 2026-11-19 (six widths, light and dark; home, cart, size guide, contact, track, sign-in, terms, 404). No horizontal scroll found.

## Findings, worst first

1. [x] Consent card on phones: "Accept analytics" wrapped onto two lines. Labels now stay on one line.
2. [x] Shop grid on tablets (768 px): two oversized columns because the custom `md` breakpoint is 1024 px. Now three columns from 768 px.
3. [x] Consent card at 360 px: "Accept analytics" ran past the card edge (flex wrappers had no min-width). Button row wrappers now shrink; consent buttons use smaller padding and text.
4. [ ] Remaining: product page, checkout, wishlist, admin screens, empty/loading/error states, Lighthouse re-run, share images.

## Status

IN PROGRESS

## Pink and lilac theme (2026-11-19)

Primary rose #A62B5E (hover #B8336A, press #8A234E, tint #FDF2F6, selected #FBE4EC); accent lilac #6B4FA0 for text and icons, #F1EBFB for surfaces; page #FFFBFC; danger #B42318. Dark: primary #F2A7C3, accent #C9B6F2, accent surface #2E2540. The shop opens in light unless the visitor chose Dark or System.

Contrast ratios (WCAG, text on background):

```
light  white on primary             6.71
light  white on primary hover       5.65
light  white on primary press       8.64
light  primary link on page         6.54
light  primary on tint              6.03
light  primary on primary-tint      6.14
light  primary on selected          5.56
light  accent on white              6.46
light  accent on page               6.29
light  accent on accent-soft        5.54
light  accent on tint               5.80
light  ink on page                  17.50
light  muted on page                7.59
light  muted on tint                7.00
light  subtle on page               5.05
light  subtle on tint               4.66
light  control on page (3:1 UI)     3.60
light  error on error-bg            5.58
light  error on page                6.40
light  success on bg                5.42
light  warning on bg                5.06
light  info on bg                   6.67
dark   on-primary on primary        9.93
dark   on-primary on hover          11.96
dark   on-primary on press          7.88
dark   primary on page              9.93
dark   primary on surface           9.02
dark   primary on primary-tint      7.83
dark   accent on page               10.26
dark   accent on surface            9.32
dark   accent on accent-soft        7.88
dark   ink on page                  15.81
dark   muted on surface             7.70
dark   subtle on surface            5.78
dark   error on error-bg            7.44
dark   error on page                9.40
email  accent on white              6.71
```
