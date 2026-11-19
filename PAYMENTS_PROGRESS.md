# Payments progress

IN PROGRESS. Branch `rebuild/production`. Part R (go/no-go review fixes) first, then Part P.

## Log

- R1/R2/R5/R8 SQL done in the baseline files (place_order server-only, refund_check, stock_version, rate limits, checkout failures, orphan receipts, staff profile policy); SQL suite 641 checks.
- Part R (items 1 to 8) done and pushed: SQL 641 checks, contract 51, unit 161. Browser suites to be re-run at the end.
- P1 done: bank details in database (0003_payments.sql), admin Settings -> Payments, checkout/tracking/terms/FAQ read stored values; BANK constant removed.
