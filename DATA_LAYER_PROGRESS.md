# Data layer progress

Branch `rebuild/production`. Goal: the real Supabase implementation of every data contract, tested
against a local PostgreSQL (never a remote service).

## Plan (commit groups)

1. [x] SQL: `0002_messages_and_admin_reports.sql` (contact messages, replies, admin report functions) and tests `08_messages_admin.sql`
2. [ ] Local stack for tests: PostgreSQL plus a small local stand-in for the Supabase HTTP API (PostgREST subset, GoTrue subset, storage subset)
3. [ ] Supabase clients, catalogue, settings
4. [ ] Auth (`@supabase/ssr` cookies, proxy refresh, callback code exchange, Google redirect)
5. [ ] Orders, promos, receipts storage
6. [ ] Account
7. [ ] Admin (products, orders, customers, promos, messages, analytics, staff and invites, activity, settings)
8. [ ] Contract tests, Playwright against the local database, docs (OWNER_SETUP, REBUILD_STATUS)

## Log

- Session 6: group 1 done (SQL suite 567 checks pass).
