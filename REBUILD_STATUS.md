# Rebuild status

Branch `rebuild/production`, built from `REBUILD_PLAN.md`. Nothing here touched any live Supabase project, its data or its keys (the old project is gone and no backup exists). All data comes from development fixtures and an in-memory mock store behind the data-access contracts in `src/server/data`. `main` was not changed, no pull request was opened, nothing was merged or deployed.

Date of this run (session 3): 18 November 2026.

## What changed since session 2

The owner decided that the shop gets a new, free Supabase project later. Until then the whole build runs on the mock store, and the contracts match the schema in `supabase_complete.sql` (tables `profiles`, `admin_invites`, `products`, `admin_activity_logs`, `reviews`, `testimonials`, `newsletter_subscribers`, `promo_codes`, `orders`, `site_settings`, `site_visits`). Product photographs go to Cloudinary, private receipts to a private Supabase bucket, each behind one module. The email functions are being supplied separately and were not invented: replying to a message and inviting staff save the record and show the link, but send nothing.

## Phases and commits

| Phase | Commit | State |
|---|---|---|
| 0 Foundations | `b81b9b0` | As before. The baseline migration is now written (see Phase 8). Not done: generated database types and Supabase clients (need the real project), Lighthouse budget file, "before" screenshots of the legacy pages. The CI workflow has never run on GitHub. |
| 1, 2 Design system, catalogue | `e3bb83e` | As before, plus the open items below. |
| 3 Cart, checkout, orders | `86cad1d` | As before, on the mock store. |
| 4 Authentication and account | `41b8ec4` (session 2) | Contracts with a mock store, sign-in, sign-up, password reset, account area, deletion request, account block in the menu. |
| 5 Content pages | `6fb0f46` | As before. |
| 6 Admin | `4260bad` | Built again on the mock store, phone first. See below. |
| Open items | `8c874ed` | Quick view, edit a bag line, legacy `?product=` redirect, sitemap and robots, dual price sliders, WhatsApp pop-up card. G-04 (account block in the menu) was already delivered in phase 4 and is now ticked. |
| 7 Consent, PWA | `9581e4c` and the commit that adds this file | Cookie consent with analytics gating, manifests, placeholder icons, offline page, service workers. |
| 8 Hardening, SEO | `9581e4c` and the commit that adds this file | Headers, CSP fix, SEO metadata, keep-alive cron, baseline migration. |
| 9 Quality gates, cut-over | not started | The legacy static files are untouched. |

### Phase 6: the admin area

Screens (`/admin/...`): sign-in and password reset for staff, dashboard, orders (list with status filter, search and pagination; detail with receipt view and one next step each), products (list with filters, pagination, bulk move to trash with undo, trash with restore and permanent delete; a four-step editor: details, stock with the variant editor, photographs, review), customers (search, suspend, ban, reactivate, returns, delete with typed confirmation), promo codes, messages (list with filter chips, thread, reply, mark unread, delete), analytics (7, 30 and 90 days, flat SVG charts), settings, roles and invites, activity log, CSV export of products, orders, customers and activity.

Phone behaviour: a bottom bar with Dashboard, Orders, Products, Messages and More inside the safe area; tables become cards with a label before each value; long forms are stepped; destructive actions open a confirmation sheet with Cancel on the left and the confirming button on the right; one button sits on the right; the sticky bar does not move when the keyboard opens. From 1024 px a side column replaces the bottom bar. Every action is checked on the server against the role table in `src/lib/permissions.ts`, not only hidden in the menu.

Modules asked for:

- `src/server/media/cloudinary.ts`: signed upload from the server, delivery URLs, env names `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`; with none set it returns a marked placeholder. Tested with a mocked `fetch`.
- `src/server/storage/receipts.ts`: private bucket `payment-receipts`, short-lived signed links only; the mock returns a marked placeholder receipt.
- `src/app/api/cron/keep-alive` and `vercel.json` `crons`: one tiny read a day, needs `CRON_SECRET`, does nothing until the Supabase URL and anon key are set.

### Phase 7

Cookie consent: a card in the first HTML when no answer is stored (a first-party cookie `lbs_consent` plus local storage), "Essential only" on the left and "Accept analytics" on the right, reopened from "Cookie settings" in the footer. Google Analytics and the Meta Pixel load only after "Accept" and only when their ids are set; nothing is requested before. PWA: storefront and admin manifests, placeholder icons (192, 512, maskable, Apple touch) and a placeholder sharing image, an offline page, and workers at `/sw.js` and `/admin/sw.js` that keep only the offline page and icons (private pages are never cached). A new worker takes over and the page reloads once.

### Phase 8 (what needs no live data)

