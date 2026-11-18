# Lingerie by Sisioyin — Rebuild Plan

Audit and plan only. Nothing in the repository has been changed other than the addition of this file.

- Repository: `Samson-Eniolorunda/lingerie-by-sisioyin`, branch `rebuild/production` (HEAD `4387196`)
- Audit date: 18 November 2026
- Scope read: 68 tracked files, about 86,000 lines (16 HTML pages, 2 stylesheets, 20 scripts, 2 service workers, 2 manifests, 1 schema file, 6 migrations, 2 edge functions, `vercel.json`, documentation)

---

## 1. Product summary

Lingerie by Sisioyin is a direct-to-consumer online shop for a Nigerian lingerie, loungewear and underwear brand (delivery within Lagos is free; the site keywords name Lagos and Nigeria). Prices are in Nigerian naira, delivery is offered to seven Nigerian states with a fee per state (`assets/js/config.js:32-41`), and customer service runs largely through WhatsApp.

It is built as a static multi-page site (hand-written HTML, one 30,404-line stylesheet, vanilla JavaScript loaded with `<script defer>`), hosted on Vercel, with Supabase providing Postgres, Auth, Storage, Realtime and Edge Functions. There is no build step, no package manifest and no automated test.

There are three audiences:

1. **Shoppers** browse a catalogue (categories Lingerie, Loungewear, Underwear, Accessories; genders Women, Men, Kids, Unisex), open a product quick-view modal, choose size, colour and quantity, save to a wishlist, add to a cart, and check out.
2. **Account holders** sign in with email and password or Google, and use a dashboard for orders, a tracking timeline, cancellation within 30 minutes, return requests, saved addresses, profile, preferences, data export and account deletion. Cart, wishlist, addresses and settings are synchronised across devices through the `profiles` row.
3. **Staff** (roles `owner`, `super_admin`, `developer`, `editor`) use `/admin` to manage products and variant stock, orders, customers, messages, reviews, site images, staff invitations, an activity log, a trash, analytics from first-party visit tracking, and CSV/PDF exports.

**Payment, as actually implemented.** The README states "Moniepoint (Monnify SDK)" and `config.js` carries a Monnify test-mode block (`assets/js/config.js:12-16`), but no script loads or calls Monnify anywhere. The only working payment method is a **manual bank transfer**: the checkout shows the business account at Moniepoint MFB, the customer uploads a receipt image or PDF to a Supabase Storage bucket, ticks "I have sent the payment" (a two-second timer, not a check: `assets/js/checkout.js:429-435`), and the order is inserted from the browser with `payment_status: "awaiting_confirmation"` (`assets/js/checkout.js:546-549`). "Pay with Card" is rendered disabled with a "Coming Soon" label (`checkout.html:780-782`). **Payment is verified by a member of staff looking at the receipt** and moving the order from Pending to Confirmed; nothing verifies payment programmatically and `payment_status` is never updated afterwards.

**Email.** Resend, called from Supabase Edge Functions. Two functions are tracked (`send-admin-invite`, `send-admin-welcome`); four more are called by the client but are not in the repository (`send-contact-email`, `send-admin-reply`, `send-user-welcome`, and the `send-order-email` function and database trigger described in `README.md:78-80`).

---

## 2. Feature inventory (parity checklist)

**Total: 286 checklist items.** Every item below exists in the code today and must work after the rebuild. Items marked *(defect today)* exist but are broken or unsafe as written; the rebuild delivers the intended behaviour, and the defect is listed in section 5. Dead code that has no reachable user interface is listed separately at the end and is not counted.

### 2.1 Routes and pages (R)

- [ ] R-01 `/` serves the home page (Vercel rewrite `/` → `/home`, `vercel.json:7`)
- [ ] R-02 `/home` home page (`home.html`); `index.html` is a near-identical copy
- [ ] R-03 `/shop` catalogue (`shop.html`)
- [ ] R-04 `/cart` cart page (`cart.html`)
- [ ] R-05 `/checkout` checkout (`checkout.html`)
- [ ] R-06 `/confirmation` order confirmation (`confirmation.html`)
- [ ] R-07 `/track` public order tracking (`track.html`)
- [ ] R-08 `/wishlist` wishlist (`wishlist.html`)
- [ ] R-09 `/dashboard` customer account (`dashboard.html`)
- [ ] R-10 `/contact` contact page (`contact.html`)
- [ ] R-11 `/faq` frequently asked questions (`faq.html`)
- [ ] R-12 `/size` size guide (`size.html`)
- [ ] R-13 `/privacy` privacy policy (`privacy.html`)
- [ ] R-14 `/terms` terms of service (`terms.html`)
- [ ] R-15 `/admin` staff panel (`admin.html`, rewrite at `vercel.json:8`), `noindex` and `X-Frame-Options: DENY`
- [ ] R-16 Custom 404 page with links to popular pages (`404.html`)
- [ ] R-17 Clean URLs: `*.html` requests redirect to the extension-less path (`vercel.json:3`)
- [ ] R-18 Deep links honoured: `/shop?category=`, `?gender=`, `?is_new=true`, `?search=` / `?q=`, `?product=<id>`; `/track?order=` / `?id=`; `/contact?subject=`; `/dashboard?setpw=1`; `/admin?invite=<token>`; `/admin?mode=staff`

### 2.2 Global shell on storefront pages (G)

- [ ] G-01 Header with logo, primary navigation (Home, Shop, Women, Men, Kids) and active-link state
- [ ] G-02 Account button: opens the sign-in modal when signed out; shows initials and links to `/dashboard` when signed in
- [ ] G-03 Cart button with live item-count badge
- [ ] G-04 Mobile navigation drawer: account block, Home, Shop, New Arrivals, Cart, Wishlist; category shortcuts (Women, Men, Kids, Lingerie, Loungewear, Underwear); support links (FAQs, Size Guide, Contact, Terms, Privacy)
- [ ] G-05 Theme: light, dark and system, persisted, applied before first paint, switchable from the floating control, the mobile drawer and the dashboard
- [ ] G-06 Search overlay: opens from the header or Ctrl/Cmd+K, closes on Escape or backdrop; debounced product search over name, category and description (8 results)
- [ ] G-07 Search fallback: six latest products under "You might like" when nothing matches, plus a "View all results" link to `/shop?search=`
- [ ] G-08 Cart drawer: line items with image, size, colour; quantity up/down; remove; subtotal; checkout link; continue shopping; empty state
- [ ] G-09 Footer: shop links, help links (My Account, Track Order, FAQs, Size Guide, Contact), legal links, social links (Instagram, TikTok, WhatsApp from `config.js:25-29`), current year
- [ ] G-10 Floating WhatsApp button with a small pop-up card and a pre-filled enquiry message
- [ ] G-11 Cookie and consent dialog: Essential (locked), Analytics, Marketing, Functional; "Accept All", "Save Preferences", "Essential Only"; choice stored *(defect today: not enforced on later page loads)*
- [ ] G-12 Toast notifications (success, error, info, warning)
- [ ] G-13 Skip-to-content link
- [ ] G-14 Loading skeletons per page and a slow-network spinner after three seconds
- [ ] G-15 Scroll-reveal entrance animation, with a reduced-motion rule
- [ ] G-16 Form persistence for the session: non-password field values on checkout and contact survive a reload
- [ ] G-17 Scroll position restored on reload; top of page on fresh navigation
- [ ] G-18 Account-level text size preference (small, medium, large) applied site-wide
- [ ] G-19 Live catalogue refresh through Supabase Realtime on the `products` table (home and shop grids)
- [ ] G-20 Post-delivery review prompt: after sign-in, a pop-up asks for a star rating and comment on the most recent delivered order without a review *(defect today)*
- [ ] G-21 On mobile, focused form fields scroll into view above the keyboard
- [ ] G-22 Social links and WhatsApp number driven from one configuration object

### 2.3 Authentication (A)

- [ ] A-01 Sign-in with email and password
- [ ] A-02 Sign-up with first name, last name, email, password and confirmation
- [ ] A-03 Password rules shown live with a strength meter: 8+ characters, upper case, lower case, number, special character
- [ ] A-04 reCAPTCHA v2 checkbox on sign-in and sign-up *(defect today: never verified by a server)*
- [ ] A-05 Sign-in with Google (OAuth)
- [ ] A-06 Forgot password: modal, reset email, success state showing the address
- [ ] A-07 Recovery link lands on `/dashboard?setpw=1` and opens a "Set New Password" modal with the same rules
- [ ] A-08 Email verification landing (PKCE `?code=` and legacy hash): "Email Verified" screen, then redirect to the dashboard
- [ ] A-09 Expired or invalid link screen with "Resend confirmation email" or "Request password reset"
- [ ] A-10 Welcome email on first verified session (`send-user-welcome`), sent once per user
- [ ] A-11 Accounts with status `suspended`, `banned` or `deleted` are refused at sign-in with a specific message *(defect today: client-side only)*
- [ ] A-12 Sign-out with a short "Signing out" overlay; clears synchronised local data
- [ ] A-13 Staff who verify on the storefront are redirected to `/admin`
- [ ] A-14 Storefront and admin sessions are stored separately so one does not sign the other in
- [ ] A-15 Show/hide password toggles
- [ ] A-16 Links to Terms and Privacy from the sign-up form

### 2.4 Home page (H)

- [ ] H-01 Hero: headline, supporting line, link to the shop, link to new arrivals
- [ ] H-02 Hero image supplied from the admin (site setting `hero_image`)
- [ ] H-03 New Arrivals grid: up to eight active products flagged `is_new`, falling back to the latest products
- [ ] H-04 Product cards: image, name, price, rating stars, "new" marker, wishlist toggle, quick-view and quick-add actions
- [ ] H-05 Category showcase for Lingerie, Loungewear and Underwear with admin-managed images, each linking to the filtered shop
- [ ] H-06 Service facts row (delivery, quality, returns, WhatsApp support)
- [ ] H-07 Customer testimonials: up to six approved entries, with an empty state
- [ ] H-08 Closing link to the full collection
- [ ] H-09 Structured data: Organisation and WebSite with SearchAction (`home.html:78-107`)

### 2.5 Shop and product (S)

- [ ] S-01 Catalogue grid of all active, non-deleted products with skeleton loading
- [ ] S-02 Filter by category (Lingerie, Loungewear, Underwear, Accessories)
- [ ] S-03 Filter by gender (Women, Men, Kids, Unisex)
- [ ] S-04 Price range filter with dual sliders and numeric inputs (0–500,000)
- [ ] S-05 Filter by delivery type (express, standard)
- [ ] S-06 "In stock only" and "New arrivals only" toggles
- [ ] S-07 In-page text search over name, category and description
- [ ] S-08 Sort: newest, most reviewed, price ascending, price descending, name
- [ ] S-09 Result count, active-filter chips with individual removal, "clear all", mobile filter toggle with an active-filter count
- [ ] S-10 "No products found" state with a clear-filters action
- [ ] S-11 Filters and search pre-applied from URL parameters
- [ ] S-12 Product quick view: gallery with thumbnails, previous/next, swipe and a full-screen image viewer
- [ ] S-13 Product quick view: name, category, price, description, pack type, delivery-type tag, stock indicator
- [ ] S-14 Size selection with per-size availability
- [ ] S-15 Colour selection with swatches (when the product allows it), per-colour availability, "Assorted" handling
- [ ] S-16 Quantity stepper capped by variant, colour, size or product stock (`shop.js:1018-1065`)
- [ ] S-17 Add to cart from quick view; opens the cart drawer
- [ ] S-18 Edit a cart line from the cart or checkout: reopens quick view pre-filled and replaces the line
- [ ] S-19 Quick add from a card for products without size or colour choices
- [ ] S-20 Wishlist toggle on cards and in quick view
- [ ] S-21 Share: Facebook, X, Instagram, TikTok, WhatsApp, copy link
- [ ] S-22 Size-guide link from quick view
- [ ] S-23 Reviews in quick view: average, count, list of up to 20 approved reviews
- [ ] S-24 "Write a review" available only to signed-in customers with a delivered order containing the product; form with name, email, title, star rating, comment; held for approval
- [ ] S-25 `/shop?product=<id>` opens that product directly
- [ ] S-26 Analytics events: view item, add to cart, add to wishlist, search

