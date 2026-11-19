# Fresh-project baseline

The shop starts clean: a new, free Supabase project in a new organisation, with no data and no
templates from the old site. `0000_baseline.sql`, `0001_receipts_bucket.sql` and `0002_messages_and_admin_reports.sql` create everything.
Neither has been run on any live project. They were run only against a throwaway local PostgreSQL
(see "Tests").

The anon key is public (it ships to every browser), so row level security and the grants in the
baseline are the real security boundary. The rules in short:

- Browsers never write `orders`, `site_visits`, roles or account status. They call functions.
- Every `SECURITY DEFINER` function pins `search_path`; `EXECUTE` is revoked from everyone and granted
  back one function at a time at the end of `0000_baseline.sql`.
- `has_permission(text)` mirrors `src/lib/permissions.ts`. Change both together; the test
  `03_status_permissions.sql` checks the full role-by-permission matrix.

## Creating the project and applying the files

1. Create the organisation and a free project at supabase.com. Choose a region close to Lagos.
2. In the dashboard, open **SQL editor**, paste `0000_baseline.sql`, read it, run it. Then run
   `0001_receipts_bucket.sql`, then `0002_messages_and_admin_reports.sql`. (Or `supabase db push` after copying the files into
   `supabase/migrations` of a linked project.)
3. Create the owner by hand (next section). There is no sign-up path to owner.
4. In **Authentication**: turn on e-mail confirmation (guest orders are attached to an account only
   after the e-mail is verified), add the site URL and the redirect URLs for `/auth/callback`, and
   switch on Google if wanted.
5. Put these environment variables in Vercel (names only; never commit values):
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   (server only), `CRON_SECRET`.

## Creating the owner by hand

Nobody becomes owner or developer through the application, not even the first person to sign up,
and not through the service role: a trigger (`guard_protected_roles`) refuses it. The owner signs up
as an ordinary customer first (or is created under Authentication, Users, with the address
verified). Then, in the SQL editor, as the database owner:

```sql
begin;
select set_config('lbs.allow_protected_roles', 'on', true);   -- applies to this transaction only
update public.profiles set role = 'owner' where email = 'owner@example.com';
commit;
```

Replace the address with the real one. Use the same statement with `'developer'` for a developer
account. The same transaction-local setting is the only way to demote or delete an owner or
developer row; keep it out of application code.

Other staff are invited from the admin screen: the server calls `create_admin_invite(email, role)`
(roles `super_admin` or `editor`), which returns the token **once**; only its SHA-256 hash is stored.
The invitee signs up with the same e-mail address and passes the token as the sign-up metadata
`invite_token`; `handle_new_user` gives the invited role only for a valid, unexpired, unused token whose
invitation was made for that e-mail address, and marks it used. Roles are never read from
`raw_user_meta_data`.

## Banning and suspending

`profiles.account_status` (`active`, `suspended`, `banned`) is checked by `is_admin()`,
`has_permission()` and every policy and function: an account that is not `active` reads and writes
nothing and cannot place orders. Change it only with `set_account_status(user, status)`.

A ban must also end the person's sessions and stop new ones. From the server, with the service role,
call both:

```ts
await supabase.rpc("set_account_status", { p_user: id, p_status: "banned" });
await admin.auth.admin.updateUserById(id, { ban_duration: "876000h" }); // about 100 years; "none" lifts it
```

## What the application must call

| Need | Call |
|---|---|
| Quote before showing bank details | `quote_order(p_lines, p_promo, p_state)` |
| Place an order | `place_order(p_idempotency_key, p_contact, p_delivery, p_lines, p_promo, p_quoted_total, p_receipt_path)` |
| Validate a promo code | `validate_promo(p_code, p_subtotal)` |
| Customer cancels | `cancel_order(p_order_number, p_reason)` |
| Staff move an order | `set_order_status(p_order_number, p_status)` |
| Staff decide a receipt | `decide_payment(p_order_number, 'confirmed' or 'rejected')` |
| New receipt after rejection | `attach_receipt(p_order_number, p_path)` (the server does this for guests, with the service role) |
| Refund paid | `mark_refunded(p_order_number)` |
| Cancel unpaid rejected orders | `expire_unpaid_orders()` from a cron, service role only |
| Attach guest orders after verification | `claim_guest_orders()` after sign-in |
| Roles, status, privileges, deletion request | `set_staff_role`, `set_account_status`, `set_return_privilege`, `request_account_deletion` |
| Record a visit | `record_visit(...)`, then `update_visit_duration(id, seconds)` |
| Contact form | `submit_contact_message(...)`; staff reply with `reply_to_message(id, body)` |
| Admin figures | `admin_summary()`, `admin_order_counts()`, `admin_customers(search, limit, offset)`, `admin_customer_stats(since)`, `admin_analytics(days)` |

