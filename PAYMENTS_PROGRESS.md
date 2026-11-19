# Payments progress

DONE

Branch `rebuild/production`. Part R (go/no-go review fixes) and Part P (payments, e-mail, open items) are finished and pushed. Details are in `REBUILD_STATUS.md` (Session 7) and `OWNER_SETUP.md` (exact go-live steps, SQL files 0000 to 0003 in order).

## Summary

- **Part R:** `place_order` and `quote_order` are server-only; the receipt is mandatory, must live under the checkout's own folder, exist in the private bucket and belong to one order; shared database rate limit on orders, tracking, receipts, contact, reviews, testimonials, visits and invitations; `refund_check` payment state with admin actions; failed checkouts and orphan receipts visible and closable at `/admin/receipts`; checkout no longer says "nothing was charged"; `tests/sql` removed from the real-project steps; tracking returns a trimmed order; `updateProduct` guards stock with `stock_version`; auth links per environment and the confirmed-address message; proxy cookie pattern; raw auth errors hidden; staff cannot edit other staff.
- **Part P:** bank details in the database (Admin, Settings, Payments, list of Nigerian banks, change log with old and new values) and read by checkout, tracking, e-mails, terms, FAQ and privacy ("Payment details are being updated" when none); Paystack and Flutterwave prepared, not integrated (provider interface, real signature checks, webhook routes, per-method switch, gateway order states); Resend e-mail module with British English templates; staff invitation sign-up, review and testimonial moderation, orphan receipt clean-up.

## Gates (final run)

format, lint (0 warnings), typecheck and forbidden patterns clean; unit 180; SQL 698 checks; contract 55; Playwright on the local PostgreSQL stack 350 passed, 15 skipped; Playwright on the mock 351 passed, 13 skipped in the last full run (its one failure, MO-08, was a race between the two projects and was fixed, then passed on its own).

## Not proven here

Real Supabase (Storage upload, GoTrue e-mails, PostgREST), real Resend delivery, and the build with the Supabase variables set. E-mail was tested with the in-memory transport and a mocked Resend call only. The rate limits are bypassed when `LBS_ALLOW_DEMO=true` (browser tests); their behaviour is proven by unit and SQL tests.

## Still open

Per-instance sign-in lock; no customer-facing review, testimonial or newsletter form yet; `record_visit` and `submit_contact_message` remain callable directly with the public key; the invitation link is shown to the owner but not e-mailed.
