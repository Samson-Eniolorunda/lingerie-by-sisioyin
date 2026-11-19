# Owner setup: Lingeries by Sisioyin

Follow these steps in order. Nothing here has been run for you; no service is connected yet. Never
paste a key into the code, a chat or a commit: keys go only into the Vercel environment settings.

> **Status.** The application's Supabase data layer is written and tested (see `REBUILD_STATUS.md`).
> It has been tested against a local PostgreSQL and a local stand-in for the Supabase service, never
> against a real Supabase project, because none exists yet. Steps 1 to 9 are the exact go-live path.
> With the Supabase variables **not** set, a live site refuses every request with a message naming the
> missing variables; it never shows invented data. Do the steps on a Vercel **preview** deployment
> first and move to the live address only after step 9 passes.

## 1. Create the Supabase organisation and project (London)

1. Go to supabase.com and sign in. Choose **New organisation**, name it "Lingeries by Sisioyin", plan **Free**.
2. Choose **New project** in that organisation. Name: `lingeries-by-sisioyin`. Region: **West EU (London)**.
   Set a strong database password and keep it in a password manager (not in the code).
3. When the project is ready, open **Project Settings, API** and copy three values:
   - Project URL: goes into `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` public key: goes into `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` secret key: goes into `SUPABASE_SERVICE_ROLE_KEY` (server only; never expose it)

## 2. Run the baseline SQL, in this order

Open **SQL editor, New query**. Paste the whole file, read it, press **Run**, and wait for "Success".

1. `supabase/baseline/0000_baseline.sql`
2. `supabase/baseline/0001_receipts_bucket.sql` (creates the private `payment-receipts` bucket)
3. `supabase/baseline/0002_messages_and_admin_reports.sql` (contact messages and the admin figures)

Do not run them in another order and do not run any of them twice. If one fails, send the error text
to the developer; do not edit the file.

## 3. Create the owner account by hand

No sign-up can ever become owner. Do this once.

1. Open **Authentication, Users, Add user, Create new user**. Enter your e-mail address and a strong
   password, tick **Auto Confirm User**, and create it. (The address must be one you can receive
   e-mail on.)
2. Open **SQL editor, New query**, paste the following, replace `owner@example.com` with the same
   address, and run it:

```sql
begin;
select set_config('lbs.allow_protected_roles', 'on', true);
update public.profiles set role = 'owner' where email = 'owner@example.com';
commit;
```

3. Check it: run `select email, role, is_admin from public.profiles where role = 'owner';`. One row
   should appear with `is_admin` true. If none appears, the profile was not created; tell the developer.

## 4. Authentication settings

In **Authentication, Providers, Email**: keep **Confirm email** on. In **Authentication, URL
Configuration**: set **Site URL** to your live address (the value of `NEXT_PUBLIC_SITE_URL`) and add
`https://YOUR-DOMAIN/auth/callback` and `http://localhost:3000/auth/callback` to the redirect URLs.
Google sign-in is optional; if wanted, switch it on under Providers.

## 5. Cloudinary (product photographs)

1. Create a free account at cloudinary.com. On the dashboard copy:
   - Cloud name: `CLOUDINARY_CLOUD_NAME`
   - API key: `CLOUDINARY_API_KEY`
   - API secret: `CLOUDINARY_API_SECRET` (server only)
2. Until these are set, the admin shows marked placeholder images.

## 6. Bank details for checkout: TO BE CONFIRMED BY THE OWNER

> **The bank details in the code are not confirmed.** They are the details of the earlier shop and
> nobody has checked them against your current account. Do not open the shop until you have read
> them on the checkout page and they are exactly right: customers send real money to them.

The bank transfer details are not an environment variable. They live in one place in the code:
`BANK` in `src/config/site.ts` (`bankName`, `accountNumber`, `accountName`), and the checkout shows
what is written there. Ask the developer to change them, or edit those three lines and commit. The
bank fields on the admin **Settings** page are saved in the database but the checkout does not read
them, so changing them there does not change what customers see. The terms and FAQ text under
`src/content` also name the account and must match.

## 7. Vercel environment variables

