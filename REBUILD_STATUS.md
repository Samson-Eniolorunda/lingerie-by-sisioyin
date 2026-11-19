# Rebuild status

## Session 7 (19 November 2026, scheduled run): go/no-go review fixes and payments

Branch `rebuild/production`. Nothing here has been applied to any real project; every SQL file is still unrun, so the fixes were folded into the baseline files and `0003_payments.sql` is new.

**Part R, go/no-go review fixes (all done).**

1. `place_order` and `quote_order` are no longer executable by `anon` or `authenticated`; only the server (service role) calls them, naming the signed-in customer in `p_user` (honoured only when `is_service()`). A receipt is mandatory, must sit under `<idempotency key>/` and must exist in `storage.objects` (bucket `payment-receipts`); `orders.receipt_path` is unique. `attach_receipt` is server-only with the same checks. A shared rate limit (`rate_limits` table, `rate_limit_hit`) limits `placeOrder` by address and by e-mail.
2. New payment state `refund_check`: an order cancelled with a receipt on file that staff had not accepted (awaiting or rejected, including the expiry job) is flagged; staff enter what arrived (`resolve_refund_check`), which becomes a refund owed or nothing; `mark_refunded` is now reachable from the admin order page. When `place_order` fails after the transfer, the receipt is recorded in `checkout_failures`; staff see it under **Receipts with no order** (admin menu) with the customer's contact details, close it and may delete settled or abandoned files. `CheckoutView` and `placeOrder` no longer say "nothing was charged".
3. `OWNER_SETUP.md` no longer tells the owner to run `tests/sql` in the real project (also in `supabase/baseline/README.md` and this file).
4. `trackOrder`, `createReceiptReupload` and `attachReceipt` are rate-limited by address and e-mail in the shared store; tracking returns a `TrackedOrder` with no phone, street address, name, account, notes, receipt path or key.
5. `updateProduct` saves stock only if the `stock_version` the form was loaded with is still current (one conditional UPDATE); otherwise the other details are saved and the editor is told to reload the stock.
6. Auth links: on a Vercel preview they return to the preview's own address (`VERCEL_URL`), elsewhere `NEXT_PUBLIC_SITE_URL` (set per environment); the allow-list in `OWNER_SETUP.md` step 4 is `https://www.lingeriebysisioyin.store/**`, `http://localhost:3000/**` and the preview pattern; a failed code exchange on a sign-up confirmation says "Your address is confirmed, please sign in".
7. `src/proxy.ts` follows the `@supabase/ssr` pattern: the response is rebuilt from the request inside `setAll`, so refreshed cookies reach the render.
8. Public writes (visit, contact, reviews, testimonials, uploads, invitations) are rate-limited through the shared store; the raw auth service error is no longer shown; staff with `customers.manage` can no longer edit other staff or the owner (RLS policy); `OWNER_SETUP.md` step 1 names both the new publishable/secret keys and the legacy anon/service_role keys.

**Part P, payments and e-mail (all done).**

1. **Bank details** live in `payment_bank_details` (one row, public read, `settings.manage` write, trigger-written `payment_settings_log` with old and new values), edited at Admin, Settings, Payments from a list of Nigerian banks. `BANK` was removed from `src/config/site.ts`; checkout, the tracking page, e-mails, terms, FAQ and privacy read the stored values (`{{bank.*}}` markers in `src/content`); with none saved they say "Payment details are being updated" and an order cannot be placed.
2. **Paystack and Flutterwave** are prepared, not integrated: `src/server/payments` has the provider interface, real webhook signature checks (HMAC SHA-512 and the secret hash), `/api/webhooks/paystack` and `/api/webhooks/flutterwave` (503 until configured, 401 on a bad signature, events recorded once), a per-method switch (`payment_methods`; `connected` can only be set by the developer in SQL and a method cannot be switched on before then), gateway order states and service-only `confirm_gateway_payment` and `fail_gateway_payment`. Variable names are in `OWNER_SETUP.md`.
3. **E-mail** behind `src/server/email`: Resend over HTTP, British English HTML and text templates for order confirmation, payment confirmed, payment rejected, shipped, contact reply and the shop's own new-order note; sent after the response (`after()`), never throws, in-memory outbox in development and tests.
4. **Open items closed:** staff invitation sign-up (`/admin/sign-in?invite=`), review and testimonial moderation (`/admin/reviews`), orphan receipt clean-up (`/admin/receipts`).

