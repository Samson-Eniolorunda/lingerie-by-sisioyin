# Email Reply Webhook Setup

When a customer replies to any email sent from the store (order confirmation,
contact form auto-reply, admin reply), the reply is captured and displayed in
the admin **Messages** tab — just like a chat thread.

---

## Architecture

```
Customer ──reply──→ support+{msgId}@lingeriebysisioyin.store
                          │
              Cloudflare Email Routing
                          │
              Cloudflare Email Worker
              (email-worker/ in this repo)
                          │
                    HTTP POST (JSON)
                          │
              receive-email-reply (Supabase Edge Function)
                          │
                    message_replies table
                     (sender_type = 'customer')
                          │
                    Admin Messages tab
```

### Before Cloudflare (current)

Replies to `support+{id}@lingeriebysisioyin.store` are delivered to Zoho
(the current MX provider). They land in your **support@** inbox because
Zoho strips the `+tag` and routes to the base address. You can read them
manually in Zoho — nothing breaks. Replies just aren't auto-piped into the
admin Messages tab yet.

### After Cloudflare (progressive upgrade)

Once you move nameservers to Cloudflare and enable Email Routing, customer
replies are **automatically** parsed by the Email Worker and appear in the
admin Messages thread within seconds — no manual checking required.

---

## Setup Steps

### 1. Create a free Cloudflare account

