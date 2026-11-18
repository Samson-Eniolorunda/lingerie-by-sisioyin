# Rebuild status

Branch `rebuild/production`, built from `REBUILD_PLAN.md`. Nothing here touched the live Supabase project, its data or its keys. All data comes from development fixtures and an in-memory mock; every place that needs the live schema is marked below. `main` was not changed, no pull request was opened, nothing was merged.

Date of this run: 18 November 2026.

## Phases and commits

| Phase | Commit | State |
|---|---|---|
| 0 Foundations | `b81b9b0` | Partly done. Done: Next.js 16 with TypeScript strict, ESLint (zero warnings), Prettier, Vitest, Playwright (phone 390 × 844 and desktop 1280 × 800), environment schema, `.env.example` (names only), CSP proxy with a per-request nonce and security headers, CI workflow file. Not done: baseline migration from the live schema (commit 3), generated database types and Supabase clients (commit 4, needs the schema), Lighthouse budget file, the "before" screenshots of the 16 legacy pages. The CI workflow has been written but has not run on GitHub. |
| 1 Design system, phone first | `e3bb83e` (with 2) | Mostly done. Tokens (palette, light and dark, spacing, radius, shadow, motion), self-hosted fonts (six WOFF2 files), Button and ButtonRow (secondary left, primary right), fields with inline errors, Sheet (bottom sheet on phones, side drawer, dialog), Toast with live region, Tabs, Stepper, StickyActionBar, safe-area utilities, header, footer, menu, bottom navigation, theme control, WhatsApp button. Not done: Table component (no admin yet), the redrawn logo artwork and icon set (needs the logo vector), a maskable icon. The wordmark is set in type for now, and `src/app/icon.svg` is a plain placeholder tile. |
| 2 Catalogue | `e3bb83e` (with 1) | Partly done, on fixtures. Done: home, shop (URL state, filter sheet, sort sheet, chips, "show more"), product page with swipe gallery, counter, pinch-zoom viewer, size and colour selection, stock caps, sticky add-to-bag bar, size-guide sheet, share, JSON-LD, search sheet (also Ctrl or Cmd + K), bag sheet. Not done: quick view, reviews and review form, Realtime refresh, sitemap, legacy `?product=` redirect, admin-managed hero and category images, edit-a-bag-line. Phases 1 and 2 are one commit because the shell imports the catalogue modules. |
| 3 Cart, checkout, orders | `86cad1d` | Partly done, on an in-memory mock. Done: bag page, promo code, delivery estimate, sticky checkout bar, three-step checkout with inline validation, mobile keyboards and autofill attributes, bank details with copy buttons, receipt picker with 5 MB and type checks, double-submit guard, failure keeps the bag, confirmation, tracking by order number plus email, wishlist page. The server rules (prices re-read from the catalogue, promo applied and counted, stock checked and decremented, order number format) run in `src/server/mock/orders.ts` and are unit-tested; they are the specification for the database `place_order` function. Not done: the real `place_order` function, private receipt storage, order emails, sign-in gate on checkout, saved addresses, "use my profile". |
| 4 Authentication and account | not started | Needs the live Auth settings, reCAPTCHA keys and schema. A placeholder `/dashboard` page keeps the Account tab from leading to a 404. |
| 5 Content pages | `6fb0f46` | Done apart from email. Contact (channels, form, success, failure fallback to WhatsApp; stored in a mock, no email), FAQ (23 questions in six groups, search, tabs, one open at a time), size guide (four charts with all rows, cm and in control on phones, calculator in the page), privacy and terms (copy carried over, table of contents, anchors), 404 and error pages. |
| 6 Admin | not started | |
| 7 Consent, analytics, PWA | not started | |
| 8 Hardening and SEO | not started | The policy and receipts work needs the live schema. |
| 9 Quality gates and cut-over | not started | The legacy static files are still in place and untouched. |

Later fixes were committed with the phase that follows them. The last commit before this file is `6fb0f46`; the accessibility, heading-order, favicon and hydration fixes made after it are in the commit that adds this file.

## Parity checklist

**81 of 354 items ticked** in `REBUILD_PLAN.md` (the full list is there). A tick means the feature is built and covered by a unit or Playwright test. Where an item touches data, it was built and tested against the development fixtures or the mock store, so it still needs to be confirmed against the staging database, as the plan requires. 273 items are not ticked: the whole of authentication, the account area, the admin (M, MD, MI, MO, MC, MM, MX, MA), consent and analytics, the PWA, the database and edge-function items, and parts of the catalogue and checkout listed above. Items that are partly done were left unticked: for example S-04 has numeric price fields but no dual sliders, G-10 has the button but not the pop-up card, G-04 lacks the account block in the menu.

Built on the mock but deliberately not ticked: K-13, K-14, K-17, P-02, T-05, C-01, W-01, G-16 (contact page part).

## Check results (all run locally on this branch)

| Check | Result |
|---|---|
| `tsc --noEmit` (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) | 0 errors |
| `eslint . --max-warnings 0` | 0 errors, 0 warnings |
| `prettier --check .` | clean |
| Forbidden-pattern scan (`ts-ignore`, `eslint-disable`, `as any`, `as unknown as`, `console.log`, TODO, banned phrases, gradients, backdrop blur) | clean |
| `vitest run` | 11 files, 50 tests, all pass |
| `playwright test` (phone and desktop) | 206 tests, all pass, none skipped; run twice in a row with `--repeat-each=2` earlier without flakes |
| axe, WCAG 2.2 AA, 14 routes, light and dark, phone and desktop | 0 violations |
| No horizontal scroll at 360, 390 and 430 px on 14 routes | pass |
| Tap targets 44 px or more on 9 phone routes | pass |
| `next build` | passes, no warnings |
| `npm audit --audit-level=high` | 0 vulnerabilities |
| Bundle | CSS about 9.5 KB gzipped in total; all JavaScript chunks together about 296 KB gzipped (the per-route first-load figure was not measured separately) |

