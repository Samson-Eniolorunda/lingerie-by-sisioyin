# Email Reply Webhook Setup

When a customer replies to any email sent from the store (order confirmation,
contact form auto-reply, admin reply), the reply is captured and displayed in
the admin **Messages** tab — just like a chat thread.

---

## Architecture

```
Customer ──reply──→ reply+{msgId}@reply.lingeriebysisioyin.store
                          │
                    Resend Inbound
                          │
                    Webhook POST
                          │
              receive-email-reply (Edge Function)
                          │
                    message_replies table
                     (sender_type = 'customer')
                          │
                    Admin Messages tab
```

---

## Setup Steps

### 1. DNS — Add MX record for reply subdomain

In your DNS provider (Cloudflare / registrar), add:

| Type | Name                           | Priority | Value              |
| ---- | ------------------------------ | -------- | ------------------ |
| MX   | reply.lingeriebysisioyin.store | 10       | inbound.resend.com |

### 2. Resend — Enable Inbound Emails

1. Go to [Resend Dashboard → Domains](https://resend.com/domains)
2. Add domain: `reply.lingeriebysisioyin.store`
3. Complete DNS verification if prompted
4. Go to **Settings → Webhooks** (or **Inbound**)
5. Create a webhook with:
   - **URL**: `https://oriojylsilcsvcsefuux.supabase.co/functions/v1/receive-email-reply`
   - **Events**: `email.received`
6. Copy the **Webhook Signing Secret** (optional, for verification)

### 3. Supabase — Set the Webhook Secret (optional)

If you want to verify Resend webhook signatures:

```bash
supabase secrets set RESEND_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

### 4. Deploy the Edge Function

```bash
supabase functions deploy receive-email-reply --no-verify-jwt
```

The `--no-verify-jwt` flag is required because Resend's webhook POST
requests don't include a Supabase JWT.

---

## How It Works

### Outgoing Emails (tagged reply-to)

Every email sent to customers now includes a tagged reply-to address:

- **Contact form auto-reply**: `reply+{messageId}@reply.lingeriebysisioyin.store`
- **Admin reply email**: `reply+{messageId}@reply.lingeriebysisioyin.store`
- **Order confirmation**: `reply+{orderMsgId}@reply.lingeriebysisioyin.store`

The `{messageId}` is the UUID of the `contact_messages` row, so when the
customer replies, we know exactly which thread to add it to.

### Inbound Processing

1. Customer hits "Reply" in their email client
2. Email goes to `reply+{id}@reply.lingeriebysisioyin.store`
3. Resend's inbound servers receive it and POST to our edge function
4. Edge function:
   - Extracts the message ID from the `+tag` in the address
   - Strips quoted text (removes "> " lines, "On ... wrote:", signatures)
   - Inserts into `message_replies` with `sender_type: 'customer'`
   - Marks the original message as `unread` so admin sees new activity
   - Sends a WhatsApp notification to admin

### Admin UI

The Messages thread now renders two bubble types:

- **Admin replies** (green, right-aligned) — from admin dashboard
- **Customer email replies** (white, left-aligned) — from email

---

## Database Changes

The `message_replies` table now has three new columns:

| Column         | Type | Default | Purpose                         |
| -------------- | ---- | ------- | ------------------------------- |
| `sender_type`  | TEXT | 'admin' | 'admin' or 'customer'           |
| `sender_name`  | TEXT | NULL    | Customer name from email header |
| `sender_email` | TEXT | NULL    | Customer email address          |

Migration file: `supabase/migrations/20260213300000_email_reply_webhook.sql`

---

## Files Modified

| File                                              | Change                                                    |
| ------------------------------------------------- | --------------------------------------------------------- |
| `supabase/functions/receive-email-reply/index.ts` | **NEW** — webhook handler                                 |
| `supabase/functions/send-contact-email/index.ts`  | Tagged reply-to address                                   |
| `supabase/functions/send-admin-reply/index.ts`    | Tagged reply-to address                                   |
| `supabase/functions/send-order-email/index.ts`    | Tagged reply-to + `sendEmail` now supports reply_to param |
| `assets/js/contact.js`                            | Generates UUID before DB insert                           |
| `assets/js/admin.js`                              | Renders customer vs admin reply bubbles                   |

---

## Testing

1. Send a test message via the contact form
2. Check your email for the auto-reply
3. Reply to that email
4. The reply should appear in admin Messages within a few seconds
5. The message card should show as "unread" (blue dot)

If replies aren't appearing:

- Verify the MX record is propagated: `dig MX reply.lingeriebysisioyin.store`
- Check Resend dashboard for inbound email logs
- Check Supabase Edge Function logs for errors