In Vercel, **Project, Settings, Environment Variables**, add each name below for Production (and
Preview). Mark the secret ones **Sensitive**.

| Name                                                                   | Value                                                                    | Required                            |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------- |
| `NEXT_PUBLIC_SITE_URL`                                                 | your live address, for example `https://example.com` (no trailing slash) | yes                                 |
| `NEXT_PUBLIC_SUPABASE_URL`                                             | Supabase Project URL (step 1)                                            | yes, when database is connected     |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`                                        | Supabase `anon` key (step 1)                                             | yes, when database is connected     |
| `SUPABASE_SERVICE_ROLE_KEY`                                            | Supabase `service_role` key (step 1)                                     | yes, server only                    |
| `CRON_SECRET`                                                          | a long random string you invent (at least 32 characters)                 | yes                                 |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | from step 5                                                              | for photographs                     |
| `NEXT_PUBLIC_WHATSAPP_NUMBER`                                          | the shop number in international form, digits only                       | optional                            |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID`                                        | Google Analytics id                                                      | optional (loads only after consent) |
| `NEXT_PUBLIC_FB_PIXEL_ID`                                              | Meta Pixel id                                                            | optional (loads only after consent) |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`                                      | Maps key                                                                 | optional                            |
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`                                       | reCAPTCHA site key                                                       | optional                            |

Never set `LBS_ALLOW_DEMO` on the live site: it switches on demonstration sign-ins.

## 8. Keep-alive and expiry cron

`vercel.json` already declares two daily jobs: `/api/cron/keep-alive` (05:17 UTC, one tiny read so
the free Supabase project is not paused after a week of silence) and `/api/cron/expire-orders`
(04:47 UTC, cancels unpaid orders after the 48-hour re-upload window and releases the stock). Vercel
sends `Authorization: Bearer <CRON_SECRET>` automatically once `CRON_SECRET` is set (step 7). After
the first deployment, open **Project, Settings, Cron Jobs** and confirm both are listed. Without
`CRON_SECRET` both jobs refuse to run.

## 9. Final checks before opening

Do these on the preview deployment, in this order. Each one is something the local tests could not
prove, because they ran against a stand-in, not against Supabase.

1. Run the SQL tests' checks once in the SQL editor of the real project (`tests/sql`), as the README
   in `supabase/baseline` explains. (If any check fails, stop and tell the developer.)
2. Open the preview address. The shop must show products only after you have added some at
   `/admin/products`; an empty shop is correct for a new project.
3. Sign in at `/admin/sign-in` as the owner. Add one product with a photograph and stock.
4. Create a customer account at `/sign-up`. Confirm the e-mail address from the message Supabase
   sends. Sign in.
5. Place a test order as that customer and attach a receipt. This is the one step that proves the
   private receipt upload works with the real Supabase Storage: the receipt must upload and, in the
   admin, open from the order page. If the upload is refused, tell the developer before going on.
6. In the admin, confirm the payment, then move the order to processing, shipped and delivered.
7. Request a password reset for the customer; the link in the e-mail must open the page to choose a
   new password, and the new password must work. Do the same for the owner at
   `/admin/forgot-password`.
8. Send a message from `/contact`; it must appear in `/admin/messages`.
9. Accept analytics in the cookie card, browse two pages, and check `/admin/analytics` shows them
   after a minute.
10. Make sure no demonstration sign-in or reset link is visible, and that `LBS_ALLOW_DEMO` is not set.
11. Read the bank details at checkout aloud against your bank app (step 6).

## 10. After opening

- **People you invite as staff**: from `/admin/team` the owner creates an invitation. The invited
  person must sign up with the same address and the invitation token; the screen that accepts the
  token is not built yet (see `REBUILD_STATUS.md`), so until it is, give staff access by asking the
  developer to run the documented role statement for you.
- **E-mail** (order confirmation, replies, invitations) is not sent by the application yet. Replies
  you write in the admin are stored but not e-mailed; reply by WhatsApp or e-mail yourself for now.
- **Backups**: the free Supabase plan does not include point-in-time backups. Export the tables
  from the dashboard now and then, or move to a paid plan once the shop has regular orders.