**Gates.** See `PAYMENTS_PROGRESS.md` for the final numbers.

**Still open.** E-mail was tested only with the in-memory transport and a mocked Resend call, never against Resend. The sign-in lock is still per server instance. Reviews, testimonials and the newsletter have no customer-facing form yet (the database and the moderation screens are ready). Direct calls to `record_visit` and `submit_contact_message` with the public key remain possible (they are bounded by column limits, not by the shared limiter). The invitation e-mail is not sent automatically (the link is shown to the owner to pass on).

## Session 6 (19 November 2026, scheduled run): the Supabase data layer

**What was built.** Every data contract now has a real implementation against `supabase/baseline`, in `src/server/supabase`: catalogue, contact, auth, orders (quote, place, cancel, payment decision, receipt re-upload, expiry), account, admin (products, orders, customers, promos, messages, analytics, staff and invitations, activity log, settings), reviews, testimonials and page visits. Receipts use the private `payment-receipts` bucket with signed uploads and short signed links. `DATA_MODE` is `supabase` when `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set; `mock` only on a developer's machine or with `LBS_ALLOW_DEMO=true`; otherwise `unconfigured`, and every call is refused with a message naming the missing variables. A production build never serves invented data.

**Authentication.** `@supabase/ssr` cookies, one per audience (`lbs-auth` for the storefront, `lbs-staff-auth` for the admin), both HTTP-only and lax (an e-mail link is a cross-site navigation and must carry the PKCE verifier cookie). The proxy renews each session that has a cookie and costs a visitor with none no network call. `/auth/callback?code=&next=&aud=` exchanges the one-time code for a session of the right audience; a recovery link also leaves a short cookie so the new password goes to the right account. Google sign-in redirects through Supabase. Sign-up with e-mail confirmation on returns "check your e-mail"; guest orders attach to the account only after the address is verified (`claim_guest_orders`).

**SQL changed (not applied to any real project).** New `0002_messages_and_admin_reports.sql`: `contact_messages`, `contact_replies`, `submit_contact_message`, `reply_to_message`, and the report functions `admin_summary`, `admin_order_counts`, `admin_customers`, `admin_customer_stats`, `admin_analytics`. `0000_baseline.sql` now sells assorted packs and products without variants (the app has such products; the first baseline could not order them) and uses the same stock wording as the app. SQL suite: **575 checks pass** (`08_messages_admin.sql` added; `04` extended).

**How it was tested.** No Docker and no real Supabase, so `tests/support/local-stack` starts a throwaway PostgreSQL 16, applies the baseline in order and puts a small local stand-in for the Supabase HTTP API in front of it (the PostgREST query subset, the GoTrue password, PKCE, refresh and admin calls, and the Storage signed-upload calls the app uses; roles and claims are set per request like PostgREST does). Nothing connects to any remote service.

| Gate | Result |
|---|---|
| format, lint (0 warnings), typecheck, forbidden patterns | clean |
| unit tests | 156 pass (`data-mode.test.ts` added: production never falls back to fake data) |
| SQL tests (`npm run test:sql`) | 575 checks pass |
| data-layer contract tests (`npm run test:contract`) | 46 pass against the local stack: auth (lockout, suspended and banned, staff versus customer, sign-up, recovery with one-time code, Google), orders (variant stock, idempotency, changed total, receipts, promos, cancellation, expiry), account, every admin area including permissions for editors and visitors |
| build | passes (mock with `LBS_ALLOW_DEMO=true`; and against the local stack) |
| Playwright, mock (`CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test:e2e`) | 340 pass, 13 skipped |
| Playwright, local Postgres (`npm run test:e2e:supabase`) | 340 pass, 13 skipped (the same suite; the Google, reset-link, receipt-upload and analytics-sample tests have a Supabase variant) |

**What the stand-in cannot prove (do these on the real project; they are step 9 of `OWNER_SETUP.md`).**
1. The signed receipt upload with a plain `PUT` and the file as the body, from the browser, against real Supabase Storage.
2. Real GoTrue behaviour: e-mail confirmation and recovery e-mails and their redirect URLs, ban durations, Google.
3. (Removed: the SQL tests must never run in the real project; a read-only check is in OWNER_SETUP step 9.)
4. Row level security as seen through the real PostgREST (the stand-in sets the role and claims the same way, but it is not PostgREST).

**Known gaps (unchanged unless stated).** No e-mail is sent (orders, replies, invitations). The invitation link is created and shown, but the sign-up screen behind it is not built. Review and testimonial moderation screens do not exist (the data layer reads only approved ones; approving is done in the Supabase table editor for now). The catalogue is filtered in memory over the live list (fine for a few hundred products). The sign-in lock and the upload limiter are per server instance. Unused uploaded receipts are not cleaned up. The bank details in `src/config/site.ts` are **to be confirmed by the owner** (`OWNER_SETUP.md`, step 6).

**Go-live steps:** `OWNER_SETUP.md`, steps 1 to 10, in order.

---
Branch `rebuild/production`, built from `REBUILD_PLAN.md`. Nothing here touched any Supabase project, database or other service, and no key exists in the code or in any file. All data comes from development fixtures and an in-memory mock store behind the data-access contracts in `src/server/data`. `main` was not changed, no pull request was opened, nothing was merged or deployed.

Date of this run (session 4): 19 November 2026. Gates run on this branch: format, lint (max-warnings 0), typecheck, forbidden patterns, unit tests, SQL tests, build and the full Playwright suite, all clean.

## Session 5 (19 November 2026, scheduled run)

- Brand name is now "Lingeries by Sisioyin" in every visible text, metadata, manifest, emails, legal text, README and docs; `tests/unit/brand.test.ts` fails if the singular name returns in any tracked file. The wordmark and footer read "Lingeries".
- Session 4 review fixes (A and B) were re-read against this file and the code; nothing further was found missing. (The Supabase data layer, then unwritten, is described in Session 6 below.)
- `tests/e2e/responsive.spec.ts`: storefront, account and admin at 360, 390, 430, 768, 1280 and 1536 px, light and dark: no sideways scroll, 44 px targets below 1024 px, primary button right of the secondary at phone widths. It found a wishlist heart shrinking to 41 px at 768 px (fixed).
- `OWNER_SETUP.md` written. Bank details live in `src/config/site.ts`, not in an environment variable.
- Gates: format, lint, typecheck, forbidden patterns, unit tests, build and the full Playwright suite clean (the browser is selected with `CHROMIUM_PATH=/opt/pw-browsers/chromium` in this environment).

## Session 4: the review findings, fixed before a database is connected

The owner decided to **start clean**: the old site was never really used, so there is no old data, no old email templates and no parity target with the old site. A fresh free Supabase project in a new organisation will be connected later; it does not exist yet. The legacy static site (`*.html`, `assets/`, workers, manifests, `supabase_complete.sql`, `supabase/migrations`) was removed.

### A. The baseline SQL (`supabase/baseline/0000_baseline.sql`, rewritten)

The anon key ships to browsers, so row level security and column grants are the boundary. What changed, by finding:

| # | Finding | What the SQL now does |
|---|---|---|
| 1 | Clients could change `role`, `is_admin`, status | `is_admin` is generated from `role`; column-level grants give users only their own safe columns; `account_status`, `return_privilege_revoked`, `deletion_requested_at`, `role` change only through definer functions (`set_staff_role`, `set_account_status`, `set_return_privilege`, `request_account_deletion`); a trigger protects owner and developer rows (no demotion, no deletion, nobody assigns owner, not even with the service role) |
| 2 | First sign-up became owner; role from metadata | No first-user owner (the owner is created by hand, statement in the baseline README). `handle_new_user` takes a role only from `admin_invites.invited_role`, matched by a valid, unexpired, single-use token stored as a SHA-256 hash, for the same email; never from `raw_user_meta_data` |
| 3 | Banned and suspended accounts | `is_admin()`, `has_permission()` and every policy and function check `account_status = 'active'`; bans also use `auth.admin.updateUserById` with `ban_duration` (documented) |
| 4 | Orders open to clients | No client INSERT, UPDATE or DELETE. Definer functions: `quote_order`, `place_order` (exact variant, active product, ordered row locks, exact-variant stock decrement, promo use counted, server total compared with the quoted total, unique idempotency key), `cancel_order` (restores stock, conditional updates), `set_order_status` (the TRANSITIONS table), `decide_payment`, `attach_receipt`, `mark_refunded`, `expire_unpaid_orders`, `claim_guest_orders` (only after the email is verified). `orders.user_id` added |
| 5 | Promo codes readable | No public SELECT; `validate_promo` returns validity and percentage only; creating codes needs `promos.manage` (editors cannot) |
| 6 | Reviews, testimonials | Inserts forced to `is_approved = false`, `is_featured = false`; `customer_email` is not selectable by anon (public view) |
| 7 | `site_visits` | No client UPDATE or INSERT; `record_visit` and `update_visit_duration` (limited window and range) |
| 8 | Policies, logs, search path | `has_permission(text)` mirrors `src/lib/permissions.ts` and is used in every staff policy; activity-log `admin_id` forced to `auth.uid()` by trigger; `SET search_path` on all 26 definer functions; `EXECUTE` revoked from everyone and granted back one by one |
| 9 | Schema | `payment_status` is `awaiting_confirmation`, `confirmed`, `rejected`, `refund_owed`, `refunded`; `products.slug`, `orders.receipt_path`, `orders.landmark`, `receipt_reupload_until`, refund fields added; indexes on `orders.customer_email` and `orders.user_id`; indexes that duplicated UNIQUE constraints removed; delivery fees in a table seeded from `src/lib/delivery.ts`; order numbers use the Lagos date and may pass four digits; promo expiry ends 23:59:59 Lagos |

**How it was tested:** `npm run test:sql` (`tests/sql/run.sh`) starts a throwaway local PostgreSQL 16, stubs the few Supabase pieces (`auth.users`, `auth.uid()`, `auth.jwt()`, the three API roles, `storage`), applies both baseline files and runs seven test files as `anon`, `authenticated` and `service_role` through `SET ROLE`: **514 checks, all pass**. The stubs are close to, but not the same as, real Supabase; the same files must be run once in the real project's SQL editor before the shop opens. Not covered: real Auth behaviour (ban durations, confirmation email), Realtime, the storage API itself.

### B. The application

| # | Finding | What was done |
|---|---|---|
| 10 | Receipt upload | The browser uploads straight to storage on a signed address issued by a server action (`createReceiptUpload`); no file passes through an action, so Next's 1 MB default and Vercel's 4.5 MB cap do not apply. Photographs are scaled to fit 1600 px and re-encoded as JPEG in steps until they fit; limit 4 MB. One list of types in `src/lib/receipt-types.ts` (JPEG, PNG, WebP, PDF) shared by the form, the action, the storage module and the bucket. HEIC is not stored: it is converted to JPEG in the browser where the phone can decode it, otherwise the customer is told to share it as JPEG. Each failure has its own message (dropped connection, too large, refused, service problem) instead of "check your connection" |
| 11 | Transfer amount | The checkout asks the server for a quote (`getQuote`) before showing bank details; the order carries `quotedTotal`; if it differs the order is refused with the new total, the quote is fetched again and the customer must tick the confirmation again |
| 12 | Variants | `lookupVariant` requires an exact size, and a colour when colours exist, rejects inactive and trashed products, and decrements that exact variant; lines naming the same variant share its stock |
| 13 | `vercel.json` | Crons only (keep-alive daily, expiry of unpaid orders daily); no rewrites, no second CSP, no `no-store` on assets. Legacy static files removed |
| 14 | Contracts | Orders, promos, catalogue and contact go through `data.orders`, `data.catalogue`, `data.contact`; no action or query imports the mock; order types moved to `src/types/orders.ts`; the auth contract is session based (the repository owns the session; `exchangeCode`, `updatePassword`, `currentUser`, `refreshSession`, Google `redirectTo`); `/auth/callback` exchanges the one-time code; the proxy refreshes a Supabase session with `@supabase/ssr` when configured and does nothing otherwise; list calls take `limit` and `offset` and return `{items, total}`; customers are computed in one pass over the orders |
| 15 | Receipts | The path returned by the signed upload is stored on the order (`receiptPath`) and the admin opens that path; the order is refused if the object never reached storage |
| 16 | Enums | Role, customer status, payment decision, order status and message mark are checked with `z.enum` in the actions |
| 17 | Payment states | Confirmation only through the payment decision; a rejected receipt keeps the order pending with a 48-hour re-upload window (the customer can send another from the tracking page or the account), after which a daily job cancels it and releases the stock; cancelling a paid order records `refund_owed`; cancelling twice restores stock once |
| 18 | Idempotency | A client-generated key per checkout attempt, kept across reloads until the order is placed; a repeat returns the same order |
| 19 | Mock mode | `DATA_MODE` is derived from the Supabase environment variables; demonstration sign-ins and reset links are shown only in `next dev` or where `LBS_ALLOW_DEMO=true` is set (the browser tests set it); with Supabase configured but no Supabase data layer, the app fails with a clear message instead of serving fake data |
| 20 | Low items | Sign-in lock keyed by email and address, failures decay after 15 minutes, count restarts after a lock expires (a stranger cannot lock the owner out); the activity log is no longer capped and marking a message is logged; order numbers allow more than four digits and use the Lagos date; promo expiry ends 23:59 Lagos time; `<` is escaped in JSON-LD |

**Tests added or changed:** `tests/unit/orders.test.ts` (variants, inactive products, quote mismatch, idempotency, receipts, promo expiry, Lagos order numbers, payment states, refund owed, expiry), `account.test.ts` (ownership by user id and verified email, paging), `admin.test.ts` (paging, enums, unbounded log, Lagos expiry, editor and promos), `auth.test.ts` (lockout rules, recovery code flow, demo hints off outside development), `media.test.ts` (receipt module), `misc-rules.test.ts` (JSON-LD, limiter, paging, variants, order input), `supabase-proxy.test.ts`; Playwright: server quote before bank details, direct upload with no large action body, double tap sends one upload and one order, failed upload message, too-large PDF, an unfulfillable order refused before payment, the one-time reset link.

### Known gaps after session 4

- **(Closed in session 6.)** The Supabase implementation of the contracts is written in `src/server/supabase` and tested against a local database; see Session 6. Still open from this list: guest re-upload now runs on the server with the service role (done); unused uploaded receipts are still not cleaned up.
- Guest re-upload of a receipt after a rejection must run on the server with the service role (the SQL forbids it for anon); the mock does this, the real store must too.
- The in-memory upload limiter is per server instance; the bucket's size and type limits are the hard boundary. Unused uploaded receipts (an upload with no order) are not cleaned up yet.
- Email (order, reply, invitation) is still not sent; no invitation sign-up screen yet.
- The proxy session refresh was tested with a mocked `@supabase/ssr`, never against Supabase.
- `place_order`'s receipt path may be null in the SQL; the app always sends one.

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
| `vitest run` | 22 files, 148 tests, all pass |
| `npm run test:sql` (local PostgreSQL 16, Supabase stubs) | 7 files, 514 checks, all pass |
| `playwright test` (phone 390 and desktop 1280) | 329 tests: 328 pass, 1 skipped (a phone-only control on desktop), 0 fail |
| Admin, every screen at 360, 390 and 430 px | no horizontal scroll, all buttons and tabs 44 px or more (tested); also checked at 768, 1280 and 1536 px in light and dark by screenshot, no overflow |
| Admin looked over by eye | phone and desktop renders of the dashboard, orders, order detail, products, editor, analytics in light and dark were viewed and judged; a desktop overflow (256 px from the side column) and old-style numerals on the figures were found that way and fixed |
| `next build` | passes |
| `npm audit --audit-level=high` | 0 vulnerabilities |

Not run: the SQL tests against real Supabase (only the local stub run), the secret scan of the client bundle, header check on a preview deployment, the independent diff review, real-device checks, axe on the admin screens (axe covers the 14 storefront routes), Lighthouse on the admin, INP.

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

**Closer, but still no.** The admin is usable on a 360 to 430 px phone for the daily jobs: check a receipt and move an order on, add or edit a product with stock and photographs, answer a message, set a promo, read the numbers, invite staff. Layouts, tap targets and keyboard handling hold at the three phone widths and the larger ones, and the storefront pages now score 99 to 100 on Lighthouse apart from the `/shop` simulation. Since session 6 the app also runs against a database (a local one, in tests): sign-in survives a restart and orders are stored. It has still never run against a real Supabase project, no email is sent and product photographs are placeholders. Three things in the admin are known to be thin: no customer detail with visit data, no reviews or site-image management, and no staff sign-up from an invitation link (the link is created and shown, but the sign-up screen behind it is not built). Nothing has been tried on a real phone. Do not point customers or staff at this branch yet.

## What is still needed from the owner

1. **Create the new Supabase project** (free tier, new organisation, a region near Lagos), then, following `supabase/baseline/README.md`:
   1. In the SQL editor run `0000_baseline.sql`, then `0001_receipts_bucket.sql` (read them first; they were run only on a local throwaway PostgreSQL).
   2. Do NOT run `tests/sql` in the real project (it leaves test users and a promo code behind); they run only locally or on a throwaway project.
   3. Create the owner by hand: sign up (or add under Authentication, Users, address verified), then run the documented statement that sets `role = 'owner'` inside a transaction with `lbs.allow_protected_roles` on. Nobody becomes owner through the application.
   4. In Authentication: turn on email confirmation, add the site URL and the redirect URL `<site>/auth/callback`, and Google if wanted.
   5. Give me, or set in Vercel yourself, only these names (never in a file): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server only), `CRON_SECRET`, `NEXT_PUBLIC_SITE_URL`. Do not set `LBS_ALLOW_DEMO`.
   6. Then the next session writes and tests the Supabase implementation of the contracts. Until then, setting the Supabase variables makes the site fail with a clear message by design.
2. **Cloudinary free account**: cloud name, API key and secret as `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` in Vercel.
3. **`CRON_SECRET`** in Vercel, so the daily keep-alive can run.
4. **The email functions** you said you are supplying (contact, admin reply, welcome, order email, invitation), and Resend: verified sending domain, sender addresses, `RESEND_API_KEY`.
5. **Auth settings** once the project exists: redirect allow-list for `/auth/callback`, Google OAuth client, Cloudflare Turnstile keys (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`), the Maps key to restrict or rotate.
6. **Google Analytics and Meta Pixel ids** (`NEXT_PUBLIC_GA_MEASUREMENT_ID`, `NEXT_PUBLIC_FB_PIXEL_ID`), if you want them on; and a decision on whether the consent card needs the four categories of G-11 or the two answers it has.
7. **The canonical host**: `www.lingeriebysisioyin.store` or the apex.
8. **The logo as vector artwork** (or approval to redraw it) to replace the placeholder icons, the sharing image and the typeset wordmark.
9. **Photographs**: hero (3:4, 1800 × 2400 or larger), three category images (3:4), a sharing image (1200 × 630), product photographs at 4:5, a neutral fallback tile, measuring diagrams for the size guide.
10. **Copy and facts**: the brand spelling ("Lingerie" or "Lingeries" by Sisioyin); the home headline in your voice; evidence for or removal of "500+ customers" and "24/7 support"; delivery states and fees; the returns policy in two sentences; confirmation of the bank details in `src/config/site.ts`; real testimonials or agreement to omit them; a review of the FAQ, privacy and terms. Still open from before: the FAQ and terms mention a fee for "Other states" that checkout does not offer; the FAQ says reset links last 24 hours while the staff screen says one hour.
11. **Decisions from section 9.6 of the plan**: brand colour (wine `#6B1F2E` in use), order tracking with email, mandatory sign-in at checkout, card payments, editor permissions (the table in `src/lib/permissions.ts` gives editors products, orders and messages), the developer role, dead features, IP retention, account deletion, deleting the other branch, inches in the size guide. New: whether staff replies should be sent from one of four addresses, and whether the activity log needs device details.
12. **The phones the owner and staff use**, and the real visitor breakdown by device and width from the old `site_visits` if any export survives, so the three phone widths can be confirmed.
13. **Real-device time**: the checkout, receipt upload and the admin order and product screens on one Android phone and one iPhone.
