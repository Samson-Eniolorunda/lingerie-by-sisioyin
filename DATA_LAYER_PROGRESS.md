# Data layer progress

DONE

Branch `rebuild/production`. Goal: the real Supabase implementation of every data contract, tested
against a local PostgreSQL (never a remote service).

## Summary

- **Written:** `src/server/supabase/*` implements every contract (catalogue, orders, contact, auth, account, admin, engagement) against `supabase/baseline`; receipts in the private bucket (`src/server/storage/receipts-supabase.ts`); `@supabase/ssr` cookies per audience, proxy refresh, `/auth/callback` code exchange, Google redirect, password recovery; `DATA_MODE` is `supabase`, `mock` (development or `LBS_ALLOW_DEMO=true` only) or `unconfigured` (production without configuration: every call refused, never fake data).
- **SQL:** new `0002_messages_and_admin_reports.sql`; `0000_baseline.sql` now sells assorted packs and plain products and uses the app's stock wording. SQL suite: 575 checks pass.
- **Local stack:** `tests/support/local-stack` (PostgreSQL 16 plus a local stand-in for the Supabase HTTP API). `npm run test:contract` (46 tests), `npm run test:e2e:supabase` (Playwright with `DATA_MODE=supabase`).
- **Gates (all clean):** format, lint (0 warnings), typecheck, forbidden patterns, unit (156), SQL (575), contract (46), build, Playwright on the mock (340 passed, 13 skipped) and on the local Postgres (340 passed, 13 skipped).
- **Docs:** `OWNER_SETUP.md` (go-live steps 1 to 10; bank details marked TO BE CONFIRMED BY THE OWNER, also in `src/config/site.ts`) and `REBUILD_STATUS.md` (Session 6) replace the old "data layer not written" warning.

## Not proven here (real Supabase needed; steps in OWNER_SETUP.md step 9)

Plain-`PUT` signed receipt upload against real Storage; real GoTrue e-mail confirmation, recovery, ban and Google; the SQL tests in the real SQL editor; RLS through the real PostgREST.

## Still open

E-mail sending; the invitation sign-up screen; review and testimonial moderation screens; receipt clean-up of uploads with no order; per-instance sign-in lock and upload limiter.

## Log

- Session 6: all groups done and pushed.
