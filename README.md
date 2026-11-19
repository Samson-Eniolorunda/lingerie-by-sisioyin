# Lingeries by Sisioyin

A phone-first online shop for lingerie, loungewear and underwear, built with Next.js, strict
TypeScript and Supabase. This branch (`rebuild/production`) replaces the old static site; the old
pages and their data are gone and the shop starts clean.

## Where things are

| Path | What it holds |
|---|---|
| `src/app` | Pages and route handlers (storefront, `/admin`, `/auth/callback`, cron routes) |
| `src/server/data` | The data contracts and the one place that chooses an implementation |
| `src/server/mock` | The in-memory development store behind the contracts |
| `src/server/actions` | Server actions; they call only the contracts |
| `supabase/baseline` | The SQL for the new Supabase project, with its own README |
| `tests/unit`, `tests/e2e`, `tests/sql` | Vitest, Playwright and the SQL tests |
| `REBUILD_PLAN.md`, `REBUILD_STATUS.md` | The plan, and what is done and what is not |

## Running it

```sh
npm ci
npm run dev            # development store, demonstration sign-ins shown on the sign-in screens
npm run check          # typecheck, lint, format, forbidden patterns, unit tests
npm run build && npm run test:e2e
npm run test:sql       # needs PostgreSQL 16 binaries; see supabase/baseline/README.md
```

With no Supabase address set, the shop runs on the development store. Setting
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` switches to Supabase mode, which
needs the Supabase implementation of the contracts (not written yet) and the baseline applied;
see `REBUILD_STATUS.md`.

## Environment variable names

`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` (server only), `CRON_SECRET`, `CLOUDINARY_CLOUD_NAME`,
`CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS`,
`EMAIL_SUPPORT_ADDRESS`, `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`,
`NEXT_PUBLIC_GA_MEASUREMENT_ID`, `NEXT_PUBLIC_FB_PIXEL_ID`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`,
`NEXT_PUBLIC_WHATSAPP_NUMBER`. `LBS_ALLOW_DEMO=true` shows demonstration sign-ins on a built server
(the browser tests set it; never set it on a deployed site).