Screenshots were captured at 360, 390, 430, 768, 1280 and 1536 px in light and dark and looked over for the home, shop, product, cart, checkout, FAQ, size guide and contact pages; they are produced by `scripts/shots.sh` and are not committed.

Not run: the policy tests (no local Supabase), the secret scan of the client bundle, the header check on a preview deployment, the redirect map, the independent diff review (gate f), real-device checks.

## Lighthouse mobile

Lighthouse 13.6.0, local production build, default mobile throttling, one run per page (the plan asks for three and the median). These are flattering: the pages show placeholder SVGs, not photographs, and no third-party scripts.

| Page | Perf | A11y | Best practices | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|
| `/` | 100 | 100 | 96 | 100 | 0.8 s | 0 | 70 ms |
| `/shop` | 89 to 95 | 100 | 96 | 100 | 2.9 to 3.6 s | 0 | 80 to 120 ms |
| product page | 99 | 100 | 96 | 100 | 0.8 s | 0.005 | 140 ms |
| `/cart` | 97 | 100 | 96 | 63 (deliberate `noindex`) | 0.8 s | 0.005 | 200 ms |
| `/checkout` | 90 to 92 | 100 | 96 | 63 (deliberate `noindex`) | 3.3 to 3.5 s | 0 | 70 to 110 ms |
| `/size` | 100 | 100 | 96 | 100 | 0.8 s | 0 | 80 ms |
| `/contact` | 99 | 100 | 96 | 100 | 0.8 s | 0 | 120 ms |

Open problems: LCP on `/shop` and `/checkout` is over the 2.5 s target in the simulated run and I did not find the cause (the real request timings in the same report are short, which points at the simulation, but that is a guess). Best practices stops at 96 because of one Chrome "Content security policy" issue entry with no detail. `/track` was not run. Lighthouse for the admin and INP were not run.

## Honest verdict: is it production level on phones?

**Not yet, and it cannot be called a finished rebuild.** What exists is solid for what it covers: the phone layouts at 360, 390 and 430 px have no horizontal scroll, tap targets are 44 px or more, text and controls are 16 px, zoom is allowed, safe-area insets and the keyboard-aware action bars are in place, the swipe gallery, size sheet, filter sheet and one-thumb bag and checkout work in tests, and the look follows the plan's quiet boutique direction with no gradients or stock-template sections. But roughly three quarters of the checklist is not built (sign-in, account, the whole admin, consent and analytics, the PWA, hardening, cut-over), the data layer is fixtures and a mock, the checkout cannot place a real order, and nothing has been tried on a real phone or against the staging database. The home and hero images are placeholders. Do not point customers at this branch.

## What is needed from the owner

1. A schema-only dump of the live Supabase database (tables, policies, functions, triggers, storage buckets and policies), or permission to run `supabase db pull`. Needed for the baseline migration, generated types, the real catalogue reader, `place_order` and the policy work.
2. The source of the edge functions `send-contact-email`, `send-admin-reply`, `send-user-welcome` and `send-order-email`, and the SQL of the order-email trigger.
3. A staging Supabase project (or approval to create one), to check the checkout, stock and emails without touching live orders.
4. Whether Supabase image transformation is enabled on the plan.
5. Resend: the verified sending domain and sender addresses, and the key as `RESEND_API_KEY` in Vercel.
6. Supabase Auth redirect allow-list for the new `/auth/callback`; Google OAuth client callback; reCAPTCHA site and secret keys (`NEXT_PUBLIC_RECAPTCHA_SITE_KEY`, `RECAPTCHA_SECRET_KEY`); the Maps key to restrict or rotate (the old one in `assets/js/config.js` is exposed in history).
7. The canonical host: `www.lingeriebysisioyin.store` or the apex.
8. The logo as vector artwork (or approval to redraw it), and a maskable app icon.
9. Photographs: hero (3:4, 1800 × 2400 or larger), three category images (3:4), an Open Graph image (1200 × 630), product photographs at 4:5, a neutral fallback tile, and measuring diagrams for the size guide.
10. Copy and facts: the brand spelling ("Lingerie" or "Lingeries" by Sisioyin; the build uses "Lingerie" in new copy and leaves the legal text as written), the home headline in the owner's voice, evidence for or removal of "500+ customers" and "24/7 support", the delivery states and fees and whether anything outside the seven states is offered, the returns policy in two sentences, confirmation of the bank details in `src/config/site.ts`, real testimonials or agreement to omit them, and a review of the FAQ, privacy and terms. Three contradictions I did not decide for you: the FAQ and terms mention a fee for "Other states" that checkout does not offer; the FAQ says reset links last 24 hours while the staff screen says one hour; the legal text uses the other brand spelling. I did change one fact: the FAQ now says orders can be cancelled within 30 minutes, which is what the code and the terms enforce (it said one hour).
11. Decisions from section 9.6 of the plan: brand colour (the build uses wine `#6B1F2E`), order tracking with email (the build requires number plus email), mandatory sign-in at checkout (not enforced yet), card payments, editor permissions, the developer role, dead features, IP retention, account deletion, deleting the other branch, account navigation on phones, Lighthouse SEO on `noindex` pages, and inches in the size guide.
12. The phones the owner and staff use, and the real visitor breakdown (device and viewport widths) from `site_visits`, so the three phone widths can be confirmed.
13. Real-device time: the checkout and receipt upload on one Android phone and one iPhone.
