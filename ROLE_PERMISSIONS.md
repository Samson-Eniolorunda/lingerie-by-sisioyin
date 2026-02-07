# Role & Permissions Guide

## Overview

Lingerie by Sisioyin uses **Supabase Row Level Security (RLS)** and two admin roles managed through the `profiles` table.

---

## Roles

### Super Admin

Full access to the entire admin panel.

| Area          | Access                                   |
| ------------- | ---------------------------------------- |
| Inventory     | View, add, edit, soft-delete             |
| Trash         | View, restore, permanently delete, empty |
| Orders        | View all, update status                  |
| Activity Logs | View all admin actions                   |
| Manage Admins | Invite, promote, demote, remove          |
| Site Settings | Edit homepage, banners, promo codes      |

### Editor

Product management only — no access to sensitive operations.

| Area          | Access                       |
| ------------- | ---------------------------- |
| Inventory     | View, add, edit, soft-delete |
| Trash         | No access                    |
| Orders        | No access                    |
| Activity Logs | No access                    |
| Manage Admins | No access                    |
| Site Settings | No access                    |

---

## Database Security

All access control is enforced at the database level via RLS policies defined in `supabase_complete.sql`:

- **products** — public read, admin-only write
- **orders** — anyone can insert (checkout), customers read own orders, admins read all
- **profiles** — users read/update own profile, admins manage all
- **reviews** — anyone can read approved, anyone can insert, admins approve/reject
- **activity_logs** — super_admin read only
- **promo_codes** — anyone can validate, admins manage
- **site_settings** — public read, admin write
- **storage buckets** — public read images, admin upload/delete

The `is_admin()` function checks the current user's role in the `profiles` table.

---

## Admin UI Enforcement

In `admin.js`, UI elements are hidden/shown based on role:

**Hidden for Editors:**

- Activity Logs tab
- Manage Admins tab
- Trash section
- Invite Admin button
- Order management

**Role badge in topbar:**

- Super Admin — accent color badge
- Editor — muted color badge

---

## User Flow

### First-time Setup

1. First user signs up through the admin panel
2. Grant Super Admin in Supabase SQL Editor:
   ```sql
   UPDATE profiles
   SET is_admin = true, role = 'super_admin'
   WHERE email = 'your-admin-email@example.com';
   ```

### Inviting New Admins

1. Super Admin → Manage Admins → Invite Admin
2. Enter the email address
3. Invited user signs up → gets **Editor** role by default
4. Super Admin can promote to Super Admin if needed

### Promoting / Demoting

1. Super Admin → Manage Admins
2. Promote (Editor → Super Admin) or Demote (Super Admin → Editor)
3. All role changes are logged in Activity Logs

---

## Summary

| Feature             | Super Admin | Editor |
| ------------------- | :---------: | :----: |
| View products       |     Yes     |  Yes   |
| Add / edit products |     Yes     |  Yes   |
| Soft-delete         |     Yes     |  Yes   |
| View trash          |     Yes     |   No   |
| Restore / delete    |     Yes     |   No   |
| View orders         |     Yes     |   No   |
| Update order status |     Yes     |   No   |
| Activity logs       |     Yes     |   No   |
| Manage admins       |     Yes     |   No   |
| Site settings       |     Yes     |   No   |
