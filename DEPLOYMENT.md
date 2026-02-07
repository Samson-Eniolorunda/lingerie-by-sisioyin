# Deployment Guide

## Architecture

| Layer           | Service                                                                       |
| --------------- | ----------------------------------------------------------------------------- |
| Hosting         | [Vercel](https://vercel.com) (static site)                                    |
| Database & Auth | [Supabase](https://supabase.com) (Postgres + Auth + Storage + Edge Functions) |
| Payments        | [Moniepoint / Monnify](https://app.monnify.com)                               |
| Email           | [Resend](https://resend.com) via Supabase Edge Function                       |
| Domain          | [Namecheap](https://namecheap.com) → `lingeriebysisioyin.store`               |
| Analytics       | Google Analytics (GA4) + Facebook Pixel                                       |
| Bot Protection  | Google reCAPTCHA v2                                                           |

---

## Prerequisites

- [Git](https://git-scm.com/) installed
- [Vercel](https://vercel.com/signup) account (free)
- [Supabase](https://supabase.com) project already set up with `supabase_complete.sql`
- Domain DNS pointing to Vercel

---

## Step 1 — Push to GitHub

```bash
git add .
git commit -m "deploy: initial release"
git push -u origin main
```

## Step 2 — Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import the GitHub repository `lingerie-by-sisioyin`
3. Framework Preset: **Other** (static site, no build step)
4. Click **Deploy**

## Step 3 — Custom Domain

1. Vercel Dashboard → **Settings** → **Domains**
2. Add `lingeriebysisioyin.store`
3. In Namecheap → **Advanced DNS**, add:
   - **A Record** → `@` → `76.76.21.21`
   - **CNAME** → `www` → `cname.vercel-dns.com`
4. Wait for DNS propagation (5-30 min)

---

## Security

### Supabase Keys

- The **anon key** in `config.js` is a public client key — safe to commit
- Security is enforced by **Row Level Security (RLS)** policies in the database
- The **service role key** is server-side only — never in frontend code
- API secrets (Resend, reCAPTCHA secret) are stored as **Supabase Edge Function secrets**

### Vercel Headers (`vercel.json`)

- `X-Content-Type-Options: nosniff` — prevents MIME sniffing
- `X-Frame-Options: SAMEORIGIN` — prevents clickjacking
- `X-Robots-Tag: noindex` on `admin.html` — hides admin from search engines
- `Cache-Control: no-cache` on `config.js` — always serves fresh config

### Admin Page

- Protected by Supabase Auth (must be logged in)
- `is_admin()` RPC function checks role before granting access
- Role-based UI: Super Admin vs Editor (see `ROLE_PERMISSIONS.md`)

---

## Email Notifications

Order confirmation emails are sent automatically via a Supabase Edge Function:

1. Checkout inserts order into `orders` table
2. Database trigger calls `send-order-email` Edge Function via `pg_net`
3. Edge Function sends emails through Resend API

See `EDGE_FUNCTION_DEPLOY.md` for setup details.

---

## Updating the Site

```bash
git add .
git commit -m "fix: description of change"
git push
```

Vercel auto-deploys on every push to `main`.

---

## Database Migrations

For schema changes, edit `supabase_complete.sql` and run the new SQL in:
**Supabase Dashboard → SQL Editor**

---

## Troubleshooting

| Problem             | Fix                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------- |
| Admin access denied | Run `UPDATE profiles SET is_admin = true, role = 'super_admin' WHERE email = '...'` in SQL Editor |
| RLS errors          | Verify all policies from `supabase_complete.sql` are applied                                      |
| Images not loading  | Check storage bucket policies and bucket name matches `product-images`                            |
| Emails not sending  | Check Edge Function logs in Supabase Dashboard, verify domain in Resend                           |
| Payment not working | Replace Monnify test keys with live keys in `config.js`                                           |
