# Owner setup: Lingeries by Sisioyin

Follow these steps in order. Nothing here has been run for you; no service is connected yet. Never
paste a key into the code, a chat or a commit: keys go only into the Vercel environment settings.

> **Important.** The application's Supabase data layer is not written yet (see `REBUILD_STATUS.md`,
> "Known gaps"). Steps 1 to 4 prepare the database and can be done now. With the Supabase variables
> set, the app will refuse to serve fake data and show a clear message until that layer is built and
> tested. Do not set the Supabase variables on the live site before then; use a preview deployment.

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

Do not run them in the other order and do not run either twice. If one fails, send the error text
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

## 6. Bank details for checkout

The bank transfer details are not an environment variable. They live in one place in the code:
`BANK` in `src/config/site.ts` (`bankName`, `accountNumber`, `accountName`). They currently hold the
earlier details and must be confirmed by you. Ask the developer to change them, or edit those three
lines and commit. The terms and FAQ text under `src/content` also name the account and must match.

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

1. Run the SQL tests' checks once in the SQL editor of the real project (`tests/sql`), as the README
   in `supabase/baseline` explains.
2. Sign in as the owner at `/admin/sign-in`, place a test order, upload a receipt and confirm it.
3. Make sure no demonstration sign-in or reset link is visible on the live site.