Line shape: `{ "product_id": uuid, "size": text, "colour": text, "qty": int }`; the colour is `''` for
products without colours. Contact: `{ name, email, phone }`. Delivery: `{ address, city, state,
landmark?, notes? }` (`state` is one of the ids in `delivery_fees`). Order functions return
`{ ok, ... }` or `{ ok: false, code, message, quote? }`; a `total_changed` result carries the correct
`quote` so the customer can confirm the new amount.

Order status follows the TRANSITIONS table in `src/lib/order-rules.ts`. `pending` to `confirmed`
happens only through `decide_payment`. Payment states: `awaiting_confirmation`, `confirmed`,
`rejected` (the customer has 48 hours; then `expire_unpaid_orders` cancels), `refund_owed` (set when a
paid order is cancelled), `refunded`.

Receipts: the server creates a signed upload URL for the private `payment-receipts` bucket with the
service role (`createSignedUploadUrl`) and the browser uploads straight to it, so no client write
policy exists. The bucket accepts JPEG, PNG, WebP and PDF up to 4 MB; HEIC is not accepted, so the
client must convert it (for example by re-encoding through a canvas) before upload.

## Tests

```sh
tests/sql/run.sh            # all files; or pass one: tests/sql/run.sh tests/sql/04_orders_place.sql
```

The script starts a throwaway PostgreSQL (the server binaries must be installed; as root it re-runs
itself as an unprivileged user), stubs the few Supabase pieces the baseline touches (`auth.users`,
`auth.uid()`, `auth.jwt()`, the three API roles, `storage`), applies the baseline files, and runs the
numbered test files, each in a rolled-back transaction, acting as `anon`, `authenticated` and
`service_role` through `SET ROLE`. The stubs are close to, but not identical with, real Supabase, so
**never run them against the real project**: they create test owner and staff users and an open
promo code, which would stay in production. Run them only locally (this script) or on a throwaway
Supabase project that is deleted afterwards. Any check kept for production must be read-only.

| File | Proves |
|---|---|
| `01_profiles_roles.sql` | no client can change role, `is_admin`, status, return privilege or deletion date; the owner cannot be demoted or deleted; nobody assigns owner |
| `02_signup_invites.sql` | no first-user owner; roles never from metadata; hashed, single-use, expiring, e-mail-bound invitations |
| `09_hardening.sql` | `place_order` and `quote_order` are server-only, the receipt must exist under the checkout's own folder and belong to one order; a cancelled order with an unaccepted receipt opens a refund check; failed checkouts and orphan receipts; `stock_version`; the shared rate limit; staff cannot edit other staff |
| `03_status_permissions.sql` | suspended and banned accounts get nothing; `has_permission` matches `permissions.ts` |
| `04_orders_place.sql` | no direct order writes; exact variant, inactive products, stock, promo, server total, idempotency, order numbers |
| `05_orders_lifecycle.sql` | cancellation, transitions, payment decision, rejection and expiry, refund owed, guest-order claim |
| `06_public_tables.sql` | promo codes hidden, editors cannot create them, reviews and testimonials unapproved, e-mails hidden, visits and activity log |
| `07_schema_grants.sql` | schema shape, indexes, `search_path`, function and table grants |
| `08_messages_admin.sql` | contact messages and replies, and the admin report functions with their permission checks |

Not covered: real Supabase Auth behaviour (ban durations, e-mail confirmation flow), Realtime, and
the storage API itself.