Headers: `X-Frame-Options`, `Cross-Origin-Opener-Policy` added to the existing set. SEO: Open Graph and Twitter defaults, canonical and title on the home page, Organisation structured data, `sitemap.xml` and `robots.txt` generated from the catalogue. `supabase/baseline/0000_baseline.sql` and `0001_receipts_bucket.sql` are the fresh-project baseline (from `supabase_complete.sql`, which already contains every file in `supabase/migrations`); they were not run anywhere.

## Parity checklist

**141 of 354 items ticked** in `REBUILD_PLAN.md` (81 before this session, 60 added). A tick means the feature is built and covered by a unit or Playwright test; where it touches data it was tested against the mock store and still needs confirming against the new database. Not ticked on purpose although partly built: G-11 (the consent card has two answers, not the four categories the plan lists), MC-02 to MC-08 (no customer detail view or visit data, no emails), MM-03, MM-05, MM-11 (no email, no compose), MX-07 (no invitation email), MX-08 (no action filter), MI-02, MI-07, MI-17 (no image viewer or slider preview; photographs upload through the server rather than the browser), MA-03 to MA-14 (bars instead of a donut, no device brand table, no PDF), Q-03, Q-04 (offline page and icons only).

Not built at all in the admin: reviews (MX-01, MX-02, MX-10), site images (MX-03, MX-04, MX-11), idle timeout (M-12), staff sign-up from an invitation (M-02 to M-07, M-19 to M-21), activity log device details (M-17), skeletons (M-27), PDF export. In the storefront: reviews, first-party `site_visits` recording and location, install banner, push, Realtime refresh.

## Check results (all run locally on this branch)

| Check | Result |
|---|---|
| `tsc --noEmit` (strict) | 0 errors |
| `eslint . --max-warnings 0` | 0 errors, 0 warnings |
| `prettier --check .` | clean |
| Forbidden-pattern scan | clean |
| `vitest run` | 20 files, 110 tests, all pass |
| `playwright test` (phone 390 and desktop 1280) | 321 tests: 320 pass, 1 skipped (a phone-only control on desktop), 0 fail |
| Admin, every screen at 360, 390 and 430 px | no horizontal scroll, all buttons and tabs 44 px or more (tested); also checked at 768, 1280 and 1536 px in light and dark by screenshot, no overflow |
| Admin looked over by eye | phone and desktop renders of the dashboard, orders, order detail, products, editor, analytics in light and dark were viewed and judged; a desktop overflow (256 px from the side column) and old-style numerals on the figures were found that way and fixed |
| `next build` | passes |
| `npm audit --audit-level=high` | 0 vulnerabilities |

Not run: policy tests (no database), the secret scan of the client bundle, header check on a preview deployment, the independent diff review, real-device checks, axe on the admin screens (axe covers the 14 storefront routes), Lighthouse on the admin, INP.

Test-suite fixes made along the way: a status-text assertion left over from session 2 (the tracking page shows a badge, not the long label), and tests that share the one mock store were made independent of each other.

## Lighthouse mobile

Lighthouse 13.6.0, local production build, default mobile throttling, one run per page (the plan asks for three and the median). Flattering: placeholder SVGs for photographs and no third-party scripts.

| Page | Perf | A11y | Best practices | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|
| `/` | 100 | 100 | 100 | 100 | 0.8 s | 0 | 70 ms |
| `/shop` | 90 | 100 | 100 | 100 | 3.6 s | 0 | 60 ms |
| product page | 100 | 100 | 100 | 100 | 0.9 s | 0.005 | 70 ms |
| `/cart` | 100 | 100 | 100 | 66 (deliberate `noindex`) | 0.8 s | 0.005 | 90 ms |
| `/checkout` | 99 | 100 | 100 | 66 (deliberate `noindex`) | 0.8 s | 0 | 150 ms |
| `/size` | 100 | 100 | 100 | 100 | 0.8 s | 0 | 50 ms |
| `/contact` | 100 | 100 | 100 | 100 | 0.8 s | 0 | 60 ms |

### The two open problems from session 2, investigated

**Best practices stopped at 96 because of a "Content security policy" issue.** Cause found with the Chrome Audits protocol: Zod probes whether `new Function` is allowed, and a strict policy reports that probe as an eval violation (`kEvalViolation`, from a Zod chunk). Fix: `src/lib/zod-config.ts` switches Zod's compiler off before any schema is built, and every schema file and `src/config/env.ts` imports it first. Best practices is now 100 on every page and Chrome logs no issue.