Go to [dash.cloudflare.com](https://dash.cloudflare.com) and sign up (free).

### 2. Add your domain to Cloudflare

1. Click **Add a site** → enter `lingeriebysisioyin.store`
2. Choose the **Free** plan
3. Cloudflare auto-imports your existing DNS records (Zoho MX, Vercel CNAME,
   TXT records, etc.) — **verify every record is imported correctly**
4. Cloudflare gives you two nameservers (e.g. `adam.ns.cloudflare.com` /
   `lisa.ns.cloudflare.com`)

### 3. Change nameservers at Namecheap

1. Go to [Namecheap → Domain List](https://ap.www.namecheap.com/domains/list/)
2. Click **Manage** on `lingeriebysisioyin.store`
3. Under **Nameservers**, switch from "Namecheap BasicDNS" to **Custom DNS**
4. Enter the two Cloudflare nameservers
5. Save — propagation takes up to 24 hours (usually ~1 hour)

> **Important:** After moving nameservers, all DNS is managed in Cloudflare.
> Make sure Zoho MX records, Vercel CNAME, SPF/DKIM/DMARC TXT records are
> all present in the Cloudflare DNS dashboard before switching.

### 4. Enable Email Routing

1. In Cloudflare dashboard → **Email** → **Email Routing** → **Get started**
2. Cloudflare adds its MX records (replaces Zoho MX)
3. Add **destination addresses** (these need email verification):
   - Your personal Gmail or Yahoo address (e.g. `youremail@gmail.com`)
4. Create forwarding rules for your existing aliases:
   - `support@lingeriebysisioyin.store` → your personal email
   - `orders@lingeriebysisioyin.store` → your personal email
   - `info@lingeriebysisioyin.store` → your personal email
   - `contact@lingeriebysisioyin.store` → your personal email

> **Note:** Outgoing email (Resend API) is unaffected — SMTP/SPF/DKIM are
> separate from inbound MX. Only the *receiving* path changes.

### 5. Deploy the Cloudflare Email Worker

```bash
cd email-worker
npm install
npx wrangler login          # authenticate with Cloudflare
npx wrangler secret put WEBHOOK_URL
# When prompted, paste:
# https://oriojylsilcsvcsefuux.supabase.co/functions/v1/receive-email-reply
npx wrangler deploy
```

### 6. Route replies to the Worker

1. In Cloudflare dashboard → **Email** → **Email Routing** → **Routes**
2. Set the **Catch-all** action to **Send to a Worker** → select `lbs-email-reply`

   This means:
   - `support@`, `orders@`, etc. → forwarded to your personal email (step 4)
   - Everything else (including `support+{id}@`) → Email Worker → Supabase

### 7. Deploy the Supabase Edge Function

```bash
supabase functions deploy receive-email-reply --no-verify-jwt
```

The `--no-verify-jwt` flag is required because the Cloudflare Worker's POST
requests don't include a Supabase JWT.

---

## How It Works

### Outgoing Emails (tagged reply-to)

Every email sent to customers includes a tagged reply-to address:

- **Contact form auto-reply**: `support+{messageId}@lingeriebysisioyin.store`
- **Admin reply email**: `support+{messageId}@lingeriebysisioyin.store`
- **Order confirmation**: `support+{orderMsgId}@lingeriebysisioyin.store`

The `{messageId}` is the UUID of the `contact_messages` row, so when the
customer replies, we know exactly which thread to add it to.

Zoho's plus-addressing means `support+anything@` is delivered to the same
`support@` mailbox — so replies work today even without Cloudflare.

### Inbound Processing (with Cloudflare)

1. Customer hits **Reply** in Gmail / Yahoo / Outlook
2. Email goes to `support+{id}@lingeriebysisioyin.store`
3. Cloudflare Email Routing receives it (MX)
4. Catch-all rule sends it to the `lbs-email-reply` Worker
5. Worker parses MIME email → extracts From, Subject, body
6. Worker POSTs JSON to `receive-email-reply` edge function
7. Edge function:
   - Extracts the message ID from the `+tag` in the To address
   - Strips quoted text (removes "> " lines, "On ... wrote:", signatures)
   - Inserts into `message_replies` with `sender_type: 'customer'`
   - Marks the original message as `unread` so admin sees new activity
   - Sends a WhatsApp notification to admin

### Admin UI

The Messages thread renders two bubble types:

- **Admin replies** (green, right-aligned) — from admin dashboard
- **Customer email replies** (white, left-aligned) — from email

---

## Database Changes

The `message_replies` table has three columns for reply attribution:

| Column         | Type | Default | Purpose                         |
| -------------- | ---- | ------- | ------------------------------- |
| `sender_type`  | TEXT | 'admin' | 'admin' or 'customer'           |
| `sender_name`  | TEXT | NULL    | Customer name from email header |
| `sender_email` | TEXT | NULL    | Customer email address          |

Migration file: `supabase/migrations/20260213300000_email_reply_webhook.sql`

---

## Files

| File                                              | Purpose                                                   |
| ------------------------------------------------- | --------------------------------------------------------- |
| `email-worker/src/index.js`                       | Cloudflare Email Worker — parses MIME, POSTs to Supabase  |
| `email-worker/wrangler.toml`                      | Cloudflare Worker config                                  |
| `supabase/functions/receive-email-reply/index.ts` | Webhook handler — inserts reply into DB                   |
| `supabase/functions/send-contact-email/index.ts`  | Tagged reply-to address on auto-reply                     |
| `supabase/functions/send-admin-reply/index.ts`    | Tagged reply-to address on admin reply                    |
| `supabase/functions/send-order-email/index.ts`    | Tagged reply-to on order confirmation                     |
| `assets/js/contact.js`                            | Generates UUID before DB insert                           |
| `assets/js/admin.js`                              | Renders customer vs admin reply bubbles                   |

---

## Testing

1. Send a test message via the contact form
2. Check your email for the auto-reply
3. Reply to that email from Gmail / Yahoo / Outlook
4. **Before Cloudflare:** the reply arrives in your Zoho `support@` inbox
5. **After Cloudflare:** the reply appears in admin Messages within seconds
6. The message card should show as "unread" (blue dot)

### Troubleshooting (after Cloudflare setup)

- Verify nameservers propagated: `dig NS lingeriebysisioyin.store`
- Check Cloudflare Email Routing logs for delivery status
- Check Supabase Edge Function logs: `supabase functions logs receive-email-reply`
- Test the Worker directly: `npx wrangler tail lbs-email-reply`
