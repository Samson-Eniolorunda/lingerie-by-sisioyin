# Owner setup: Lingeries by Sisioyin

Follow these steps in order. Nothing here has been run for you; no service is connected yet. Never
paste a key into the code, a chat or a commit: keys go only into the Vercel environment settings.

> **Status.** The application's Supabase data layer, the payment settings and the e-mail module are
> written and tested (see `REBUILD_STATUS.md`). They have been tested against a local PostgreSQL and
> a local stand-in for the Supabase service, never against a real Supabase project, because none has
> been set up yet. Steps 1 to 11 are the exact go-live path. With the Supabase variables **not** set,
> a live site refuses every request with a message naming the missing variables; it never shows
> invented data. Do the steps on a Vercel **preview** deployment first and move to the live address
> (`https://www.lingeriebysisioyin.store`) only after step 11 passes.

The live address is `https://www.lingeriebysisioyin.store`. Its DNS is on Cloudflare.

## 1. Create the Supabase organisation and project (London)

1. Go to supabase.com and sign in. Choose **New organisation**, name it "Lingeries by Sisioyin", plan **Free**.
2. Choose **New project** in that organisation. Name: `lingeries-by-sisioyin`. Region: **West EU (London)**.
   Set a strong database password and keep it in a password manager (not in the code).
3. When the project is ready, open **Project Settings, API Keys** and copy three values. Supabase
   now shows two kinds of key; either kind works, and the variable names below are the same:
   - Project URL: goes into `NEXT_PUBLIC_SUPABASE_URL`
   - the **publishable** key (`sb_publishable_...`), or on an older project the legacy `anon` public
     key: goes into `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - the **secret** key (`sb_secret_...`), or on an older project the legacy `service_role` key: goes
     into `SUPABASE_SERVICE_ROLE_KEY` (server only; never expose it, never put it in a variable that
     starts with `NEXT_PUBLIC_`)

## 2. Run the baseline SQL, in this order

Open **SQL editor, New query**. Paste the whole file, read it, press **Run**, and wait for "Success".

1. `supabase/baseline/0000_baseline.sql`
2. `supabase/baseline/0001_receipts_bucket.sql` (creates the private `payment-receipts` bucket)
3. `supabase/baseline/0002_messages_and_admin_reports.sql` (contact messages, the admin figures,
   the shared rate limit, failed checkouts and receipts with no order)
4. `supabase/baseline/0003_payments.sql` (bank details, payment methods, the change log and the
   groundwork for Paystack and Flutterwave)

Do not run them in another order and do not run any of them twice. If one fails, send the error text
to the developer; do not edit the file.

**Check that the database's main role bypasses row level security.** The shop's server-side functions
rely on it. In **SQL editor, New query** run this read-only check:

```sql
select rolbypassrls from pg_roles where rolname = 'postgres';
```

The answer must be `true`. If it is `false` (or no row appears), do **not** open the shop: nothing has
been changed by the check, so stop and send the developer a screenshot of the result and your
Supabase project's region and creation date. Do not try to alter roles yourself.

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
Configuration**: set **Site URL** to `https://www.lingeriebysisioyin.store` and put exactly these
entries in **Redirect URLs** (the `**` makes each one cover every path beneath it):