**LCP over 2.5 s.** `/checkout` was a real cause: the first HTML held a small "Checkout" heading, and after hydration a different, larger heading ("Your bag is empty") or form replaced it, so the largest element appeared only after the scripts ran. The page now has one stable lead paragraph in the first HTML in every state; LCP 0.8 s. `/cart` and the product page lost 2.7 s for a second real reason that I introduced and then removed: the new cookie card appeared after hydration and became the largest text. It is now rendered in the first HTML, driven by a cookie, and kept short. `/shop` is **not fixed**: the real browser paints the first product image at 0.16 s (observed LCP in the same report), but Lighthouse's simulation, when the largest element is an image, treats every request that finished before that paint as blocking, which here includes about 300 KB of script, and estimates 3.6 s. I confirmed this from Lighthouse's own simulation code and the report. Honest reading: not a user-visible delay on this build, but the score will keep reporting it until first-load script on `/shop` is smaller. One step towards that is already in: the quick view is now loaded only when opened. Re-measure with real photographs and on a real device before deciding more.

## Honest verdict: is it production level on phones?

**Closer, but still no.** The admin is usable on a 360 to 430 px phone for the daily jobs: check a receipt and move an order on, add or edit a product with stock and photographs, answer a message, set a promo, read the numbers, invite staff. Layouts, tap targets and keyboard handling hold at the three phone widths and the larger ones, and the storefront pages now score 99 to 100 on Lighthouse apart from the `/shop` simulation. But nothing runs against a real database: no sign-in survives a restart, orders do not reach anyone, no email is sent, product photographs are placeholders, and the checkout cannot place a real order. Three things in the admin are known to be thin: no customer detail with visit data, no reviews or site-image management, and no staff sign-up from an invitation link (the link is created and shown, but the sign-up screen behind it is not built). Nothing has been tried on a real phone. Do not point customers or staff at this branch yet.

## What is still needed from the owner

1. **The new Supabase project**, created by you in the new organisation, then: its URL and anon key (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`), the service role key as `SUPABASE_SERVICE_ROLE_KEY` in Vercel only, and permission to apply `supabase/baseline/0000_baseline.sql` and `0001_receipts_bucket.sql` (review them first; they carry the old open "anyone can create orders" rule, which the real `place_order` function must replace).
2. **Cloudinary free account**: cloud name, API key and secret as `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` in Vercel.
3. **`CRON_SECRET`** in Vercel, so the daily keep-alive can run.
4. **The email functions** you said you are supplying (contact, admin reply, welcome, order email, invitation), and Resend: verified sending domain, sender addresses, `RESEND_API_KEY`.
5. **Auth settings** once the project exists: redirect allow-list for `/auth/callback`, Google OAuth client, reCAPTCHA keys (`NEXT_PUBLIC_RECAPTCHA_SITE_KEY`, `RECAPTCHA_SECRET_KEY`), the Maps key to restrict or rotate.
6. **Google Analytics and Meta Pixel ids** (`NEXT_PUBLIC_GA_MEASUREMENT_ID`, `NEXT_PUBLIC_FB_PIXEL_ID`), if you want them on; and a decision on whether the consent card needs the four categories of G-11 or the two answers it has.
7. **The canonical host**: `www.lingeriebysisioyin.store` or the apex.
8. **The logo as vector artwork** (or approval to redraw it) to replace the placeholder icons, the sharing image and the typeset wordmark.
9. **Photographs**: hero (3:4, 1800 × 2400 or larger), three category images (3:4), a sharing image (1200 × 630), product photographs at 4:5, a neutral fallback tile, measuring diagrams for the size guide.
10. **Copy and facts**: the brand spelling ("Lingerie" or "Lingeries" by Sisioyin); the home headline in your voice; evidence for or removal of "500+ customers" and "24/7 support"; delivery states and fees; the returns policy in two sentences; confirmation of the bank details in `src/config/site.ts`; real testimonials or agreement to omit them; a review of the FAQ, privacy and terms. Still open from before: the FAQ and terms mention a fee for "Other states" that checkout does not offer; the FAQ says reset links last 24 hours while the staff screen says one hour.
11. **Decisions from section 9.6 of the plan**: brand colour (wine `#6B1F2E` in use), order tracking with email, mandatory sign-in at checkout, card payments, editor permissions (the table in `src/lib/permissions.ts` gives editors products, orders and messages), the developer role, dead features, IP retention, account deletion, deleting the other branch, inches in the size guide. New: whether staff replies should be sent from one of four addresses, and whether the activity log needs device details.
12. **The phones the owner and staff use**, and the real visitor breakdown by device and width from the old `site_visits` if any export survives, so the three phone widths can be confirmed.
13. **Real-device time**: the checkout, receipt upload and the admin order and product screens on one Android phone and one iPhone.