### 2.6 Wishlist (W)

- [ ] W-01 Wishlist stored on the device and synchronised to the account
- [ ] W-02 Wishlist page: grid of saved products with image, price, rating and "new" marker
- [ ] W-03 Remove one item; clear the whole wishlist
- [ ] W-04 Item count and empty state with a link to the shop
- [ ] W-05 Open quick view or add to cart from a wishlist card

### 2.7 Cart (C)

- [ ] C-01 Cart stored on the device (`LBS_CART_V1`) and synchronised to the account
- [ ] C-02 Cart page: line items with image, name, size, colour, unit price and line total
- [ ] C-03 Quantity up/down, remove, edit (S-18)
- [ ] C-04 Clear cart with confirmation
- [ ] C-05 Promo code entry: validated against `promo_codes` (active, not expired, under usage limit); percentage discount shown; removable *(defect today: discount never reaches the order)*
- [ ] C-06 Delivery estimator: state selector populated from the configured fee table, "Free" for zero
- [ ] C-07 Summary: subtotal, discount, delivery, total
- [ ] C-08 Proceeding to checkout requires sign-in; the sign-in modal opens otherwise
- [ ] C-09 Progress indicator (Cart, Shipping, Payment, Done) and breadcrumb
- [ ] C-10 Empty-cart state

### 2.8 Checkout and payment (K)

- [ ] K-01 Three-step accordion: Contact, Delivery, Payment, with per-step validation, completion ticks and edit buttons
- [ ] K-02 Contact step: first name, last name, email, phone
- [ ] K-03 "Use my profile details" banner for signed-in customers
- [ ] K-04 Delivery step: address, city, state (Lagos, Ogun, Oyo, Osun, Ondo, Ekiti, Abuja FCT), landmark, order notes
- [ ] K-05 Saved-address picker that fills the delivery fields
- [ ] K-06 Google Places address autocomplete restricted to Nigeria, when a Maps key is configured (currently blank)
- [ ] K-07 Delivery fee by state from the configured table; totals update on change
- [ ] K-08 Payment method: Bank Transfer (active) and Pay with Card (shown as "Coming Soon", disabled)
- [ ] K-09 Bank details panel (bank, account number, account name) with copy-to-clipboard
- [ ] K-10 Receipt upload: image or PDF, 5 MB limit, file name preview, remove
- [ ] K-11 "I have sent the payment" confirmation, enabled only once a receipt is attached
- [ ] K-12 Order summary: items with edit links, subtotal, discount row, delivery, total
- [ ] K-13 Place Order: uploads the receipt, creates the order, clears and synchronises the cart, redirects to the confirmation page *(defect today)*
- [ ] K-14 Order numbers generated by the database in the form `LBS-DDMMYYYY-NNNN`
- [ ] K-15 Double-submit guard and button loading state
- [ ] K-16 Empty-cart state on the checkout page
- [ ] K-17 Order confirmation email to the customer and notification to the store (trigger and `send-order-email`, not tracked: `README.md:78-80`)

### 2.9 Confirmation and tracking (T)

- [ ] T-01 Confirmation page: order number, items, subtotal, delivery, total, delivery address, contact details, note that an email is on its way
- [ ] T-02 Confirmation page redirects to the shop when opened without an order
- [ ] T-03 Track page: look up by order number (`LBS…`) or by order-id prefix *(defect today for guests)*
- [ ] T-04 Track result: status badge, five-step timeline (Placed, Confirmed, Processing, Shipped, Delivered), cancelled state, items and total
- [ ] T-05 Track page auto-search from `?order=` / `?id=`
- [ ] T-06 "Not found" state

### 2.10 Customer dashboard (D)

- [ ] D-01 Sign-in gate when signed out
- [ ] D-02 Sidebar with avatar initials, name and email; bottom tab bar on mobile
- [ ] D-03 Overview: greeting, total orders, wishlist count, total spent (excluding cancelled), rewards figure (always 0 today), three most recent orders, quick actions
- [ ] D-04 Orders: full list with a status filter (all, pending, confirmed, processing, shipped, delivered, cancelled)
- [ ] D-05 Order detail modal: status badge, timeline, items, totals, delivery details
- [ ] D-06 Cancel an order within 30 minutes while it is pending, with a countdown (enforced by a row-level policy, `supabase_complete.sql:691-702`)
- [ ] D-07 Return or refund request for delivered orders within seven days: opens WhatsApp or the contact form with the order number pre-filled
- [ ] D-08 Saved addresses: add (with autocomplete suggestions), list, delete; synchronised
- [ ] D-09 Profile: first name, last name, email (read-only), phone, date of birth, gender; saved to Auth metadata and `profiles`
- [ ] D-10 Settings — appearance: theme and text size
- [ ] D-11 Settings — notification preferences: orders, shipping, promotions, price drops, new arrivals
- [ ] D-12 Settings — communication: email, SMS, WhatsApp opt-in with number capture and validation
- [ ] D-13 Settings — privacy: personalised recommendations, marketing; clear browsing history
- [ ] D-14 Change password (sends a reset email)
- [ ] D-15 Download my data as a text file (profile, settings, addresses, orders)
- [ ] D-16 Deactivate account *(defect today: sets a metadata flag that nothing reads)*
- [ ] D-17 Delete account: double confirmation, marks the profile for deletion, sends a confirmation email, signs out
- [ ] D-18 Sign out from the sidebar and from settings
- [ ] D-19 One-time welcome state per session

### 2.11 Cross-device synchronisation (X)

- [ ] X-01 On sign-in, wishlist, cart, addresses and settings are pulled, merged with local data and pushed back
- [ ] X-02 Changes are pushed with a 1.5-second debounce
- [ ] X-03 Realtime subscription to the customer's own `profiles` row updates other open devices
- [ ] X-04 Text size stays per-device and is excluded from synchronisation

### 2.12 Content pages (P)

- [ ] P-01 Contact form: name, email, phone, subject (order, product, sizing, returns, wholesale, other), order ID, message
- [ ] P-02 Contact submission stored in `contact_messages` and emailed through `send-contact-email`; success panel with "send another"
- [ ] P-03 Contact fallback to a pre-filled WhatsApp message when submission throws
- [ ] P-04 Contact channels: WhatsApp, phone, email, Instagram, TikTok
- [ ] P-05 FAQ: category tabs (all, orders, shipping, returns, payment, sizing, account), accordion, live search with a no-results state
- [ ] P-06 Size guide: how to measure (bust, underbust, waist, hips)
- [ ] P-07 Size charts with tabs: bras, panties, bodysuits, loungewear
- [ ] P-08 Bra size calculator from underbust and bust measurements (`assets/js/size.js:27-57`)
- [ ] P-09 Privacy policy with a table of contents that highlights the section in view (9 sections)
- [ ] P-10 Terms of service with the same table of contents behaviour (10 sections)

### 2.13 Admin — access and shell (M)

- [ ] M-01 Staff sign-in; access granted only when `is_admin()` returns true, otherwise signed out with "Access denied"
- [ ] M-02 Staff sign-up from an invitation link: token validated, email pre-filled and locked, role carried from the invitation
- [ ] M-03 Email confirmation screen, verified screen and expired-link screen for staff
- [ ] M-04 Password reset and set-new-password flows for staff, with the password rules
- [ ] M-05 Staff mode (`?mode=staff`): sign-up tab hidden, mode kept across redirects
- [ ] M-06 Welcome email to new staff with role and permissions (`send-admin-welcome`), sent once
- [ ] M-07 Complete-profile prompt when first or last name is missing
- [ ] M-08 Welcome overlay on sign-in and a sign-out overlay
- [ ] M-09 Sidebar navigation across twelve views, collapsible on mobile; last view remembered for the session
- [ ] M-10 Role-based interface: Activity Logs, Manage Admins, Trash and Invite are shown only to owner, super admin and developer *(defect today: interface only)*
- [ ] M-11 Role label beside the status text; name and role in the sidebar
- [ ] M-12 Idle timeout after 30 minutes with a 60-second warning and "stay signed in"
- [ ] M-13 Change password from the sidebar; "View Store" link
- [ ] M-14 Theme switch (light, system, dark)
- [ ] M-15 Confirm dialog, toast, and five-second undo toast for destructive actions
- [ ] M-16 Keyboard shortcuts: Ctrl/Cmd+S saves the product form, Escape closes dialogs
- [ ] M-17 Activity logging of staff actions with device information; staff name and role added by a database trigger

### 2.14 Admin — dashboard view (MD)

- [ ] MD-01 Totals: products, orders, revenue, pending orders
- [ ] MD-02 Recent orders widget
- [ ] MD-03 Low-stock widget
- [ ] MD-04 Pending-orders and unread-messages badges in the sidebar

### 2.15 Admin — inventory and product editor (MI)

- [ ] MI-01 Inventory list with search, category filter, stock filter and pagination (12 per page)
- [ ] MI-02 Product cards with image viewer (swipe, dots, count)
- [ ] MI-03 Bulk select and bulk move to trash
- [ ] MI-04 Product editor ("Add Product"): name, price, description, category, gender, quantity, delivery type
- [ ] MI-05 Sizes with per-size stock; colours with per-colour stock and colour suggestions; colour mode switch; pack type
- [ ] MI-06 Variant matrix (size × colour × quantity) with add, remove, quantity steppers and low/out-of-stock markers (low at five or fewer)
- [ ] MI-07 Image upload with client-side compression to the `product-images` bucket, slider preview, reorder and remove
- [ ] MI-08 Active and "new arrival" switches
- [ ] MI-09 Edit an existing product; delete (soft delete to trash) with undo
- [ ] MI-10 Audit fields (`created_by`, `updated_by`, `updated_at`) set by triggers

### 2.16 Admin — orders (MO)

- [ ] MO-01 Counters for pending, processing, shipped, delivered
- [ ] MO-02 Orders table with status filter, refresh and pagination
- [ ] MO-03 Order detail: customer, contact, delivery address, items, totals, discount and promo code, notes, payment method, link to the uploaded receipt
- [ ] MO-04 Status progression (pending → confirmed → processing → shipped → delivered) with one action per step, and cancel where allowed
- [ ] MO-05 Order timeline in the detail view

### 2.17 Admin — customers (MC)

- [ ] MC-01 Customer table with search, totals (all, new, with orders), order count and spend per customer
- [ ] MC-02 Customer detail modal: profile, status, WhatsApp opt-in, order history
- [ ] MC-03 Suspend, ban and reactivate, each with an email to the customer
- [ ] MC-04 Revoke and restore return privilege, with an email
- [ ] MC-05 Delete customer data with double confirmation and an email
- [ ] MC-06 Message a customer from the row (opens compose)
- [ ] MC-07 Customer export as CSV, JSON, TXT and PDF

### 2.18 Admin — messages (MM)

- [ ] MM-01 Inbox list with counters (total, unread, replied), search, subject filter, pagination
- [ ] MM-02 Message detail: sender, phone, order ID, body, reply thread
- [ ] MM-03 Reply by email from a chosen sender address (`send-admin-reply`); reply stored in `message_replies`; status set to replied
- [ ] MM-04 Mark as unread; delete message with its replies
- [ ] MM-05 Compose a new message to a customer chosen by search
- [ ] MM-06 Two-pane layout on desktop, list/detail with back button on mobile

### 2.19 Admin — reviews, site images, staff, activity, trash (MX)

- [ ] MX-01 Reviews list with status and rating filters and counters
- [ ] MX-02 Approve, reject and delete a review *(defect today)*
- [ ] MX-03 Site images: hero and three category images, each by URL or by upload to the `site-images` bucket, with preview and save
- [ ] MX-04 Storefront picks up new site images without a redeploy
- [ ] MX-05 Manage admins: list with role badges
- [ ] MX-06 Promote to super admin, demote to editor, remove a member of staff
- [ ] MX-07 Invite a member of staff by email with a role (editor or super admin); seven-day expiry; invitation email (`send-admin-invite`); fallback link shown if the email fails
- [ ] MX-08 Activity log with search, action filter and refresh
- [ ] MX-09 Trash: list soft-deleted products, restore, delete permanently, empty trash

