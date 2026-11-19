# Go-live progress

DONE

All seven groups from the final go/no-go review are complete on `rebuild/production`.

1. **DNS and client address.** OWNER_SETUP step 11.14 now states: `www` is a CNAME to Vercel's target with Cloudflare proxy off (DNS only); the root domain redirects to `www` through Vercel's apex A record, also DNS only; the old site's records for both names are removed; SSL needs no Cloudflare change; and why a proxied `www` would break per-address limits. `clientIp()` prefers `x-vercel-forwarded-for`, then `x-real-ip`.
2. **Money.** A failure, with the customer's contact details, is recorded on every path after a receipt upload: order rate limit, missing bank details, and RPC or network error. Uploads never followed by an order are traced through the new `receipt_uploads` table, filled when the upload address is issued. `/admin/receipts` always shows contact details and a "View receipt" link. A receipt that no staff member has opened can never be deleted, and opening and deletion are both logged.
3. **Demo switch.** `LBS_ALLOW_DEMO` has no effect when `VERCEL_ENV` is `production`. The rate-limit bypass applies only to the mock store. The mock bank is now "Demonstration Bank", 0000000000, "DEMONSTRATION ONLY".
4. **Role check.** OWNER_SETUP has the read-only `rolbypassrls` check straight after the SQL step, with what to do if it is not true.
5. **Preview links.** Auth e-mail links on previews use the request's own host, checked against an allow-list (production domain, this deployment's `VERCEL_URL` and `VERCEL_BRANCH_URL`, localhost in development only). OWNER_SETUP says Preview `NEXT_PUBLIC_SITE_URL` is not needed and is ignored.
6. **Owner steps and e-mail.** Step 11.9 says an invitee confirms their e-mail first, then signs in. A new step 11.15 cleans up test data: backup first, then marker-scoped SQL (`+lbstest`), removal of the test customer, and deletion of test receipts. The SQL is proven by `tests/sql/11_owner_cleanup.sql`. The order confirmation no longer tells guests they can cancel online.
7. **Low items.**
   - `updated_by` is removed from both public payment tables; who changed what stays in the staff-only change log.
   - `resolve_refund_check` records an overpayment as owed in full.
   - An invite used by an unconfirmed sign-up is documented in step 11.9, including how to re-invite.

## Gates (all passed)

- format, lint (0 warnings), typecheck, forbidden-word check
- 195 unit tests
- SQL suite: 11 files, 719 checks
- 56 contract tests against the local stack
- production build (needs `LBS_ALLOW_DEMO=true` to build without Supabase variables, as the browser tests do)
- Playwright on the mock store: 354 passed, 13 skipped
- Playwright on the local stack: 352 passed, 15 skipped

Not done by design: nothing was run against the real Supabase project, nothing was merged or deployed, and `main` was not touched.
