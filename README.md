# Lingerie by Sisioyin

A modern e-commerce website for a lingerie brand, built as a static site with Supabase as the backend.

**Live:** [lingeriebysisioyin.store](https://lingeriebysisioyin.store)

---

## Tech Stack

| Layer     | Technology                                                                 |
| --------- | -------------------------------------------------------------------------- |
| Frontend  | HTML, CSS, Vanilla JavaScript                                              |
| Backend   | [Supabase](https://supabase.com) (Postgres, Auth, Storage, Edge Functions) |
| Hosting   | [Vercel](https://vercel.com)                                               |
| Payments  | Moniepoint (Monnify SDK)                                                   |
| Emails    | [Resend](https://resend.com) via Supabase Edge Function                    |
| Analytics | Google Analytics 4, Facebook Pixel                                         |

## Features

- Product catalog with filtering, search, and sorting
- Product detail modals with image gallery and reviews
- Shopping cart with delivery fee calculator
- Checkout with Moniepoint payment integration
- User authentication (email/password + Google OAuth)
- Customer dashboard with order history and tracking timeline
- Wishlist with localStorage persistence
- Admin panel with role-based access (Super Admin / Editor)
- Order confirmation emails (customer + admin notification)
- PWA with offline support (service worker)
- Dark mode support
- Fully responsive design

## Pages

| Page                | Description                                     |
| ------------------- | ----------------------------------------------- |
| `index.html`        | Homepage — hero, new arrivals, testimonials     |
| `shop.html`         | Product catalog with filters and product modals |
| `cart.html`         | Shopping cart                                   |
| `checkout.html`     | Checkout with payment                           |
| `confirmation.html` | Order confirmation                              |
| `dashboard.html`    | Customer account — orders, profile, addresses   |
| `wishlist.html`     | Saved products                                  |
| `contact.html`      | Contact form                                    |
| `faq.html`          | Frequently asked questions                      |
| `size.html`         | Size guide                                      |
| `terms.html`        | Terms and conditions                            |
| `privacy.html`      | Privacy policy                                  |
| `admin.html`        | Admin panel (protected)                         |

## Project Structure

```
├── assets/
│   ├── css/
│   │   ├── styles.css          # Main stylesheet
│   │   └── admin.css           # Admin panel styles
│   ├── js/
│   │   ├── config.js           # Centralized configuration
│   │   ├── supabase.js         # Supabase client init
│   │   ├── auth.js             # Authentication logic
│   │   ├── app.js              # Global app logic (nav, cart drawer, footer)
│   │   ├── utils.js            # Utility functions
│   │   ├── home.js             # Homepage logic
│   │   ├── shop.js             # Shop + product modals + reviews
│   │   ├── cart.js             # Cart page
│   │   ├── checkout.js         # Checkout + payment + order save
│   │   ├── dashboard.js        # Customer dashboard + order tracking
│   │   ├── wishlist.js         # Wishlist page
│   │   ├── admin.js            # Admin panel
│   │   ├── analytics.js        # GA4 + Facebook Pixel
│   │   └── recaptcha.js        # reCAPTCHA integration
│   └── img/                    # Static images
├── supabase/
│   ├── functions/
│   │   └── send-order-email/
│   │       └── index.ts        # Order email Edge Function
│   └── order_email_trigger.sql # DB trigger for emails
├── supabase_complete.sql       # Full database schema + RLS policies
├── vercel.json                 # Vercel headers config
├── sw.js                       # Service worker (PWA)
└── site.webmanifest            # PWA manifest
```

## Setup

### 1. Supabase

1. Create a Supabase project
2. Run `supabase_complete.sql` in the SQL Editor
3. Enable Google OAuth provider (see `GOOGLE_LOGIN_SETUP.md`)
4. Create storage buckets: `product-images`, `site-images`

### 2. Configuration

Edit `assets/js/config.js` with your:

- Supabase URL and anon key
- Monnify API key and contract code
- Google Analytics ID
- Facebook Pixel ID

### 3. Deploy

```bash
git push origin main
```

Vercel auto-deploys from the `main` branch.

See `DEPLOYMENT.md` for full deployment instructions.

## Documentation

| File                      | Topic                             |
| ------------------------- | --------------------------------- |
| `DEPLOYMENT.md`           | Hosting, domain, Vercel setup     |
| `ROLE_PERMISSIONS.md`     | Admin roles and access control    |
| `EDGE_FUNCTION_DEPLOY.md` | Order email setup                 |
| `SERVICES_SETUP.md`       | Third-party service configuration |
| `GOOGLE_LOGIN_SETUP.md`   | Google OAuth setup                |

## License

Private — All rights reserved.