### 2.20 Admin — analytics and exports (MA)

- [ ] MA-01 Period selector (7, 30, 90 days) and refresh
- [ ] MA-02 Indicators: page views, customers, orders, revenue, conversion rate
- [ ] MA-03 Revenue bar chart and order-status donut
- [ ] MA-04 Traffic chart, top pages, top products
- [ ] MA-05 Device type, device brand/model and browser tables
- [ ] MA-06 Visitors by country and by Nigerian state
- [ ] MA-07 Google Analytics and Meta Pixel configuration status cards
- [ ] MA-08 Export products, orders, customers, reviews and activity logs as CSV
- [ ] MA-09 Export the same five data sets as PDF (jsPDF with AutoTable)

### 2.21 Analytics and tracking (N)

- [ ] N-01 Google Analytics 4 page views and e-commerce events (view item, add to cart, wishlist, begin checkout, purchase, search, sign-up, login)
- [ ] N-02 Meta Pixel page views and matching events
- [ ] N-03 First-party visit record per session in `site_visits`: page, referrer, device type, browser, operating system, device brand and model, screen and viewport size
- [ ] N-04 Approximate location (country, region, city, IP) from `ipapi.co`, falling back to `ipwho.is`
- [ ] N-05 Time on page recorded when the tab is hidden or closed
- [ ] N-06 Visit linked to the account after sign-in

### 2.22 Progressive web app (Q)

- [ ] Q-01 Storefront web manifest (name, icons, standalone, start URL `/home`)
- [ ] Q-02 Separate admin manifest ("LBS Admin", start URL `/admin`)
- [ ] Q-03 Storefront service worker: network-first pages with cached fallback, cached icons, offline image placeholder
- [ ] Q-04 Admin service worker scoped to `/admin`
- [ ] Q-05 Install banner on Android and install instructions on iOS, with dismissal remembered
- [ ] Q-06 Update flow: new worker activates and the page reloads once
- [ ] Q-07 Push notification and notification-click handlers in the worker

### 2.23 Back end — tables (DB)

- [ ] DB-01 `profiles` (role, status, WhatsApp fields, synchronised JSON columns, `role_priority`)
- [ ] DB-02 `admin_invites`
- [ ] DB-03 `products` (JSON sizes, colours, variant stock; image array; soft delete; rating aggregates)
- [ ] DB-04 `admin_activity_logs`
- [ ] DB-05 `reviews`
- [ ] DB-06 `testimonials`
- [ ] DB-07 `newsletter_subscribers`
- [ ] DB-08 `promo_codes`
- [ ] DB-09 `orders`
- [ ] DB-10 `site_settings`
- [ ] DB-11 `site_visits`
- [ ] DB-12 `contact_messages` (used by the code, absent from the tracked schema)
- [ ] DB-13 `message_replies` (used by the code, absent from the tracked schema)

### 2.24 Back end — policies, functions, triggers, storage, realtime (BE)

- [ ] BE-01 Row-level security enabled on all eleven tracked tables, with 39 policies on them and 8 on `storage.objects`
- [ ] BE-02 `is_admin()` security-definer check, executable by `anon` and `authenticated`
- [ ] BE-03 `handle_new_user()` trigger: creates the profile, first user becomes owner, invited emails become staff, invitation consumed
- [ ] BE-04 `validate_invite_token(p_token)` RPC
- [ ] BE-05 `set_role_priority()` trigger
- [ ] BE-06 `set_updated_at()` and `set_audit_fields()` triggers on products
- [ ] BE-07 `log_activity_with_name()` trigger
- [ ] BE-08 `update_product_rating_stats()` trigger keeping `avg_rating` and `review_count`
- [ ] BE-09 `generate_order_number()`, `set_order_number()` and the `order_number_seq` sequence
- [ ] BE-10 `send_admin_welcome_email(p_user_id)` (a placeholder that only raises a notice)
- [ ] BE-11 Storage buckets `product-images` and `site-images` (public read, staff write) and `receipts` (used by checkout, absent from the tracked schema)
- [ ] BE-12 Realtime publication on `products` and `profiles`
- [ ] BE-13 Customer may cancel own pending order within 30 minutes (policy)

### 2.25 Edge functions and integrations (E)

- [ ] E-01 `send-admin-invite` (tracked)
- [ ] E-02 `send-admin-welcome` (tracked)
- [ ] E-03 `send-contact-email` (called at `assets/js/contact.js:66`; source not tracked)
- [ ] E-04 `send-admin-reply` (called at `assets/js/admin.js:7443`, `:8886`, `:9181` and `assets/js/dashboard.js:1187`; source not tracked)
- [ ] E-05 `send-user-welcome` (called at `assets/js/auth.js:1160`; source not tracked)
- [ ] E-06 `send-order-email` and its database trigger (described in `README.md:78-80`; not tracked)
- [ ] E-07 Resend as the mail provider, sending from the store's domain
- [ ] E-08 Supabase image transformation for resized product images (`assets/js/utils.js:438-457`)
- [ ] E-09 Google OAuth provider
- [ ] E-10 Google reCAPTCHA v2
- [ ] E-11 Google Maps Places (optional, key currently blank)
- [ ] E-12 Geo-IP look-ups (`ipapi.co`, `ipwho.is`)

### 2.26 SEO and platform (O)

- [ ] O-01 Title and meta description on every page
- [ ] O-02 Canonical links on public pages; `noindex` on cart, checkout, track and admin
- [ ] O-03 Open Graph tags and Twitter card on public pages
- [ ] O-04 `robots.txt` and `sitemap.xml`
- [ ] O-05 Favicon set (SVG, PNG, Apple touch icon) and theme colour
- [ ] O-06 Security headers: HSTS, `nosniff`, frame options, referrer policy, permissions policy, content security policy (`vercel.json:11-50`)

### Dead code found (not counted, to be confirmed by the owner)

| Code | Evidence | Note |
|---|---|---|
| Newsletter sign-up | `assets/js/app.js:2051-2087`; no `#newsletterForm` in any page | The table exists; no page offers the form |
| Home testimonial submission modal | `assets/js/home.js:238-239`, `:441`; no `#reviewForm` or `#openReviewModal` in `home.html` | Customers cannot submit testimonials, and the admin has no testimonial screen |
| Size-guide modal | `assets/js/app.js:1983`; no `#sizeGuideModal` in any page | The `/size` page is the live feature |
| Recently viewed | `assets/js/app.js:1788`; never called | |
| Monnify configuration | `assets/js/config.js:12-16`; never read | See section 9 |
| Rewards figure | `dashboard.html:431`; never written | Always shows 0 |

---

## 3. Current stack and recommendation

### 3.1 What exists

| Layer | Today | Assessment |
|---|---|---|
| Pages | 16 hand-written HTML files, 20,240 lines; header, footer, cart drawer, search overlay and three auth modals copied into each | Replace |
| Styles | `styles.css` 30,404 lines (612 KB) and `admin.css` 9,327 lines; no build, no purge | Replace |
| Scripts | 20 global-scope IIFE scripts, 22,596 lines, communicating through `window.*` | Replace |
| Types, lint, tests | None | Add |
| Dependencies | Loaded from CDNs at run time: `@supabase/supabase-js@2` (floating major, no integrity hash), Font Awesome 6.5.0, jsPDF 2.5.2, AutoTable 3.8.4 | Replace with pinned packages |
| Hosting | Vercel, static, `cleanUrls` | Keep Vercel |
| Database, auth, storage, realtime | Supabase | **Keep** (same project, same data) |
| Email | Resend through Edge Functions (Deno `std@0.177.0`, from 2023) | Keep Resend; move sending to the application server |
| Payment | Manual bank transfer with receipt upload | Keep; make it safe |
| Analytics | GA4, Meta Pixel, first-party `site_visits` | Keep, behind consent |

### 3.2 The decision: static or framework

**Recommendation: move the storefront and admin to Next.js (App Router) with TypeScript in strict mode, deployed on Vercel, keeping the existing Supabase project as the back end.**

Staying static is not adequate for this product, for reasons that come directly from the audit:

1. **Money and stock are computed in the browser.** Order totals come from `localStorage` (`assets/js/checkout.js:487-510`) and are inserted under a policy that lets anyone insert any order row (`supabase_complete.sql:669-672`). Stock is never decremented. Fixing this needs code that runs on a server and in the database, with validated input. A framework with server actions gives that a proper home; a static site would need every such rule written as an Edge Function with no shared types.
2. **Products have no URLs.** A product exists only as a modal over `/shop?product=<uuid>`. For a boutique that sells on photography, each product needs its own indexable page with its own title, description, image and structured data. That requires server rendering.
3. **Large images are the product.** The current site loads full-size images through ad-hoc URL rewriting. `next/image` provides responsive sizes, modern formats and lazy loading as standard.
4. **The shell is copied into every page.** The header, footer, drawer and modals are pasted into each storefront HTML file, and `index.html` duplicates `home.html`. Components remove about two thirds of the markup.
5. **The admin is delivered to everyone.** `admin.html` and 9,269 lines of `admin.js` are public files; access is decided by client code. With a framework, `/admin` is checked on the server before anything is rendered.
6. **The standards require TypeScript strict, zod on the server and one source of truth per concern.** None of these is reachable in script-tag JavaScript without adding a build system anyway.

**Alternative considered: stay static, add a typed build step** (Vite multi-page build with TypeScript, HTML partials, and all privileged logic in Supabase Edge Functions and RPCs). This keeps hosting trivial and the URLs untouched, and it would satisfy strict typing. It was rejected because it still gives no server-rendered product pages, no image pipeline, no server-side gate on `/admin`, and it splits logic across two runtimes (browser TypeScript and Deno) with duplicated validation — more moving parts than Next.js for a weaker result. **Astro** was also considered; it suits content sites, but the cart, checkout, dashboard and a twelve-view admin are application screens, so most of the site would be client islands regardless.

### 3.3 Target stack and versions

Versions checked with `npm view <pkg> version` on 18 November 2026.

