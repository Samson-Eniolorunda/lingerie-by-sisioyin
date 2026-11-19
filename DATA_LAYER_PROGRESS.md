# Data layer progress

Branch `rebuild/production`. Goal: the real Supabase implementation of every data contract, tested
against a local PostgreSQL (never a remote service).

## Plan (commit groups)

1. [x] SQL: `0002_messages_and_admin_reports.sql` (contact messages, replies, admin report functions), tests `08_messages_admin.sql`; `price_order` / `adjust_stock` now sell assorted packs and plain products (tests added to `04`)
2. [x] Local stack for tests (`tests/support/local-stack`): PostgreSQL 16 plus a local stand-in for the Supabase HTTP API (PostgREST subset, GoTrue subset, Storage signed uploads)
3. [x] Supabase clients, catalogue, contact, reviews, testimonials, visits
4. [x] Auth: `@supabase/ssr` cookies (one per audience), proxy refresh, callback code exchange (`aud`), Google redirect, recovery, password confirmation
5. [x] Orders (place/quote/cancel/payment decision/receipt re-upload/expiry), promos, receipts bucket
6. [x] Account
7. [x] Admin (products, orders, customers, promos, messages, analytics, staff and invites, activity, settings)
8. [x] Contract tests: `npm run test:contract` (46 tests, all pass)
9. [ ] Gates on the mock (format, lint, typecheck, unit, SQL, build, Playwright)
10. [ ] Playwright against the local Postgres (`DATA_MODE=supabase`)
11. [ ] Docs: OWNER_SETUP.md and REBUILD_STATUS.md go-live steps; bank details marked "to be confirmed by the owner"

## Log

- Session 6: groups 1 to 8 done and pushed. SQL suite 575 checks, contract suite 46 tests.
