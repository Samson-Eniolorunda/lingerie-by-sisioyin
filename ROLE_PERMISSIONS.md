# 🔐 LBS Admin - Role Permissions Guide

## Role Overview

### 👑 Super Admin (Full Control)

The super admin has **complete control** over the entire system.

#### ✅ Can Do Everything:

- ✓ View all products (active & deleted)
- ✓ Add new products
- ✓ Edit any product
- ✓ Soft delete products (move to trash)
- ✓ **View trash**
- ✓ **Restore deleted products**
- ✓ **Permanently delete products**
- ✓ **Empty entire trash**
- ✓ **View activity logs** (all admin actions)
- ✓ **Manage admins** (promote/demote/delete)
- ✓ **Invite new admins**

---

### ✏️ Editor (Limited Access)

Editors can manage products but have **no access to sensitive operations**.

#### ✅ Can Do:

- ✓ View active products in inventory
- ✓ Add new products
- ✓ Edit existing products
- ✓ Soft delete products (moves to trash - they can't see it)

#### ❌ Cannot Do:

- ✗ View trash (no access to deleted products)
- ✗ Restore deleted products
- ✗ Permanently delete products
- ✗ Empty trash
- ✗ View activity logs
- ✗ Manage other admins
- ✗ Invite new admins
- ✗ Change their own role

---

## Security Implementation

### Database Level (SQL Policies)

```sql
-- Editors CAN soft-delete via UPDATE (setting is_deleted = true)
-- Only Super Admin can hard DELETE from database

-- Activity logs: Only super_admin can READ
-- Profiles: Only super_admin can UPDATE/DELETE other users
```

### UI Level (JavaScript)

```javascript
// Hidden nav items for editors:
- Activity Logs
- Manage Admins
- Trash
- Invite Admin button

// Status shows role badge:
"Welcome • Super Admin" (pink)
"Welcome • Editor" (gray)
```

---

## User Flow

### New User Signup

1. User signs up through admin panel
2. Automatically becomes **Editor** (not admin until invited)
3. First-ever user becomes **Super Admin**

### Inviting Admins

1. Super Admin clicks "Invite Admin"
2. Enters email address
3. Invited user receives email/OTP
4. When they signup, they become **Editor**
5. Super Admin can promote them to Super Admin if needed

### Promoting/Demoting

1. Super Admin goes to "Manage Admins"
2. Clicks "Promote" → Editor becomes Super Admin
3. Clicks "Demote" → Super Admin becomes Editor
4. All actions are logged in Activity Logs

---

## Best Practices

### Super Admin

- Only promote trusted users to Super Admin
- Regularly review Activity Logs
- Monitor trash for accidentally deleted items
- Don't delete yourself (system prevents this)

### Editor

- Focus on product management
- Deleted items go to trash (super admin can restore)
- Contact super admin if you need restored items
- Request promotion if you need additional access

---

## Files Updated

- `supabase_clean.sql` - Database policies
- `admin.js` - Role-based UI and restrictions
- `admin.html` - Manage Admins view
- `admin.css` - Role badges and admin management styles

---

## Summary Table

| Feature          | Super Admin | Editor |
| ---------------- | ----------- | ------ |
| View Inventory   | ✅          | ✅     |
| Add Products     | ✅          | ✅     |
| Edit Products    | ✅          | ✅     |
| Soft Delete      | ✅          | ✅     |
| View Trash       | ✅          | ❌     |
| Restore Products | ✅          | ❌     |
| Permanent Delete | ✅          | ❌     |
| Empty Trash      | ✅          | ❌     |
| Activity Logs    | ✅          | ❌     |
| Manage Admins    | ✅          | ❌     |
| Invite Admins    | ✅          | ❌     |

---

**Result:** Super admin has oversight and control, editors can work efficiently without access to sensitive operations.