| Concern | Package | Version | Note |
|---|---|---|---|
| Framework | `next` | 16.4.6 | App Router, server components, server actions |
| UI runtime | `react`, `react-dom` | 19.3.1 | |
| Language | `typescript` | 6.0.3 | `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. 7.0.2 is the newest release, but `typescript-eslint` 8.73.0 (required by `eslint-config-next`) declares `typescript <6.1.0`, so 6.0.3 is the newest version the lint toolchain supports. Move to 7.x when that peer range allows |
| Styling | `tailwindcss`, `@tailwindcss/postcss` | 4.3.5 | Tokens defined once in CSS (`@theme`) |
| Supabase client | `@supabase/supabase-js` | 2.119.1 | Pinned, bundled |
| Supabase server sessions | `@supabase/ssr` | 0.12.7 | Cookie-based sessions |
| Supabase CLI | `supabase` | 3.2.0 | Migrations, type generation |
| Validation | `zod` | 4.6.7 | Every server action and route handler |
| Forms | `react-hook-form`, `@hookform/resolvers` | 7.92.0, 7.0.7 | Same zod schemas on client and server |
| Client data cache (admin, dashboard) | `@tanstack/react-query` | 5.108.0 | |
| Accessible dialog/drawer primitive | `@radix-ui/react-dialog` | 1.3.1 | Focus trap and inert background; styled by the design system |
| Icons | `lucide-react` | 1.75.0 | The only icon set |
| Email | `resend`, `@react-email/components` | 6.38.1, 1.0.12 | Templates as typed components |
| PDF export | `jspdf`, `jspdf-autotable` | 4.2.1, 5.0.9 | Loaded on demand in the admin |
| Service worker | `serwist`, `@serwist/next` | 9.5.15 | |
| Lint | `eslint`, `eslint-config-next` | 10.15.0, 16.4.6 | `--max-warnings 0` |
| Format | `prettier`, `prettier-plugin-tailwindcss` | 3.10.1, 0.8.1 | |
| Unit tests | `vitest`, `@testing-library/react` | 5.1.1, 16.3.3 | |
| End-to-end and accessibility | `@playwright/test`, `@axe-core/playwright` | 1.65.1, 4.14.0 | |
| Runtime | Node.js | 22 or newer (Next.js requires ≥ 20.9.0) | Use the newest LTS line Vercel offers at build time |

Charts in the admin are simple bars and a donut today, drawn by hand; they will be small SVG components, so no chart library is added. Fonts are self-hosted through `next/font`. Font Awesome is removed.

### 3.4 What happens to Supabase

Kept, in place. The same project, database, Auth users, buckets and files continue to be used; there is no data migration.

- **Schema of record.** The tracked SQL does not describe the live database (section 5.2). Before any code is written, the live schema is captured as a baseline migration with the Supabase CLI and committed; from then on every change is a reviewed migration.
- **Row-level security stays the enforcement layer**, and is corrected (section 10). The application server is an additional layer, not a replacement.
- **Privileged operations** (placing an order, validating a promo code, changing a role, removing a user, sending email) move behind server actions that validate with zod and call security-definer RPCs or, where unavoidable, the service-role client. The service-role key lives only in server environment variables.
- **Types** are generated from the database (`supabase gen types`) into `src/types/database.ts`.
- **Edge functions** are replaced by server-side email modules. They remain deployed until cut-over is verified and are then removed, together with the order-email trigger, in one migration.

### 3.5 Preserving data, accounts, orders and URLs

| Asset | How it is preserved |
|---|---|
| Customers and staff (Supabase Auth) | Same project; passwords, Google identities and `profiles` rows are untouched |
| Signed-in sessions | Sessions move from `localStorage` keys (`lbs-auth`, `lbs-admin-auth`: `assets/js/supabase.js:14`) to HTTP-only cookies. Every user signs in once more after launch; nothing else changes for them |
| Orders, products, reviews, messages, visits | Same tables. New columns are additive with defaults (section 10) |
| Product and site images | Same buckets and object paths; existing public URLs keep working |
| Guest carts and wishlists | The new client reads the same `localStorage` keys and shapes (`LBS_CART_V1`, `LBS_WISHLIST`, `LBS_ADDRESSES`, `LBS_DASH_SETTINGS`, `LBS_THEME`), so a cart built before launch is still there after it |
| Order numbers | Same sequence and format |
| Installed PWAs | `/sw.js` is replaced at the same URL so existing installs update. `/admin-sw.js` is answered for one release cycle by a worker whose only job is to unregister itself; this is the single deliberate cut-over artefact and has a removal date in the plan |

URL map (all permanent redirects are `308`):

| Old URL | New behaviour |
|---|---|
| `/` | Home, canonical |
| `/home`, `/home.html`, `/index.html` | Redirect to `/` |
| `/shop`, `/cart`, `/checkout`, `/confirmation`, `/track`, `/wishlist`, `/dashboard`, `/contact`, `/faq`, `/size`, `/privacy`, `/terms`, `/admin` | Same path, same purpose |
| `/<page>.html` for each of the above | Redirect to `/<page>` (as Vercel `cleanUrls` does today) |
| `/shop?category=…`, `?gender=…`, `?is_new=true`, `?search=…`, `?q=…` | Same parameters honoured |
| `/shop?product=<uuid>` | Redirect to the new `/products/<slug>` page |
| `/track?order=…`, `/track?id=…` | Honoured |
| `/contact?subject=…` | Honoured |
| `/dashboard?setpw=1` and recovery links already sent | Honoured |
| `/admin?invite=<token>`, `/admin?mode=staff` (in emails already sent) | Honoured |
| `/site.webmanifest`, `/admin.webmanifest`, `/robots.txt`, `/sitemap.xml`, `/assets/img/*` icon paths | Served at the same paths |

Supabase Auth redirect allow-list, the Google OAuth client and the Resend sending domain need the new callback route added before launch (section 9).

---

## 4. Baseline results

| Check | Command | Result |
|---|---|---|
| Install | — | **Not applicable.** No `package.json` or lockfile exists |
| Build | — | **Not applicable.** No build step; Vercel serves the files as they are (`"framework": null`, `vercel.json:2`) |
| Lint | — | **Not applicable.** No linter configuration |
| Type check | — | **Not applicable.** No TypeScript in the storefront. The two Deno edge functions were not type-checked (Deno is not part of this repository's tooling) |
| `npm audit` / `npm outdated` | — | **Not applicable.** No manifest. Third-party code is pulled from CDNs at run time: `@supabase/supabase-js@2` unpinned (`home.html:1271`), Font Awesome 6.5.0, jsPDF 2.5.2, AutoTable 3.8.4 (`admin.html:2729`, `:2734`) |
| Tests | — | None exist |
| Other remote branch | `git fetch origin copilot/vscode-mla2s7fz-afeb` (read-only) | See 4.2 |

### 4.1 Lighthouse (mobile, local, indicative only)

Lighthouse 13.6.0, headless Chromium, served locally with a static server configured to mimic `cleanUrls` and the two rewrites. **All external hosts were blocked** (`--host-resolver-rules`) so that the pages could not reach the live Supabase project or record analytics; as a result the Supabase client, web fonts, Font Awesome and reCAPTCHA did not load, no products rendered, and the consent dialog covered each page. The figures are therefore indicative of the static shell only and are flattering on performance (no product images, no third-party scripts).

| Page | Performance | Accessibility | Best practices | SEO | FCP | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|---|
| `/home` | 80 | 80 | 96 | 100 | 1.8 s | 3.1 s | 490 ms | 0.001 |
| `/shop` | 93 | 82 | 96 | 100 | 1.8 s | 3.0 s | 70 ms | 0 |
| `/cart` | 93 | 76 | 96 | 66 | 1.8 s | 3.0 s | 70 ms | 0 |
| `/checkout` | 90 | 80 | 96 | 66 | 1.8 s | 3.4 s | 80 ms | 0 |
| `/track` | 93 | 80 | 96 | 66 | 1.8 s | 2.9 s | 70 ms | 0 |
| `/admin` | 96 | 84 | 92 | 66 | 1.7 s | 2.6 s | 80 ms | 0.045 |

Main failing audits, common to the storefront pages: `color-contrast` (footer copyright and legal links), `label` (consent toggles have no accessible name), `heading-order`, `meta-viewport` (zoom disabled), `unused-css-rules` (77 KiB of the transferred stylesheet unused on the home page), `unminified-css` (23 KiB), `unminified-javascript` (22 KiB), render-blocking resources, and `errors-in-console`. `/cart` additionally fails `link-name`. The SEO score of 66 on cart, checkout, track and admin is the intended `noindex`. With external hosts blocked, `/admin` rendered an empty page with no message.

### 4.2 The other remote branch

`origin/copilot/vscode-mla2s7fz-afeb` holds 13 commits dated 1–6 February 2026: the initial commit and early fixes by the owner, then four automated commits that move inline styles into the stylesheet. It is an **older snapshot** than `rebuild/production` (whose 50 visible commits end on 23 February 2026; the clone is shallow, so no common ancestor is visible). It has 38 files against 68 here and lacks `home.html`, `track.html`, `404.html`, `robots.txt`, `sitemap.xml`, the edge functions and all migrations. It contains four files that this branch does not: `ROLE_PERMISSIONS.md` (a two-role description, super admin and editor, that predates the owner and developer roles), `DEPLOYMENT.md`, `assets/partials/header.html` and `.env.example` (not opened). Its `config.js` also carries a Paystack public-key placeholder. **Nothing on it needs merging**; it is useful only as evidence of the intended role model. It can be deleted once the owner agrees.

---

## 5. Problems found

Severity: Critical (money, data or access can be lost or taken), High, Medium, Low. Line references were read directly.

### 5.1 Security

| # | Where | Problem | Severity |
|---|---|---|---|
| SEC-01 | `supabase_complete.sql:669-672`; `assets/js/checkout.js:530-551` | Anyone, signed in or not, can insert any row into `orders`, including `total`, `subtotal`, `status` and `payment_status`. Prices and totals are taken from `localStorage` (`checkout.js:487-510`) and never recomputed | Critical |
| SEC-02 | `supabase_complete.sql:134-138` | "profiles: admin update" lets any staff member, including an editor, update any profile, including `role` and `is_admin`. An editor can make themselves owner | Critical |
| SEC-03 | `supabase_complete.sql:407`, `:429`; `assets/js/admin.js:8077-8080` | The role of an invited member of staff is read from sign-up metadata supplied by the browser, not from the invitation row. An invited editor can sign up as `owner` | Critical |
| SEC-04 | `assets/js/admin.js:3257`, `:3260` | Order item fields `image`, `size` and `selectedSize` are written into admin HTML without escaping. Because SEC-01 lets anyone insert orders, this is stored script injection into a signed-in staff session; the content security policy permits inline script (`vercel.json:48`) | Critical |
| SEC-05 | `assets/js/checkout.js:631-641` | Payment receipts (bank transfer evidence with names and account details) are uploaded to a bucket and referenced by public URL. The `receipts` bucket and its policies are not in the tracked schema, so who can list, read or overwrite them cannot be confirmed | High |
| SEC-06 | `supabase/functions/send-admin-invite/index.ts:139-141`; `supabase/functions/send-admin-welcome/index.ts:172-174` | Neither function checks who is calling. Anyone can make the store's domain send an invitation or welcome email to any address | High |
| SEC-07 | `supabase/functions/send-admin-invite/index.ts:70`; `supabase/functions/send-admin-welcome/index.ts:86` | `inviter_name` and `first_name` are placed in the email HTML unescaped, so the open endpoint in SEC-06 can send attacker-written content from the store's address | High |
| SEC-08 | `supabase_complete.sql:896-900` | Any visitor can update every row of `site_visits` (`USING (true)`), not only their own visit duration | High |
| SEC-09 | `supabase_complete.sql:118-127`; `assets/js/auth.js:264-287` | The "update own profile" policy protects only `role` and `is_admin`. A suspended or banned customer can set their own `account_status` back to `active`, or clear `return_privilege_revoked`. Suspension is in any case enforced only by client script | High |
| SEC-10 | `supabase_complete.sql:491-494`, `:563-566` | Review and testimonial inserts are unchecked, so a visitor can insert a row with `is_approved = true` (and `is_featured = true`) and publish it without moderation | High |
| SEC-11 | `supabase_complete.sql:414-419` | Staff rights are granted when the sign-up email matches any invitation row; the token and `expires_at` are not checked | High |
| SEC-12 | `assets/js/admin.js:1698-1748`; `supabase_complete.sql:674-687` | The editor role is limited only by hiding four navigation items. In the database an editor can read and update all orders, read all customers, and manage reviews, promo codes and site settings | High |
| SEC-13 | `assets/js/track.js:151` | The search term (also taken from `?order=`) is written into the page unescaped: reflected script injection through a crafted link. `track.js:127-129` does the same with stored item fields | High |
| SEC-14 | `assets/js/admin.js:6977`, `:7019` | Browser and device strings from `site_visits`, which any visitor can insert, are written into the admin analytics tables unescaped | High |
| SEC-15 | `supabase_complete.sql:625-628` | Every active promo code can be listed by anyone with the public key | Medium |
| SEC-16 | `assets/js/auth.js:722-733` | reCAPTCHA is checked only in the browser. The token is never sent to Supabase or any server, so it stops nothing | Medium |
| SEC-17 | `assets/js/admin.js:5419-5424` | Invitation tokens are generated with `Math.random()` | Medium |
| SEC-18 | `assets/js/app.js:1865` | The search term is concatenated into a PostgREST `or()` filter; commas and parentheses in the input change the filter | Medium |
| SEC-19 | `vercel.json:48` | The content security policy allows `'unsafe-inline'` for scripts, which removes most of its protection; it also still lists `images.unsplash.com`, `encrypted-tbn0.gstatic.com` and `placehold.co` | Medium |
| SEC-20 | `home.html:1271` | `@supabase/supabase-js@2` is loaded from a CDN with a floating version and no integrity hash on every page, including checkout and admin | Medium |
| SEC-21 | `assets/js/analytics.js:327-328`, `:538`, `:631-633`; `assets/js/app.js:2547-2548` | GA4 and Meta Pixel start before consent is given, the stored choice is not applied on later page loads, and the visitor's IP address is sent to two third-party services and stored regardless of the choice | High |
| SEC-22 | `assets/js/admin.js:8086` | The staff sign-up form is open to anyone; uninvited sign-ups create ordinary customer accounts through the admin page | Low |
| SEC-23 | `supabase_complete.sql:184-193`, `:336-337`, `:514-515` | Security-definer functions without a fixed `search_path` | Medium |
| SEC-24 | `supabase/functions/send-admin-invite/index.ts:177` | Provider error text is returned to the caller | Low |
| SEC-25 | `assets/js/dashboard.js:1187-1201` | A customer session calls `send-admin-reply` with its own recipient, subject and body. The function source is not tracked; if it accepts any authenticated caller it is a general-purpose mail sender | High (unverified) |

**Keys in tracked files.** No service-role key, payment secret key or mail API key was found in any tracked file. For completeness: `assets/js/config.js:7-8` holds the Supabase anon key (public by design; its payload role is `anon`); `assets/js/config.js:13-14` holds a Monnify test-mode API key and contract code (publishable values, unused); `assets/js/auth.js:633` and `:772` hold the reCAPTCHA site key (public); `assets/js/config.js:54` holds a **commented-out Google Maps API key** — a browser key, but it should be treated as exposed and be restricted by referrer or rotated before reuse. `.gitignore:45` and `:52` list `*.sql` and `supabase/` as ignored although both are tracked, which suggests the owner did not intend them to be public; nothing in them is secret.

### 5.2 Bugs and data integrity

| # | Where | Problem | Severity |
|---|---|---|---|
| BUG-01 | `assets/js/checkout.js:558-561`, `:648-670` | If the order insert fails, `saveOrderToDatabase` returns `null` and the flow carries on: the cart is cleared, "Order placed" is shown and the customer is sent to the confirmation page with a made-up reference (`checkout.js:514`). The customer has paid and the store has no order | Critical |
| BUG-02 | `assets/js/checkout.js:548` against `supabase_complete.sql:656-657` | The client writes `payment_status: "awaiting_confirmation"`, which the tracked check constraint forbids, and writes `payment_receipt_url` (`checkout.js:549`), a column the tracked table does not have. Either every order fails (BUG-01) or the live database differs from the repository | Critical |
| BUG-03 | Whole schema | **The repository is not the schema of record.** The code depends on objects the tracked SQL does not define: tables `contact_messages` (`contact.js:52`), `message_replies` (`admin.js:8921`), `wishlist_items` and `cart_items` (`admin.js:7413-7414`); columns `reviews.status` (`admin.js:7937`), `reviews.order_id` and `reviews.product_name` (`app.js:2777-2778`), `orders.user_id` (`admin.js:7427`); bucket `receipts` (`checkout.js:632`) | High |
| BUG-04 | `assets/js/cart.js:233-237`; `assets/js/checkout.js:510`, `:543-544` | The promo discount is shown in the cart and then dropped: checkout never reads it, so the customer is asked to pay the full amount and `used_count` never increases | High |
| BUG-05 | `assets/js/checkout.js:530-553`; `assets/js/admin.js:3307-3310` | Stock is never reduced, at order time or at any status change. Items can be oversold indefinitely | High |
| BUG-06 | `assets/js/admin.js:3307-3310` | No staff action sets `payment_status`. A confirmed, delivered order still reads as unpaid, so revenue cannot be reconciled from the data | High |
| BUG-07 | `assets/js/admin.js:7937` against `assets/js/shop.js:810` | Staff approve a review by writing `status`; the storefront shows reviews where `is_approved = true`. Unless the live database bridges the two, approved reviews never appear | High |
| BUG-08 | `assets/js/track.js:174-180` against `supabase_complete.sql:674-682` | Order tracking reads `orders` with the public key, but only staff and the signed-in owner of the email may read orders. Guests always get "No order found" under the tracked policies | High |
| BUG-09 | `assets/js/app.js:2776-2785` against `supabase_complete.sql:468-479` | The post-delivery review prompt inserts no `product_id` (required) and no comment when left blank (required); the insert fails and the customer sees "Failed to submit review" | Medium |
| BUG-10 | `assets/js/track.js:92` | Timeline dates for completed steps are invented as "order date plus one day per step" | Medium |
| BUG-11 | `assets/js/contact.js:51-59`, `:78-80` | When saving the contact message fails, the error is logged and the customer is still told "Message sent successfully" | Medium |
| BUG-12 | `assets/js/dashboard.js:1128-1130` | "Deactivate account" sets a metadata flag that no code reads; the account keeps working | Medium |
| BUG-13 | `assets/js/admin.js:2513-2516`, `:7431-7434` | Removing staff or deleting a customer deletes the `profiles` row only; the Auth user and its credentials remain. The storefront then signs the user out on every load (`assets/js/auth.js:1321-1324`) | Medium |
| BUG-14 | `assets/js/dashboard.js:809`; `assets/js/app.js:113`; `assets/js/admin.js:126` | Three different storage keys for the theme (`theme`, `LBS_THEME`, `theme_pref`); the dashboard selector does not change what the rest of the site reads | Low |
| BUG-15 | `sw.js:8-9`; `assets/js/app.js:12-13`; `site.webmanifest:5` | Three hand-maintained version numbers have drifted (build 77, build 81, 1.71.35) | Low |
| BUG-16 | `home.html:40`; `assets/js/cart.js:164` | `assets/img/og-image.png` and `assets/img/placeholder.png` are referenced and do not exist | Medium |
| BUG-17 | `sitemap.xml:4`, `:16`, `:22`, `:58`; `robots.txt:6` | The sitemap lists `/home` (canonical is `/`), the `noindex` cart and checkout pages, and `/dashboard`, which `robots.txt` disallows. No product URL exists to list | Medium |
| BUG-18 | `README.md:78-80`, `:113` | The README describes files that are not in the repository (`send-order-email`, `order_email_trigger.sql`, `DEPLOYMENT.md`) | Low |

### 5.3 Structure and code quality

| # | Where | Problem | Severity |
|---|---|---|---|
| STR-01 | `index.html:1`, `home.html:1` | Two copies of the home page, differing by about forty lines | Medium |
| STR-02 | All pages, e.g. `home.html:267-479`, `:808-1260` | Header, mobile drawer, footer, cart drawer, auth modals and search overlay are duplicated in every HTML file | High |
| STR-03 | `assets/js/app.js:657` and `assets/js/shop.js:502`; `assets/js/app.js:377` and `assets/js/shop.js:1516` | Two product modals and two cart drawers. `shop.js` (2,072 lines) is also loaded on the home page (`home.html:1280`) | High |
| STR-04 | `assets/js/admin.js:1` | One 9,269-line file holds the entire admin: auth, twelve views, exports, charts | High |
| STR-05 | `assets/js/utils.js:15`; `assets/js/admin.js` | 746 `console.log` calls across the scripts in `assets/js` (344 in `admin.js`), silenced in production by overwriting `console.log` | Medium |
| STR-06 | `assets/js/app.js:17-97` | A version-mismatch routine deletes all caches, unregisters service workers and reloads the page up to twice; a symptom of the hand-rolled cache strategy | Medium |
| STR-07 | `vercel.json:15-16`, `:56-57` | All pages are `no-store` and all CSS and JavaScript `no-cache`, so the 612 KB stylesheet is revalidated on every navigation | Medium |
| STR-08 | `assets/js/checkout.js:663`, `:925`; `assets/js/app.js:34`, `:2636`, `:2952`; `assets/js/contact.js:83`; `assets/js/shop.js:536` | Seven empty `catch` blocks in the storefront scripts; elsewhere errors are logged and then ignored, for example the newsletter handler, which reports success whatever happens (`assets/js/app.js:2073-2080`) | Medium |
| STR-09 | `assets/js/config.js:32-41`; `checkout.html:687-693` | The list of delivery states exists twice (fee table and hard-coded options) | Low |
| STR-10 | `checkout.html:833`; `faq.html:778`; `terms.html:505` | The bank account details are typed into three files | Medium |
| STR-11 | `assets/js/config.js:19`; `supabase/functions/send-admin-invite/index.ts:11` | The brand is "Lingeries by Sisioyin" on the site and "Lingerie by Sisioyin" in emails and the logo | Low |
| STR-12 | `assets/js/size.js:32`; `assets/js/cart.js:383` | 22 uses of `alert`, `confirm` and `prompt` for user dialogue | Low |
| STR-13 | `assets/js/admin.js:7924` | Inline `onclick` handlers bound to functions hung on `window` | Low |

### 5.4 Performance

| # | Where | Problem | Severity |
|---|---|---|---|
| PERF-01 | `assets/css/styles.css:1` | One 612 KB unminified stylesheet for every page; 176 selectors defined more than once; Lighthouse reports 77 KiB transferred and unused on the home page | High |
| PERF-02 | `assets/js/shop.js:163-168` | The whole catalogue is fetched with `select("*")` and filtered in the browser; no pagination | Medium |
| PERF-03 | `home.html:1264-1282` | Eleven scripts on the home page, including reCAPTCHA on every page for a modal most visitors never open | Medium |
| PERF-04 | `assets/js/home.js:685` | Hero and category images are fetched from the database after load and swapped in; the hero cannot be preloaded and is the largest paint | Medium |
| PERF-05 | `assets/js/analytics.js:538` | A blocking-order geo-IP request to a third party at the start of every session | Low |
| PERF-06 | `assets/css/styles.css:2690` | 66 `backdrop-filter` declarations and 68 keyframe animations in the storefront stylesheet | Low |

### 5.5 Accessibility

| # | Where | Problem | Severity |
|---|---|---|---|
| A11Y-01 | `home.html:10` (same on every page) | `maximum-scale=1, user-scalable=no` prevents zooming | High |
| A11Y-02 | `assets/js/app.js:2572-2574` | Consent switches have no accessible name; the dialog does not trap focus | High |
| A11Y-03 | `home.html:569`, `:884` | Heading levels skip; the footer copyright and legal links fail contrast (Lighthouse `color-contrast`) | Medium |
| A11Y-04 | `assets/js/checkout.js:219` | Validation is shown by border colour only, with one generic toast; no message is tied to the field | High |
| A11Y-05 | `assets/js/utils.js:202` | Toasts stay for ten seconds and are not announced through a live region | Medium |
| A11Y-06 | `assets/js/shop.js:502` | Product modal built with `innerHTML`; focus is not trapped or returned | Medium |
| A11Y-07 | `home.html:520-531` | Hero image starts with an empty `src` and inline `onload` script | Low |

### 5.6 Design

| # | Where | Problem | Severity |
|---|---|---|---|
| DES-01 | `assets/css/styles.css:118-122`, `:140`, `:442` | Pink-to-rose gradient as the primary surface, a pink glow shadow, and gradient-filled text. 158 gradient declarations in the storefront stylesheet, 32 in the admin | High |
| DES-02 | `home.html:483-508`, `:562-594`, `:713`, `:735` | The home page is the stock template in order: hero with two buttons and floating stat chips, four identical icon cards, product grid, three category cards, testimonials, call-to-action band | High |
| DES-03 | `assets/css/styles.css:14193` | Decorative blurred circles behind the hero | Medium |
| DES-04 | `assets/css/styles.css:61` | No real system: 106 distinct hex colours, 38 distinct border-radius values, 102 distinct box-shadow values, 40 distinct media queries, 206 `!important`, a cool slate neutral scale that fights the warm brand | High |
| DES-05 | `home.html:552`, `:590`, `:501` | Unsupported claims and stock marketing language in the copy: a hard-coded "500+" happy customers figure, "24/7 Support", and banned stock verbs in the hero paragraph | Medium |
| DES-06 | `supabase/functions/send-admin-invite/index.ts:53-55`, `:77` | Emails use the same pink gradient and emoji as icons | Medium |
| DES-07 | `assets/img/logo.svg:3-6` | The logo is drawn with gradients and depends on a web font being installed to render its lettering | Medium |
| DES-08 | `assets/js/utils.js:338`; `assets/js/home.js:571` | Placeholder images from `placehold.co` in pink when a product or site image is missing | Medium |

---

## 6. Proposed folder structure

```
lingerie-by-sisioyin/
├── public/
│   ├── icons/                      favicon set, app icons, maskable icon
│   ├── og/                         default Open Graph image
│   ├── site.webmanifest
│   └── admin.webmanifest
├── src/
│   ├── app/
│   │   ├── (store)/                storefront layout: header, footer, drawers
│   │   │   ├── page.tsx            home
│   │   │   ├── shop/page.tsx
│   │   │   ├── products/[slug]/page.tsx
│   │   │   ├── cart/page.tsx
│   │   │   ├── checkout/page.tsx
│   │   │   ├── confirmation/page.tsx
│   │   │   ├── track/page.tsx
│   │   │   ├── wishlist/page.tsx
│   │   │   ├── dashboard/          overview, orders, addresses, profile, settings
│   │   │   ├── contact/page.tsx
│   │   │   ├── faq/page.tsx
│   │   │   ├── size/page.tsx
│   │   │   ├── privacy/page.tsx
│   │   │   └── terms/page.tsx
│   │   ├── admin/                  server-gated layout
│   │   │   ├── (auth)/             sign-in, invitation sign-up, reset
│   │   │   ├── page.tsx            dashboard
│   │   │   ├── orders/  inventory/  products/  messages/  customers/
│   │   │   ├── reviews/  analytics/  activity/  site-images/  staff/  trash/
│   │   ├── auth/callback/route.ts  OAuth, verification and recovery exchange
│   │   ├── api/visits/route.ts     first-party visit record and duration
│   │   ├── sitemap.ts  robots.ts  not-found.tsx  error.tsx  layout.tsx
│   │   └── sw.ts                   service worker source
│   ├── components/
│   │   ├── ui/                     Button, Input, Select, Dialog, Drawer, Toast, Badge, Table, Skeleton, Stepper, Tabs
│   │   └── layout/                 Header, Footer, MobileNav, SearchOverlay
│   ├── features/
│   │   ├── catalogue/  product/  cart/  wishlist/  checkout/  orders/
│   │   ├── account/  auth/  reviews/  contact/  consent/  analytics/  pwa/
│   │   └── admin/                  one folder per admin view
│   ├── server/
│   │   ├── supabase/               browser, server and service-role clients (one of each)
│   │   ├── actions/                zod-validated server actions per feature
│   │   ├── queries/                typed read functions
│   │   ├── email/                  Resend client and templates
│   │   └── auth/                   session and role guards
│   ├── lib/                        formatMoney, formatDate, delivery fees, constants
│   ├── schemas/                    zod schemas shared by forms and actions
│   ├── types/                      database.ts (generated), domain types
│   ├── styles/                     tokens.css (the only source of design tokens), globals.css
│   ├── config/                     site, navigation, env (zod-parsed)
│   └── proxy.ts                    session refresh, admin gate, security headers and nonce
├── supabase/
│   ├── migrations/                 baseline from the live database, then one file per change
│   └── seed.sql                    local development data only
├── tests/
│   ├── unit/                       pricing, merge rules, validators
│   └── e2e/                        parity flows, accessibility, viewport checks
├── next.config.ts  tsconfig.json  eslint.config.mjs  postcss.config.mjs
├── package.json  package-lock.json  .nvmrc  .env.example (names only)
└── README.md
```

---

## 7. Proposed design direction

**Idea.** A quiet boutique: warm paper-like ground, near-black type, one deep wine as the single brand colour, and the photography doing the persuading. Nothing glows, nothing is gradient-filled, and the interface recedes behind large images with room around them. The audience is shoppers in Lagos and the nearby states the store delivers to, who are linked to Instagram, TikTok and WhatsApp throughout the site and who pay by bank transfer — so the design must feel trustworthy and unhurried at 360 pixels wide before anything else.

### 7.1 What is kept and what changes

| Existing asset | Decision |
|---|---|
| Wordmark "LINGERIE / BY SISIOYIN" and the LBS monogram with the small bow (`assets/img/logo.svg`) | **Kept in form.** Redrawn as outlined vector paths (so it no longer depends on an installed font), in flat wine or ink, without gradients |
| Cormorant Garamond, already the brand's display face (`assets/css/styles.css:144`) | **Kept** as the display font |
| Brand pink `#be185d` and the pink-to-rose gradient | **Replaced** by wine `#6B1F2E`. The pink reads as generic and fails the no-pink-gradient rule; the owner's approval is requested in section 9 |
| Slate grey neutrals | **Replaced** by a warm ink and nude scale |
| Inter body font | **Replaced** by Instrument Sans |
| Font Awesome | **Replaced** by Lucide |
| App icons and favicon (gradient tile) | **Redrawn** from the kept monogram on flat wine |

### 7.2 Palette

One primary (wine), one accent (brass, used sparingly for rating stars and a "new" marker), and a warm neutral scale. Blush is a flat tint only.

| Token | Hex | Use |
|---|---|---|
| `ivory` | `#FAF6F0` | Page background |
| `white` | `#FFFFFF` | Raised surfaces: cards, dialogs, inputs |
| `nude-100` | `#F3EAE0` | Alternate section background, image placeholders |
| `nude-200` | `#E8DBCD` | Hairlines, dividers |
| `nude-300` | `#D8C5B3` | Decorative rules only (not text, not control borders) |
| `blush` | `#F1DDD6` | Flat tint for selected chips and notices |
| `ink-900` | `#1C1517` | Headings and body text |
| `ink-700` | `#3D3235` | Strong secondary text |
| `ink-600` | `#5C4F52` | Secondary text |
| `ink-500` | `#766A6C` | Muted text and captions, on `ivory` or `white` only |
| `ink-450` | `#8E8284` | Input and control borders |
| `wine-600` | `#832A3B` | Hover on wine text links |
| `wine-700` | `#6B1F2E` | Primary: buttons, links, focus ring |
| `wine-800` | `#551622` | Pressed state |
| `wine-900` | `#3F0F18` | Deepest shade, footer option |
| `wine-100` | `#F4E4E6` | Flat tint behind wine text |
| `brass` | `#8A6A2F` | Accent: stars, "new" marker, on `ivory` or `white` only |
| `success` / `success-bg` | `#2F6B4A` / `#E6F0EA` | Confirmed, delivered |
| `warning` / `warning-bg` | `#8A5A12` / `#F7ECD9` | Pending, low stock |
| `error` / `error-bg` | `#A12A2A` / `#F8E5E3` | Errors, cancelled |
| `info` / `info-bg` | `#2F5570` / `#E4EDF2` | Shipped, notices |

Dark theme (the site has one today and it is kept): background `#161012`, surface `#211A1C`, text `#F3EAE0`, muted `#B9ABA9`, primary `#E0A3AE` with `#161012` text on it.

**Contrast, computed with the WCAG 2.x relative-luminance formula** (script kept outside the repository):

| Foreground | Background | Ratio | AA normal text (4.5) | Use |
|---|---|---|---|---|
| `ink-900` | `ivory` | 16.69 | Pass | Body |
| `ink-900` | `white` | 17.96 | Pass | Body on cards |
| `ink-900` | `nude-100` | 15.10 | Pass | |
| `ink-900` | `blush` | 13.73 | Pass | |
| `ink-700` | `ivory` | 11.43 | Pass | |
| `ink-600` | `ivory` | 7.24 | Pass | Secondary |
| `ink-600` | `white` | 7.79 | Pass | |
| `ink-600` | `nude-100` | 6.55 | Pass | |
| `ink-600` | `blush` | 5.96 | Pass | |
| `ink-500` | `ivory` | 4.82 | Pass | Captions |
| `ink-500` | `white` | 5.19 | Pass | |
| `ink-500` | `nude-100` | 4.36 | **Fail** — not used | |
| `wine-700` | `ivory` | 10.48 | Pass | Links |
| `wine-700` | `white` | 11.29 | Pass | |
| `wine-700` | `nude-100` | 9.49 | Pass | |
| `wine-700` | `blush` | 8.63 | Pass | |
| `wine-700` | `wine-100` | 9.18 | Pass | |
| `wine-600` | `ivory` | 8.27 | Pass | Link hover |
| `ivory` | `wine-700` | 10.48 | Pass | Primary button label |
| `ivory` | `wine-800` | 12.80 | Pass | Pressed |
| `ivory` | `ink-900` | 16.69 | Pass | Dark footer |
| `brass` | `ivory` | 4.66 | Pass | Accent text |
| `brass` | `white` | 5.02 | Pass | |
| `brass` | `nude-100` | 4.22 | **Fail** — not used | |
| `success` | `success-bg` | 5.42 | Pass | Status badge |
| `warning` | `warning-bg` | 5.06 | Pass | |
| `error` | `error-bg` | 6.01 | Pass | |
| `error` | `white` | 7.29 | Pass | Field error text |
| `info` | `info-bg` | 6.67 | Pass | |
| `ink-450` (border) | `ivory` / `white` / `nude-100` | 3.44 / 3.70 / 3.11 | Pass (3.0, non-text) | Control borders |
| Dark: `#F3EAE0` | `#161012` / `#211A1C` | 15.81 / 14.36 | Pass | |
| Dark: `#B9ABA9` | `#161012` / `#211A1C` | 8.47 / 7.70 | Pass | |
| Dark: `#E0A3AE` | `#161012` / `#211A1C` | 8.97 / 8.15 | Pass | |
| Dark: `#161012` | `#E0A3AE` | 8.97 | Pass | Button label |

For reference, the current pink `#be185d` on the current background measures 5.77 and the current muted grey `#94a3b8` on white measures 2.56 (fails).

### 7.3 Typography

- **Display: Cormorant Garamond** (500 and 600, with italic 500 for a single emphasised word). It is already the brand's lettering and gives the editorial tone. Used at 24 px and above only, because its thin strokes do not hold at small sizes.
- **Text and interface: Instrument Sans** (400, 500, 600). A plain, slightly narrow grotesque that stays legible at 14 px on budget Android screens and sets prices and tables cleanly with tabular figures.

Both are self-hosted with `next/font`, `display: swap`, Latin subset.

| Token | Size / line height | Face | Use |
|---|---|---|---|
| `display-xl` | 64 / 68 (40 / 44 below 768) | Cormorant 500, −0.01em | Home headline |
| `display-lg` | 48 / 54 (34 / 40) | Cormorant 500 | Page titles |
| `display-md` | 36 / 42 (28 / 34) | Cormorant 500 | Section titles, product name |
| `display-sm` | 28 / 34 (24 / 30) | Cormorant 600 | Card group titles |
| `title` | 20 / 28 | Instrument Sans 600 | Dialog and panel titles |
| `body-lg` | 18 / 28 | Instrument Sans 400 | Lead paragraphs |
| `body` | 16 / 26 | Instrument Sans 400 | Default |
| `body-sm` | 14 / 22 | Instrument Sans 400 | Secondary, table cells |
| `label` | 13 / 18, +0.06em, upper case | Instrument Sans 500 | Eyebrows, form labels in the admin |
| `caption` | 12 / 16 | Instrument Sans 400 | Meta, timestamps |

Prices use tabular figures. The customer text-size setting (G-18) scales the root size as it does today.

### 7.4 Layout

- **Grid:** 4 columns below 768 px, 8 from 768, 12 from 1024. Gutters 16 / 24 / 32 px.
- **Containers:** content 1200 px, wide 1360 px for the shop and admin, reading width 680 px for legal pages and FAQs.
- **Breakpoints (one set):** 480, 768, 1024, 1280, 1536. Designs are checked at 360, 390, 768, 1024, 1280 and 1536.
- **Rhythm:** sections are separated by 96 px on desktop and 56 px on mobile. Product imagery is 4:5, hero and category imagery 3:4, matching `IMAGE_SIZING_GUIDE.md` so existing photographs fit without re-cropping.
- **Admin:** fixed 248 px sidebar from 1024 px, drawer below; denser spacing and `body-sm` as the base.

### 7.5 Scales

- **Spacing (4/8 based):** 0, 4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96, 128.
- **Radius (one scale):** `none` 0 for photographs and full-bleed sections; `sm` 2 px for inputs, buttons and badges; `md` 4 px for cards and menus; `lg` 8 px for dialogs and drawers; `full` for avatars and the cart count. Square-edged photographs are a deliberate part of the editorial look.
- **Shadow (one scale, warm-tinted):** `none` (default; separation comes from hairlines and background steps); `sm` `0 1px 2px rgb(28 21 23 / 0.06)` for sticky header and raised menus; `md` `0 8px 24px rgb(28 21 23 / 0.10)` for popovers and toasts; `lg` `0 24px 48px rgb(28 21 23 / 0.16)` for dialogs and drawers. Cards do not lift on hover.
- **Icons:** Lucide only, 1.5 px stroke, 20 px in the interface and 16 px inline. Social marks are text links in the footer, since a single icon set is used and brand logos are not part of it.
- **Motion:** 120 ms for colour and opacity, 200 ms for drawers and dialogs, 320 ms as the maximum for a gallery cross-fade; one easing curve (`cubic-bezier(0.2, 0, 0, 1)`). Motion only confirms an action or shows where something came from. No scroll-triggered entrance animations beyond a single short fade on first paint of imagery, no counters, no parallax. `prefers-reduced-motion` removes all movement.

### 7.6 Key screens

**Home (`/`).**
1. A slim announcement line: delivery states and the WhatsApp number, in `label` type.
2. Header: wordmark left, navigation centre (Shop, Women, Men, Kids), search, account and bag right.
3. Opening spread, asymmetric: on desktop a 3:4 photograph fills seven of twelve columns edge to edge on the right; on the left five columns, bottom-aligned, sit an eyebrow, a two-line serif headline, one sentence, and a single underlined text link to the shop. On mobile the photograph comes first at full width with the text below it. The hero image remains admin-managed.
4. "New in": a heading with a "View all" text link, then four large 4:5 tiles (two per row on mobile, the row scrolls horizontally with snap). Each tile is image, name, price; the wishlist heart is the only control over the image.
5. Categories as an uneven mosaic rather than three matching cards: Lingerie tall on the left spanning two rows, Loungewear and Underwear stacked on the right, each with a serif caption set over a flat ink band beneath the image, not over the photograph.
6. A single plain-text service line with hairlines above and below: the delivery states and fee range, the returns rule in the store's own words, and "Message us on WhatsApp". No icon cards.
7. One customer quotation at a time in large serif italic with name and location, drawn from approved testimonials; the section is omitted when there are none.
8. Footer: wordmark, three link columns, contact line, legal links.

**Shop (`/shop`).** Page title in serif with the result count. A sticky toolbar with search, sort and a "Filter" button on mobile; from 1024 px, filters sit in a 240 px left column as plain checkbox lists with hairline separators. Active filters appear as chips under the toolbar. Grid of 4:5 tiles: two columns on mobile, three at 768, four at 1280. Tile: photograph, name, price, a small brass "New" label where set, colour dots when the product has colours. Quick view is kept (parity S-12 to S-24) as a dialog on desktop and a full-height sheet on mobile; the product name in it links to the full product page.

**Product page (`/products/<slug>`, new, carries everything in the quick view).** Left: gallery, a main 4:5 image with thumbnails in a column on desktop and a swipeable strip with a counter on mobile; tapping opens the full-screen viewer. Right, sticky on desktop: category eyebrow, serif name, price, stock note, colour swatches with the chosen name written out, size buttons with a "Size guide" link, quantity, "Add to bag" in wine at full width, wishlist as a text button. Below: description, delivery and returns in disclosure rows, share links, then reviews.

**Cart (`/cart`).** Two columns from 1024 px: lines on the left (image, name, size and colour, quantity stepper, line total, edit and remove as text buttons), summary on the right in a bordered panel (promo code, delivery estimate by state, subtotal, discount, delivery, total, "Checkout"). On mobile the summary follows the lines and a sticky bar shows the total and the checkout button.

**Checkout (`/checkout`).** A calm single column of 560 px with the order summary collapsible at the top on mobile and fixed at the right on desktop. Steps are numbered sections on one page (Contact, Delivery, Payment); a completed step collapses to a one-line summary with "Edit". Payment shows the bank transfer as three numbered instructions: the account details in a bordered block with a copy button for the number and the exact amount to send; the receipt upload with file name and remove; a checkbox confirming the transfer. "Pay with card" stays listed as unavailable. Every field has a visible label and an inline error message. "Place order" is the only wine button on the page.

**Confirmation and tracking.** Confirmation: serif "Thank you", the order number large in tabular figures with a copy button, what happens next in three plain sentences (payment is checked by a person, then a confirmation email), then the order summary. Tracking: order number field plus the email or phone used (see section 9), then a vertical timeline using real timestamps.

**Account (`/dashboard`).** Left navigation list on desktop, bottom tab bar on mobile. Overview shows three figures in a single bordered row and the latest orders as a list. Orders are rows, not cards; a row opens a detail panel with the timeline, items and the cancel or return action when available. Settings are grouped under plain headings with switches.

**Admin (`/admin`).** Utilitarian and dense: ivory ground, white tables with hairline rows, wine reserved for the primary action in each view. Sidebar with grouped links and counts for pending orders and unread messages. Orders and customers are tables with sticky headers that become stacked rows below 768 px; detail opens in a right-hand drawer. The product editor is a two-column form (details and variants on the left, images and visibility on the right) with a sticky save bar. Order detail shows the receipt beside the total with two explicit actions, "Confirm payment" and "Reject receipt".

**Emails.** White background, wordmark at the top, serif heading, body in a system sans fallback, one flat wine button, no gradients or emoji.

---

## 8. Rebuild plan

### 8.1 Phases and commits

**Phase 0 — Foundations (3 days)**
1. `chore: scaffold Next.js 16 app with TypeScript strict, ESLint and Prettier`
2. `chore: add environment schema and .env.example (names only)`
3. `db: add baseline migration captured from the live schema`
4. `chore: generate database types and add Supabase clients`
5. `ci: add build, lint, type-check, unit and e2e workflows`
6. `feat: add proxy with session refresh, security headers and CSP nonce`

**Phase 1 — Design system (4 days)**
7. `feat(ui): add design tokens and global styles`
8. `feat(ui): add fonts and type scale`
9. `feat(ui): add Button, Input, Select, Checkbox, Switch, Badge`
10. `feat(ui): add Dialog, Drawer, Toast, Tabs, Skeleton, Table, Stepper`
11. `feat(brand): add redrawn wordmark, monogram and icon set`
12. `feat(layout): add header, footer, mobile navigation and theme control`

**Phase 2 — Catalogue (7 days)**
13. `feat(catalogue): add product queries and domain types`
14. `feat(home): add opening spread, new arrivals, categories, testimonials`
15. `feat(shop): add grid, filters, sort, search and URL state`
16. `feat(product): add product page with gallery, variants and stock rules`
17. `feat(product): add quick view dialog`
18. `feat(search): add search overlay with keyboard shortcut`
19. `feat(wishlist): add wishlist store and page`
20. `feat(reviews): add review list, eligibility check and submission`
21. `feat(catalogue): add realtime refresh`
22. `feat(seo): add product metadata, structured data and legacy product redirect`

**Phase 3 — Cart, checkout, orders (6 days)**
23. `feat(cart): add cart store on existing storage keys, drawer and page`
24. `db: add place_order and validate_promo functions with stock decrement`
25. `feat(cart): add promo code and delivery estimate`
26. `feat(checkout): add contact, delivery and payment steps with validation`
27. `feat(checkout): add private receipt upload and place-order action`
28. `feat(orders): add confirmation page`
29. `feat(orders): add tracking page with verified lookup`
30. `feat(email): add order confirmation and store notification`

**Phase 4 — Authentication and account (5 days)**
31. `feat(auth): add sign-in, sign-up, Google sign-in and callback route`
32. `feat(auth): add reset, set-password, verification and expired-link screens`
33. `feat(auth): add server-side captcha verification and account-status enforcement`
34. `feat(account): add overview and orders with cancel and return actions`
35. `feat(account): add addresses and profile`
36. `feat(account): add settings, data export, deactivation and deletion`
37. `feat(sync): add cross-device merge and realtime updates`
38. `feat(email): add customer welcome and account emails`

**Phase 5 — Content pages (2.5 days)**
39. `feat(contact): add contact form, message storage and email`
40. `feat(faq): add categories, accordion and search`
41. `feat(size): add measuring guide, charts and calculator`
42. `feat(legal): add privacy and terms with section navigation`
43. `feat: add not-found and error pages`

**Phase 6 — Admin (12 days)**
44. `feat(admin): add server gate, staff sign-in and invitation sign-up`
45. `feat(admin): add shell, navigation, idle timeout and activity logging`
46. `feat(admin): add dashboard view`
47. `feat(admin): add inventory list, filters and bulk actions`
48. `feat(admin): add product editor with variants and image upload`
49. `feat(admin): add trash`
50. `feat(admin): add orders table, detail, status flow and payment confirmation`
51. `feat(admin): add customers table, detail and account actions`
52. `feat(admin): add messages inbox, reply and compose`
53. `feat(admin): add reviews moderation`
54. `feat(admin): add site images`
55. `feat(admin): add staff management and invitations`
56. `feat(admin): add activity log`
57. `feat(admin): add analytics views`
58. `feat(admin): add CSV, JSON, TXT and PDF exports`
59. `feat(email): add staff invitation, welcome and customer reply emails`

**Phase 7 — Consent, analytics, PWA (4 days)**
60. `feat(consent): add consent dialog and enforcement`
61. `feat(analytics): add GA4 and Meta Pixel events behind consent`
62. `feat(analytics): add first-party visit recording through the server`
63. `feat(pwa): add manifests, service worker, install prompt and update flow`
64. `feat(pwa): add time-boxed admin worker retirement`

**Phase 8 — Hardening and SEO (3 days)**
65. `db: tighten row-level policies and role functions`
66. `db: make receipts private and add signed access`
67. `feat(seo): add sitemap, robots, canonical rules and Open Graph images`
68. `chore: add redirects for legacy URLs`
69. `chore: remove edge functions and order-email trigger after parity sign-off`

**Phase 9 — Verification and cut-over (5 days)**
70. `test: add parity e2e suite`
71. `test: add accessibility and viewport suites`
72. `docs: rewrite README and add operations notes`
73. `chore: remove legacy static files`

### 8.2 Verification plan

| Area | Check | Pass condition |
|---|---|---|
| Build | `npm run build` | Exit 0, no warnings |
| Lint | `eslint . --max-warnings 0` | 0 errors, 0 warnings |
| Types | `tsc --noEmit` | 0 errors; no suppressions in the tree (searched for in CI) |
| Unit | `vitest run` | Pricing, promo, delivery fee, stock cap, merge rules, validators all pass |
| Parity | Section 2 checklist, each of the 286 items ticked against a Playwright test or a recorded manual check on a staging Supabase project | 286 of 286 |
| Viewports | Playwright screenshots of every route at 360, 390, 768, 1024, 1280, 1536 | No horizontal scroll, no overlap, no clipped text |
| Accessibility | `@axe-core/playwright` on every route in both themes; manual keyboard and screen-reader pass through shop → product → cart → checkout and through admin orders | No WCAG 2.2 AA violations; zoom allowed; visible focus; dialogs trap and return focus |
| Lighthouse | Mobile, production build, on home, shop, product, cart, checkout, track | 90 or more in all four categories (cart, checkout and track assessed on the three categories other than SEO, as they are deliberately `noindex`, and separately confirmed as `noindex`) |
| Security headers | Response check on a preview deployment | HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors`, and a CSP with nonces and no `'unsafe-inline'` script |
| Database | Policy tests as `anon`, customer, editor, super admin, owner | Each role can do exactly what section 10 specifies and nothing more |
| SEO assets | Automated check | Unique title and description per route; canonical; Open Graph and Twitter images that resolve; `sitemap.xml` with products; `robots.txt`; favicon set; both manifests valid |
| Redirects | Scripted requests for every row of the URL map in 3.5 | Expected status and target |
| Payments | Staging walk-through: place order, upload receipt, staff confirm, stock reduced, emails sent; forced failure shows an error and keeps the cart | As described |

### 8.3 Effort estimate

| Phase | Working days |
|---|---|
| 0 Foundations | 3 |
| 1 Design system | 4 |
| 2 Catalogue | 7 |
| 3 Cart, checkout, orders | 6 |
| 4 Authentication and account | 5 |
| 5 Content pages | 2.5 |
| 6 Admin | 12 |
| 7 Consent, analytics, PWA | 4 |
| 8 Hardening and SEO | 3 |
| 9 Verification and cut-over | 5 |
| **Total** | **51.5** |

The estimate assumes the owner's inputs in section 9 arrive before Phase 2 and that the live schema matches what the client code implies. Card payments through Monnify are not included (about 4 further days if approved).

### 8.4 Risks and mitigations

| Risk | Mitigation |
|---|---|
| The live database differs from the tracked SQL in ways the code does not reveal | Capture the baseline first (commit 3); do not write policies or actions against assumptions; review the diff with the owner |
| Tightening policies breaks the current live site before cut-over | Apply policy migrations at cut-over, not before; rehearse on a staging project restored from a schema dump |
| Sources of four edge functions and the order-email trigger are missing | Obtain them from the owner or the Supabase dashboard; until then E-03 to E-06 are re-specified from their call sites and confirmed with the owner |
| Customers are signed out at launch | Announce in the launch note; the cart survives because the storage keys are kept |
| Search ranking moves when product pages appear and `/home` redirects | 308 redirects, correct canonicals, a sitemap with products, and Search Console monitoring for four weeks |
| Old service workers keep serving cached pages | Same `/sw.js` URL with an immediate-activation update; retirement worker at `/admin-sw.js` |
| Supabase image transformation may not be enabled on the plan | Confirm with the owner; otherwise the Next.js image optimiser handles resizing from the original objects |
| Orders arriving during cut-over | Launch in a quiet window; the database is unchanged, so no order is lost; old pages keep working until DNS points to the new deployment |
| Tracked product photographs are of mixed size and ratio | Fixed 4:5 and 3:4 frames with `object-fit: cover`; flag unsuitable images to the owner before launch |
| Scope creep in the admin (twelve views) | The parity checklist is the scope; additions go to a follow-up list |

---

## 9. Needed from the owner

### 9.1 Access and source material

1. A schema-only dump of the live Supabase database (tables, policies, functions, triggers, storage buckets and policies), or permission to run `supabase db pull` against it.
2. The source of the edge functions `send-contact-email`, `send-admin-reply`, `send-user-welcome` and `send-order-email`, and the SQL of the order-email trigger.
3. A staging Supabase project (or approval to create one) for rehearsal.
4. Confirmation of the Supabase plan, specifically whether image transformation is enabled.

### 9.2 Environment variable names (values to be set in Vercel, never committed)

`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS`, `EMAIL_SUPPORT_ADDRESS`, `NEXT_PUBLIC_GA_MEASUREMENT_ID`, `NEXT_PUBLIC_FB_PIXEL_ID`, `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`, `RECAPTCHA_SECRET_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (optional), `NEXT_PUBLIC_WHATSAPP_NUMBER`. Only if card payments are approved: `MONNIFY_API_KEY`, `MONNIFY_SECRET_KEY`, `MONNIFY_CONTRACT_CODE`, `MONNIFY_BASE_URL`.

### 9.3 Domain and service settings

- Which host is canonical: `www.lingeriebysisioyin.store` (used in canonical tags, `home.html:25`) or the apex (used in `assets/js/config.js:22` and the emails). One will redirect to the other.
- Supabase Auth: add the new `/auth/callback` URL to the redirect allow-list; confirm email-confirmation and password-recovery templates.
- Google Cloud: add the callback to the OAuth client; restrict or rotate the Maps key noted at `assets/js/config.js:54`.
- Resend: confirm the verified sending domain and the sender addresses.
- Vercel: change the project from "no framework" to Next.js; set the Node.js version.

### 9.4 Images (specific gaps)

- The logo as original vector artwork, if it exists outside the repository; otherwise approval to redraw it from `assets/img/logo.svg`.
- One hero photograph, portrait 3:4, at least 1800 × 2400 px, with clear space on one side for nothing to compete with the garment.
- Three category photographs (Lingerie, Loungewear, Underwear), 3:4, at least 1200 × 1600 px. An Accessories image if that category is to appear on the home page.
- One Open Graph image, 1200 × 630 px (the file referenced at `home.html:40` does not exist).
- Product photography review: every product needs at least one 4:5 image of 1600 × 2000 px; the owner to confirm which current images should be re-shot.
- Measuring diagrams for the size guide (bust, underbust, waist, hips) or approval for simple line drawings to be commissioned.
- A neutral fallback tile for products without an image (to replace the external placeholder service).

### 9.5 Copy and content

- The brand name: "Lingerie by Sisioyin" or "Lingeries by Sisioyin" (both are in use).
- Home headline and one supporting sentence in the owner's own voice; a one-line description of the brand for the footer.
- Evidence for, or removal of, the "500+ happy customers" figure and the "24/7 support" claim; actual WhatsApp response hours.
- The delivery states and fees to be shown, and whether delivery outside the seven listed states is offered (the home page says "Nationwide shipping", the checkout offers seven states).
- The returns policy in two sentences for product pages and checkout.
- Bank details to display at checkout, held in one place.
- Review of the FAQ, privacy policy and terms; these will be carried over verbatim unless edited.
- Real testimonials with permission, or agreement to omit the section until there are some.

### 9.6 Decisions held back

1. **Brand colour.** Approval to move from pink `#be185d` to wine `#6B1F2E`.
2. **Order tracking.** Require the email or phone number together with the order number (recommended, because order numbers are sequential), or allow lookup by number alone.
3. **Guest checkout.** Today checkout requires sign-in from the cart button only. Keep sign-in mandatory (recommended, and enforced on the server), or allow guests.
4. **Card payments.** Leave "Pay with card" as unavailable (parity), or add Monnify with server-side verification as a separate phase.
5. **Roles.** Confirm what an editor may see. Recommended: products, site images and reviews only; orders, customers, messages, analytics and exports for super admin and above.
6. **Developer role.** Keep or retire; the interface treats it as full access while the policies do not.
7. **Dead features** in the table at the end of section 2: remove, or build properly (newsletter, testimonial submission, rewards).
8. **Visit tracking.** Whether to keep storing visitor IP addresses, and for how long.
9. **Account deletion.** Whether "delete" should remove the Auth user after 30 days, as the confirmation email promises (`assets/js/dashboard.js:1200`).
10. **The other branch.** Permission to delete `copilot/vscode-mla2s7fz-afeb`.

---

## 10. Schema changes

Proposals for approval only. Nothing here has been applied. Each would be a separate migration, rehearsed on staging, applied at cut-over. All are additive or tighten access; none deletes data.

| # | Proposal | Reason |
|---|---|---|
| SC-01 | Baseline migration generated from the live database, replacing `supabase_complete.sql` and the six ad-hoc migrations as the schema of record | BUG-03 |
| SC-02 | `place_order(payload jsonb)` security-definer function: re-reads prices from `products`, validates and applies the promo code, computes delivery fee and total, checks and decrements stock (product and variant) in one transaction, increments promo `used_count`, inserts the order. Remove the "Anyone can create orders" policy | SEC-01, BUG-04, BUG-05 |
| SC-03 | `orders`: add `user_id uuid references auth.users`, `payment_receipt_path text`, `payment_confirmed_at timestamptz`, `payment_confirmed_by uuid`; extend the `payment_status` check to include `awaiting_confirmation`; index on `customer_email`. Backfill `user_id` by matching email | BUG-02, BUG-06 |
| SC-04 | `order_status_events(order_id, status, created_at, created_by)` written by trigger on status change; backfill one row per existing order | BUG-10 (real timeline dates) |
| SC-05 | `delivery_fees(state, fee_ngn, is_active)` so fees are computed by the database and edited without a deploy; seeded from `config.js:32-41` | SEC-01, STR-09 |
| SC-06 | `products`: add `slug text unique not null`, backfilled from the name with a numeric suffix on collision | Product URLs |
| SC-07 | Profiles: replace "admin update" and "owner manage roles" with (a) a trigger that rejects changes to `role`, `is_admin`, `account_status` and `return_privilege_revoked` unless made through approved functions, and (b) `set_staff_role(user_id, role)` and `set_account_status(user_id, status)` functions restricted by caller role | SEC-02, SEC-09 |
| SC-08 | `has_role(roles text[])` helper; rewrite staff policies so editors are limited to products, product images, site settings and reviews, and orders, customers, messages, visits and promo codes require super admin or above (subject to decision 5 in section 9.6) | SEC-12 |
| SC-09 | `handle_new_user()`: take the role from the matching `admin_invites` row, require an unexpired invitation, ignore `invited_role` in metadata | SEC-03, SEC-11 |
| SC-10 | `admin_invites`: store a hash of the token, generated on the server with a cryptographic source; `validate_invite_token` compares hashes | SEC-17 |
| SC-11 | Reviews and testimonials: insert policies with `WITH CHECK (is_approved = false)` (and `is_featured = false`); settle on one moderation column for reviews (`status` with a generated or triggered `is_approved`), add `user_id` and `order_id` if absent | SEC-10, BUG-07, BUG-09 |
| SC-12 | `promo_codes`: drop the public select policy; `validate_promo(code, subtotal)` returns only validity and percentage | SEC-15 |
| SC-13 | `site_visits`: drop the public update policy; inserts and duration updates go through the application server; decide on IP retention | SEC-08, SEC-21 |
| SC-14 | `receipts` bucket: private; upload limited to the authenticated customer under a per-user path with size and type limits; read for staff and the owner through signed URLs. Existing objects are kept; their public URLs stop working | SEC-05 |
| SC-15 | `contact_messages` and `message_replies`: record their definitions and policies in migrations (insert by anyone with field limits, read and update by staff, customers read their own) | BUG-03 |
| SC-16 | `SET search_path = public` on every security-definer function | SEC-23 |
| SC-17 | Remove `send_admin_welcome_email` (a placeholder) and, after sign-off, the order-email trigger | BE-10, E-06 |

---

## 11. Code and design standards

These govern the rebuild. Any change that cannot meet them is fixed at its cause, not waived.

**TypeScript**
- TypeScript strict throughout. No `any`. No `ts-ignore`, `ts-expect-error` or `ts-nocheck`. No `eslint-disable`. No `as unknown as X`. No non-null `!` used to silence an error.

**Structure**
- A clear structure: UI components, feature modules, server and data logic, types, utilities and configuration are kept apart. Files are small and focused.
- One source of truth for each thing: one Button, one date formatter, one money formatter, one API client per context, one set of design tokens.

**Server and data**
- zod validation on the server for every input. Real error messages. No empty `catch` blocks. Loading, empty and error states on every asynchronous screen.

**Cleanliness**
- No `console.log`, commented-out code, dead code, TODOs, lorem ipsum or placeholder images. Comments only where they explain a non-obvious reason.
- No patching: problems are fixed at the root. Configurations are never loosened to make a check pass. No re-export stubs, alias files, wrappers, or old and new versions side by side. (The one-release `/admin-sw.js` retirement worker in section 3.5 is a declared cut-over step with a removal commit, not a standing exception.)

**Design**
- The design must not look AI-built. No purple, blue or pink gradients, no gradient text, no neon glows, no glassmorphism, no blurred blobs. No emoji as icons and no mixed icon sets. Not the stock template (centred hero with two buttons, three identical feature cards, testimonials, call-to-action banner). Not every card in `rounded-2xl` with `shadow-lg` and hover-scale.
- This copy is not used: "Unlock", "Elevate", "Seamless", "Revolutionize", "Supercharge", "Empower", "Next-level", "Your all-in-one solution", "Built for the future". Copy is plain, specific and in a human voice.
- Motion is subtle, quick and purposeful.
- Instead: a design system for the project (colour tokens, a type scale, a 4/8-based spacing scale, one radius scale, one shadow scale); a restrained palette (one primary, at most one accent, a well-built neutral scale); a deliberate font pairing; a strong grid and generous white space; one icon set; real images through `next/image` with correct `sizes` and alt text.

---

No rebuild work will start until the owner approves this plan.
