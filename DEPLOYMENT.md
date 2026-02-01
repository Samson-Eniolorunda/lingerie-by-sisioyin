# Lingerie by Sisioyin - Deployment Guide

## 🚀 Deploy to Vercel

### Prerequisites

- A [Vercel account](https://vercel.com/signup)
- A [GitHub account](https://github.com) (recommended)
- Git installed on your computer

### Step 1: Push to GitHub

```bash
# Initialize git repository
cd "d:\OneDrive\Documents\LBS\LBS"
git init
git add .
git commit -m "Initial commit"

# Create a new repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/lingerie-by-sisioyin.git
git branch -M main
git push -u origin main
```

### Step 2: Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"Add New..."** → **"Project"**
3. Import your GitHub repository
4. Click **"Deploy"** (no build settings needed for static site)

### Step 3: Set Environment Variables (Optional)

If you want to use environment variables for extra security:

1. In Vercel dashboard, go to **Settings** → **Environment Variables**
2. Add the following:
   - `SUPABASE_URL` = your Supabase project URL
   - `SUPABASE_ANON_KEY` = your Supabase anon key
   - `PAYSTACK_PUBLIC_KEY` = your Paystack public key

---

## 🔐 Security Measures

### 1. Admin Page Protection

The admin page (`admin.html`) is protected by:

- **Supabase Authentication** - Must be logged in
- **Admin Role Check** - Uses `is_admin()` RPC function
- **Role-Based Access** - `super_admin` vs `editor` permissions
- **Row Level Security (RLS)** - Database-level protection

### 2. API Token Security

**Understanding Supabase Keys:**

- The **anon key** is designed to be public (like a publishable Stripe key)
- Security comes from **Row Level Security (RLS)** policies
- The **service role key** (never expose this!) is for server-side only

**Your RLS Policies Protect:**

- Only admins can access admin-only data
- Users can only read/update their own profile
- Products are publicly readable but only admin-writable
- Activity logs are admin-only

### 3. Additional Security Headers

The `vercel.json` adds security headers:

- `X-Frame-Options: DENY` - Prevents clickjacking
- `X-Content-Type-Options: nosniff` - Prevents MIME sniffing
- `X-Robots-Tag: noindex` - Hides admin from search engines

---

## 🛡️ Supabase Security Checklist

Run these checks in your Supabase dashboard:

### 1. Verify RLS is Enabled

```sql
-- Check all tables have RLS enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
```

### 2. Verify Admin Function Works

```sql
-- Test the is_admin function (as authenticated user)
SELECT is_admin();
```

### 3. Create Your First Super Admin

```sql
-- After signing up, make yourself super admin
UPDATE profiles
SET is_admin = true, role = 'super_admin'
WHERE email = 'your-email@example.com';
```

---

## 🔄 Updating the Site

After making changes:

```bash
git add .
git commit -m "Your update message"
git push
```

Vercel will automatically redeploy!

---

## 📝 Important Notes

1. **reCAPTCHA**: Replace the test key with your production key
   - Get keys from: https://www.google.com/recaptcha/admin
   - Update in all HTML files where `g-recaptcha` appears

2. **Paystack**: Replace test key with live key for production
   - Get keys from: https://dashboard.paystack.com/#/settings/developer

3. **Custom Domain**:
   - In Vercel, go to **Settings** → **Domains**
   - Add your custom domain and follow DNS instructions

---

## 🆘 Troubleshooting

**Admin access denied:**

- Check you've run the SQL to make yourself admin
- Verify `is_admin` function exists in Supabase

**RLS errors:**

- Ensure all policies from `supabase_complete.sql` are applied
- Check the Supabase logs for specific errors

**Images not loading:**

- Verify storage bucket policies are set correctly
- Check bucket name matches `APP_CONFIG.STORAGE_BUCKET`