- `https://www.lingeriebysisioyin.store/**`
- `https://admin.lingeriebysisioyin.store/**` (the admin panel's own address, step 11.16)
- `http://localhost:3000/**`
- the Vercel preview pattern, for example `https://*-YOUR-TEAM.vercel.app/**` (Vercel shows the exact
  team part in **Project, Settings, Domains**; copy it from there)

Remove any other entry, in particular a bare `*`. Links in e-mails (confirmation, password reset)
return to the address of the deployment that sent them: on a Vercel preview they follow the address
you opened the preview on, provided it is the live domain, the preview's own address or its branch
address (the two addresses Vercel gives each deployment), or localhost on a developer's machine
(anything else is ignored, so a forged address cannot redirect a reset link); on the live site they use `NEXT_PUBLIC_SITE_URL` (step 8). Google sign-in is optional; if wanted,
switch it on under Providers.

**Send Supabase's own e-mails (confirmation, password reset) through Resend as well.** Supabase's
built-in sender allows only a handful of messages an hour. After step 6, open **Authentication,
Emails, SMTP Settings**, switch on **Custom SMTP** and enter: host `smtp.resend.com`, port `465`,
username `resend`, password your Resend API key (the same one as step 8), sender e-mail
`orders@lingeriebysisioyin.store`, sender name `Lingeries by Sisioyin`.

## 5. Cloudinary (product photographs)

1. Create a free account at cloudinary.com. On the dashboard copy:
   - Cloud name: `lingeries-by-sisioyin` goes into `CLOUDINARY_CLOUD_NAME`
   - API key: `CLOUDINARY_API_KEY`
   - API secret: `CLOUDINARY_API_SECRET` (server only)
2. Until these are set, the admin shows marked placeholder images.

## 6. E-mail: sending with Resend, receiving with Cloudflare

The shop sends order confirmations, payment confirmed or rejected, shipped notices and replies to
your messages through **Resend**. It receives customers' replies through **Cloudflare Email Routing**.

**Sending (Resend).**

1. Create an account at resend.com. Open **Domains, Add domain**, enter `lingeriebysisioyin.store`
   and choose the region **Europe (Ireland)** or the nearest offered.
2. Resend now shows a short list of DNS records. Add **each one exactly as shown** in Cloudflare:
   open the domain in the Cloudflare dashboard, **DNS, Records, Add record**. Typically they are:
   - a `TXT` record named `send` with Resend's SPF value (it begins `v=spf1 include:amazonses.com`),
   - an `MX` record named `send` pointing at the Amazon SES feedback host Resend names, with the
     priority Resend gives (usually 10),
   - a `TXT` record named `resend._domainkey` holding the long DKIM key,
   - optionally a `TXT` record named `_dmarc` with value `v=DMARC1; p=none;`.

   Copy the names and values from Resend, not from this page (they are different for each account).
   Set **Proxy status** to **DNS only** (grey cloud) on every one of them. These records sit on the
   `send` and `resend._domainkey` names, so they do not clash with Email Routing below.

3. Back in Resend press **Verify DNS Records**. It can take a few minutes. Only when the domain
   shows **Verified** will mail leave.
4. Open **API Keys, Create API key**, permission **Sending access**, domain
   `lingeriebysisioyin.store`. Copy it into the Vercel variable `RESEND_API_KEY` (step 8).

**Receiving (Cloudflare Email Routing).** Mail you send says "reply to `support@lingeriebysisioyin.store`".

1. In Cloudflare open the domain, **Email, Email Routing, Get started**. Cloudflare offers to add its
   own `MX` and `TXT` records at the root of the domain: accept them (they do not touch the `send`
   records above).
2. **Routing rules, Create address**: custom address `support`, action **Send to an e-mail**,
   destination your own inbox. Confirm the verification message Cloudflare sends there.
3. Optionally add `orders` the same way, so a reply to `orders@lingeriebysisioyin.store` also reaches you.
4. Test it: from another e-mail account write to `support@lingeriebysisioyin.store`; it must arrive
   in your inbox.

**The old worker.** The earlier site used a Cloudflare worker called `lbs-email-reply`. Nothing in
the new shop uses it. **After the new shop has gone live and a test e-mail has arrived through the
steps above**, delete it: Cloudflare, **Workers and Pages, lbs-email-reply, Settings, Delete**, and
remove any Email Routing rule or route that still points to it. Do not delete it before go-live.

## 7. Bank details for checkout

Customers send real money to whatever is saved here, so this is the most important screen of the shop.
The details are **not** in the code and **not** an environment variable: they are saved in the
database by you.

1. After step 10 (you can sign in), open **Admin, Settings, Payments**.
2. Choose the bank from the list of Nigerian banks, type the ten-digit account number and the account
   name exactly as your bank shows it, add an optional note (for example "Use your order number as
   the reference"), and press **Save bank details**.
3. Until you do, checkout says **"Payment details are being updated"**, shows no account number and
   does not let anyone place an order. That is deliberate.
4. Checkout, the order e-mails, the tracking page, the terms, the FAQ and the privacy policy all read
   what you saved. Every change is written to the change log at the foot of that screen with the old
   and the new values and who made it.
5. **Paystack and Flutterwave** appear on the same screen as **Not connected**. They are prepared but
   not built into checkout yet, and cannot be switched on. The names of the variables they will need
   are in step 8 for the day they are connected.

## 8. Vercel environment variables

In Vercel, **Project, Settings, Environment Variables**, add each name below for the environments
shown. Mark the secret ones **Sensitive**. Variables are set **per environment**: `NEXT_PUBLIC_SITE_URL`
is needed for Production only; do not set it for Preview, where it is ignored.

| Name                                                                   | Value                                                                                                                                                 | Required                                   |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `NEXT_PUBLIC_SITE_URL`                                                 | **Production only:** `https://www.lingeriebysisioyin.store`. No trailing slash. **Preview:** not needed and ignored (previews use their own address). | yes, for Production                        |
| `NEXT_PUBLIC_SUPABASE_URL`                                             | Supabase Project URL (step 1)                                                                                                                         | yes                                        |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`                                        | the publishable key, or the legacy `anon` key (step 1)                                                                                                | yes                                        |
| `SUPABASE_SERVICE_ROLE_KEY`                                            | the secret key, or the legacy `service_role` key (step 1)                                                                                             | yes, server only                           |
| `CRON_SECRET`                                                          | a long random string you invent (at least 32 characters)                                                                                              | yes                                        |
| `RESEND_API_KEY`                                                       | from step 6                                                                                                                                           | yes, to send e-mail                        |
| `EMAIL_FROM_ADDRESS`                                                   | `Lingeries by Sisioyin <orders@lingeriebysisioyin.store>`                                                                                             | yes, to send e-mail                        |
| `EMAIL_SUPPORT_ADDRESS`                                                | `support@lingeriebysisioyin.store` (where replies go)                                                                                                 | yes, to send e-mail                        |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | from step 5                                                                                                                                           | for photographs                            |
| `PAYSTACK_SECRET_KEY`                                                  | Paystack secret key                                                                                                                                   | only when Paystack is connected (later)    |
| `FLUTTERWAVE_SECRET_KEY`, `FLUTTERWAVE_SECRET_HASH`                    | Flutterwave secret key, and the secret hash you set in its dashboard                                                                                  | only when Flutterwave is connected (later) |
| `NEXT_PUBLIC_WHATSAPP_NUMBER`                                          | the shop number in international form, digits only                                                                                                    | optional                                   |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID`                                        | Google Analytics id                                                                                                                                   | optional (loads only after consent)        |
| `NEXT_PUBLIC_FB_PIXEL_ID`                                              | Meta Pixel id                                                                                                                                         | optional (loads only after consent)        |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`                                      | Maps key                                                                                                                                              | optional                                   |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`                                       | Cloudflare Turnstile site key for the live domains (Production and Preview; already added)                                                            | yes, for Production                        |
| `TURNSTILE_SECRET_KEY`                                                 | Cloudflare Turnstile secret key (Production and Preview; already added)                                                                               | yes, for Production, server only           |

**Turnstile (the security check on the forms).** The sign-up, sign-in, forgotten-password, contact and staff
sign-in forms show a Cloudflare Turnstile check, and the server verifies it before anything is sent to
Supabase or stored. On the live site both keys are required: with the secret key missing, the forms
refuse to send (and say so in the log) rather than skip the check. On Vercel previews the keys above are
ignored and Cloudflare's published always-pass test keys are used, because preview addresses are not on
the widget's list of domains. On a developer's machine, and in the automated tests, with no keys set the
check is skipped. In the Cloudflare dashboard, **Turnstile**, the widget's hostname list must
include `www.lingeriebysisioyin.store` and `admin.lingeriebysisioyin.store`, mode **Managed**. Supabase's own
CAPTCHA setting stays off.

Never set `LBS_ALLOW_DEMO` on the live site: it switches on demonstration sign-ins. (As a safeguard
it has no effect at all when Vercel's `VERCEL_ENV` is `production`, but do not rely on that.) Vercel
sets `VERCEL_URL` and `VERCEL_ENV` itself; do not add them.

## 9. Keep-alive and expiry cron

`vercel.json` already declares two daily jobs: `/api/cron/keep-alive` (05:17 UTC, one tiny read so
the free Supabase project is not paused after a week of silence) and `/api/cron/expire-orders`
(04:47 UTC, cancels unpaid orders after the 48-hour re-upload window and releases the stock). Vercel
sends `Authorization: Bearer <CRON_SECRET>` automatically once `CRON_SECRET` is set (step 8). After
the first deployment, open **Project, Settings, Cron Jobs** and confirm both are listed. Without
`CRON_SECRET` both jobs refuse to run.

## 10. Deploy and first sign-in

1. Deploy to a Vercel **preview** with the variables from step 8 (Preview values).
2. Open `/admin/sign-in` on the preview and sign in as the owner (step 3).
3. Do step 7 now: save the bank details.

## 11. Final checks before opening

Do these on the preview deployment, in this order. Each one is something the local tests could not
prove, because they ran against a stand-in, not against Supabase.

1. **Do not run `tests/sql` here.** Those tests create test owner and staff users and an open promo
   code (`OPEN10`) and are meant only for a local database or a throwaway Supabase project that you
   will delete afterwards. Running them in the real project would leave those accounts and that code
   behind. If you want a check of the real project, use only a read-only one: in the SQL editor run
   `select count(*) from public.orders;` (it must say 0 before opening) and
   `select email, role from public.profiles where role <> 'customer';` (it must list only you).
2. Open the preview address. The shop shows products only after you have added some at
   `/admin/products`; an empty shop is correct for a new project.
3. Add one product with a photograph and stock.
4. Create a customer account at `/sign-up`. Confirm the e-mail address from the message Supabase
   sends. Sign in.
5. Place a test order as that customer and attach a receipt. This is the one step that proves the
   private receipt upload works with the real Supabase Storage: the receipt must upload and, in the
   admin, open from the order page. If the upload is refused, tell the developer before going on.
   You should receive the order confirmation e-mail, with your bank details in it.
6. In the admin, confirm the payment (the customer receives "payment confirmed"), then move the order
   to processing, shipped (the customer receives the shipped e-mail) and delivered.
7. Place a second test order and cancel it from the admin while its receipt is still waiting. The
   order must show **Cancelled with a receipt on file: check the bank**; enter `0` to close the check.
8. Request a password reset for the customer; the link in the e-mail must open the page to choose a
   new password, and the new password must work. Do the same for the owner at
   `/admin/forgot-password`.
9. Invite a colleague from `/admin/team`. Open the link they would receive in a private window; the
   page **Join the team** creates their account. The invitee must **first confirm their e-mail
   address** (Supabase sends a confirmation message) and **then sign in** at `/admin/sign-in`; they
   are not signed in automatically. If an invitee signs up but never confirms (a mistyped address,
   a lost message), the invitation counts as used and cannot be reused: ask them to use the
   confirmation message again, or, if the address was wrong, delete that user under
   **Authentication, Users** in Supabase and send a new invitation from `/admin/team`.
10. Send a message from `/contact`; it must appear in `/admin/messages`, and your reply must reach the
    sender's inbox.
11. Accept analytics in the cookie card, browse two pages, and check `/admin/analytics` shows them
    after a minute.
12. Make sure no demonstration sign-in or reset link is visible, and that `LBS_ALLOW_DEMO` is not set.
13. Read the bank details at checkout aloud against your bank app (step 7).
14. Add the live domain in Vercel (**Settings, Domains**: add `www.lingeriebysisioyin.store`, and
    add `lingeriebysisioyin.store` set to redirect to `www`). Then, in Cloudflare **DNS, Records**:
    - **Remove the old site's records** for both names (`www` and the root `lingeriebysisioyin.store`),
      whatever type they are.
    - `www` must be a **CNAME** to the target Vercel shows for it (it names the exact value), with
      **Proxy status: DNS only** (grey cloud, **not** orange).
    - The **root** domain redirects to `www` through the **A record** Vercel shows for the apex, also
      **DNS only** (grey cloud).
    - SSL needs **no Cloudflare change**: because the proxy is off, Vercel issues and serves the
      certificate itself. Do not turn the proxy on, and leave Cloudflare's SSL/TLS settings as they are.

    **Why the proxy must be off.** If `www` were proxied (orange cloud), every visitor would reach
    Vercel through Cloudflare's servers, so Vercel would see only Cloudflare's addresses instead of
    the customers' own. The shop's per-address limits (sign-in attempts, uploads, orders) would then
    count many different customers as one and could block real customers. With the proxy off, Vercel
    sees each customer's real address. (The e-mail records in step 6 stay exactly as they are: DNS
    only as well.)

    Then repeat checks 5 and 8 once on `https://www.lingeriebysisioyin.store`, and delete the old
    worker `lbs-email-reply` (step 6).

15. **Clean up the test data before you open.** The test orders, the test customer and the test
    visits would otherwise count in the admin figures (orders, revenue, customers, analytics) and use
    up stock and promo codes. Do this once, after check 14, and only for data you created yourself.

    1. **Mark your tests.** For every test order from now on (and, if you can, for the ones already
       placed) use an e-mail address with the marker `+lbstest` in it, for example
       `yourname+lbstest@gmail.com` (the part after `+` is ignored by Gmail, so the mail still
       reaches you). The clean-up below touches only rows carrying that marker.
    2. **Back up first.** In Supabase **Table Editor**, open each of `orders`, `profiles`,
       `site_visits`, `promo_codes`, `receipt_uploads` and `checkout_failures`, and use
       **Export, Export as CSV**. Keep the files. Do not go on until all are saved.
    3. **Put the stock back.** In the admin, open each test order and **cancel** it (this returns
       the stock); you need not settle refunds, since these orders are deleted next.
    4. **Remove the test rows.** In **SQL editor, New query** first run this read-only count and check
       that it lists only your own test orders:

       ```sql
       select order_number, customer_email, status, created_at
         from public.orders
        where customer_email ilike '%+lbstest@%'
        order by created_at;
       ```

       If it is right, run the clean-up. It is one transaction; it deletes only rows that carry the
       marker, and it ends by showing what is left (replace `YOUR.IP.ADDRESS` with the public address
       of the connection you tested from, shown at whatismyip.com, and `2026-01-01 00:00` with the
       date and time you began testing, in UTC):

       ```sql
       begin;
       -- Give promo codes back the uses the test orders took. Orders you cancelled in step 3 gave
       -- their use back then, so they are left out here.
       update public.promo_codes p
          set used_count = greatest(0, p.used_count - t.n)
         from (select promo_code, count(*) as n
                 from public.orders
                where customer_email ilike '%+lbstest@%' and promo_code is not null
                  and status <> 'cancelled'
                group by promo_code) t
        where upper(p.code) = upper(t.promo_code);
       delete from public.checkout_failures where customer_email ilike '%+lbstest@%';
       delete from public.orders            where customer_email ilike '%+lbstest@%';
       delete from public.site_visits
        where ip_address = 'YOUR.IP.ADDRESS' and created_at >= timestamptz '2026-01-01 00:00+00';
       select (select count(*) from public.orders where customer_email ilike '%+lbstest@%') as test_orders_left,
              (select count(*) from public.orders) as orders_total,
              (select count(*) from public.site_visits
                where ip_address = 'YOUR.IP.ADDRESS' and created_at >= timestamptz '2026-01-01 00:00+00') as test_visits_left;
       commit;
       ```

       `test_orders_left` and `test_visits_left` must both be `0`. If anything looks wrong, run
       `rollback;` instead of `commit;` and nothing is changed. The notes of the uploaded receipts
       (`receipt_uploads`) are deliberately **not** deleted here: until the receipt files themselves
       are deleted (step 6) they are the only place that shows the `+lbstest` contact details.

    5. **Remove the test customer.** In **Authentication, Users**, delete the test customer account
       (the one with the `+lbstest` address). Its profile and addresses go with it. Never delete the
       owner or a real colleague.
    6. **Remove the test receipts.** Open **Admin, Receipts with no order**. The receipts of the
       deleted test orders now appear there, with the `+lbstest` contact details. Press **View
       receipt** on each (a receipt nobody has opened cannot be deleted), then **Delete**. Abandoned
       uploads need to be a day old before they can be deleted. When every test receipt is gone,
       remove their notes in **SQL editor, New query** (it deletes only notes with the marker whose
       file no longer exists):

       ```sql
       delete from public.receipt_uploads u
        where u.customer_email ilike '%+lbstest@%'
          and not exists (select 1 from storage.objects o
                           where o.bucket_id = 'payment-receipts' and o.name = u.receipt_path);
       ```

    7. Check `https://admin.lingeriebysisioyin.store/` and `https://admin.lingeriebysisioyin.store/analytics`: orders, revenue, customers and visits must read as for a
       brand new shop, and `select count(*) from public.orders;` must say `0`.

16. **The admin panel has its own address.** On the live site (Vercel's Production environment only)
    the admin is served at `https://admin.lingeriebysisioyin.store`, with the `/admin` part dropped:
    `admin.lingeriebysisioyin.store/orders` is the Orders screen. On previews and on a developer's
    machine it stays at `/admin/...`. The shop address answers `/admin` with a plain "Not Found" and
    never mentions the admin. Set up as follows:
    1. **Cloudflare** (already done by the owner): a `CNAME` record named `admin` pointing to
       `cname.vercel-dns.com`, **Proxy status: DNS only** (grey cloud), for the same reason as `www`
       in check 14.
    2. **Supabase** (already done by the owner): the Redirect URL `https://admin.lingeriebysisioyin.store/**`
       (step 4).
    3. **Vercel**: the domain `admin.lingeriebysisioyin.store` is added to the project under
       **Settings, Domains** by the developer. Nothing else is needed: the address is worked out from
       `NEXT_PUBLIC_SITE_URL`. (`NEXT_PUBLIC_ADMIN_HOST` exists only to test this on another host; do
       not set it on the live site.)
    4. Staff sign in separately on the admin address: the sign-in cookies belong to one address, so
       signing in to the shop does not sign anyone in to the admin. Password-reset and invitation
       links for staff return to the admin address.
    5. **Before the first live deploy:** both `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`
       must be set for Production, and the Turnstile widget's hostnames must include
       `www.lingeriebysisioyin.store` and `admin.lingeriebysisioyin.store`. Without them every protected
       form refuses, including staff sign-in, so the admin would be locked until they are fixed and the
       site redeployed.
    6. **Right after the first live deploy**, check in this order: `https://www.lingeriebysisioyin.store/admin`
       shows "Not Found"; `https://admin.lingeriebysisioyin.store/` shows the staff sign-in with the
       Turnstile check, and signing in works; `https://admin.lingeriebysisioyin.store/orders` opens the
       Orders screen; a staff password-reset e-mail link opens on the admin address and works; the
       Turnstile check passes on the shop's sign-in and contact pages. Previews never show these, because
       the admin address and the real Turnstile keys are used only on the live site.

## 12. After opening

- **Receipts with no order** (admin menu): if a customer pays and uploads a receipt but the order
  cannot be placed (the stock sold out, a promo code ran out, the total changed), their receipt and
  contact details appear there as an open item. Contact them, refund them in full, and close the item.
  Every receipt there shows the customer's contact details and a **View receipt** link. A receipt
  that no member of staff has opened can never be deleted; opening and deleting are both recorded in
  the activity log. Abandoned uploads (the customer never placed the order) can be deleted once they
  are a day old and have been opened.
- **Refund checks**: an order cancelled while its receipt was waiting, or after a rejected receipt,
  is flagged **check the bank**. Look at your account, enter what arrived, and refund it.
- **Reviews and testimonials** wait for your approval at `https://admin.lingeriebysisioyin.store/reviews`; nothing a visitor sends in
  is shown until you approve it.
- **Backups**: the free Supabase plan does not include point-in-time backups. Export the tables
  from the dashboard now and then, or move to a paid plan once the shop has regular orders.
