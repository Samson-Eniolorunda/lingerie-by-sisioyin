# Lingerie by Sisioyin — Rebuild Plan

Audit and plan only. Nothing in the repository has been changed other than the addition of this file.

- Repository: `Samson-Eniolorunda/lingerie-by-sisioyin`, branch `rebuild/production` (HEAD `4387196`)
- Audit date: 18 November 2026
- Revised the same day to make mobile the priority: section 12 (mobile first), section 13 (quality gates) and section 14 (what will make it stand out) were added, and section 8 was reworked so that the mobile work and the gates are part of the phases
- Scope read: 68 tracked files, about 86,000 lines (16 HTML pages, 2 stylesheets, 20 scripts, 2 service workers, 2 manifests, 1 schema file, 6 migrations, 2 edge functions, `vercel.json`, documentation)

---

## 1. Product summary

Lingerie by Sisioyin is a direct-to-consumer online shop for a Nigerian lingerie, loungewear and underwear brand (delivery within Lagos is free; the site keywords name Lagos and Nigeria). Prices are in Nigerian naira, delivery is offered to seven Nigerian states with a fee per state (`assets/js/config.js:32-41`), and customer service runs largely through WhatsApp.

It is built as a static multi-page site (hand-written HTML, one 30,404-line stylesheet, vanilla JavaScript loaded with `<script defer>`), hosted on Vercel, with Supabase providing Postgres, Auth, Storage, Realtime and Edge Functions. There is no build step, no package manifest and no automated test.

There are three audiences:

1. **Shoppers** browse a catalogue (categories Lingerie, Loungewear, Underwear, Accessories; genders Women, Men, Kids, Unisex), open a product quick-view modal, choose size, colour and quantity, save to a wishlist, add to a cart, and check out.
2. **Account holders** sign in with email and password or Google, and use a dashboard for orders, a tracking timeline, cancellation within 30 minutes, return requests, saved addresses, profile, preferences, data export and account deletion. Cart, wishlist, addresses and settings are synchronised across devices through the `profiles` row.
3. **Staff** (roles `owner`, `super_admin`, `developer`, `editor`) use `/admin` to manage products and variant stock, orders, customers, messages, reviews, site images, staff invitations, an activity log, a trash, analytics from first-party visit tracking, and CSV/PDF exports.

**Payment, as actually implemented.** The README states "Moniepoint (Monnify SDK)" and `config.js` carries a Monnify test-mode block (`assets/js/config.js:12-16`), but no script loads or calls Monnify anywhere. The only working payment method is a **manual bank transfer**: the checkout shows the business account at Moniepoint MFB, the customer uploads a receipt image or PDF to a Supabase Storage bucket, ticks "I have sent the payment" (a two-second timer, not a check: `assets/js/checkout.js:429-435`), and the order is inserted from the browser with `payment_status: "awaiting_confirmation"` (`assets/js/checkout.js:546-549`). "Pay with Card" is rendered disabled with a "Coming Soon" label (`checkout.html:780-782`). **Payment is verified by a member of staff looking at the receipt** and moving the order from Pending to Processing (the admin has no action that sets the `confirmed` status: `assets/js/admin.js:3124-3136`); nothing verifies payment programmatically and `payment_status` is never updated afterwards.

**Email.** Resend, called from Supabase Edge Functions. Two functions are tracked (`send-admin-invite`, `send-admin-welcome`); four more are called by the client but are not in the repository (`send-contact-email`, `send-admin-reply`, `send-user-welcome`, and the `send-order-email` function and database trigger described in `README.md:78-80`).

---

## 2. Feature inventory (parity checklist)

**Total: 354 checklist items.** Every item below exists in the code today and must work after the rebuild. The admin groups (2.13 to 2.20), the content pages (2.12) and the admin worker items in 2.22 were completed from a line-by-line read of `assets/js/admin.js`, `admin.html`, `admin-sw.js` and the bodies of `faq.html`, `privacy.html`, `terms.html` and `size.html`; items added in that pass carry their source line. Items marked *(defect today)* exist but are broken or unsafe as written; the rebuild delivers the intended behaviour, and the defect is listed in section 5. Dead code that has no reachable user interface is listed separately at the end and is not counted.

### 2.1 Routes and pages (R)

- [x] R-01 `/` serves the home page (Vercel rewrite `/` → `/home`, `vercel.json:7`)
- [ ] R-02 `/home` home page (`home.html`); `index.html` is a near-identical copy
- [x] R-03 `/shop` catalogue (`shop.html`)
- [x] R-04 `/cart` cart page (`cart.html`)
- [x] R-05 `/checkout` checkout (`checkout.html`)
- [x] R-06 `/confirmation` order confirmation (`confirmation.html`)
- [x] R-07 `/track` public order tracking (`track.html`)
- [x] R-08 `/wishlist` wishlist (`wishlist.html`)
- [ ] R-09 `/dashboard` customer account (`dashboard.html`)
- [x] R-10 `/contact` contact page (`contact.html`)
- [x] R-11 `/faq` frequently asked questions (`faq.html`)
- [x] R-12 `/size` size guide (`size.html`)
- [x] R-13 `/privacy` privacy policy (`privacy.html`)
- [x] R-14 `/terms` terms of service (`terms.html`)
- [ ] R-15 `/admin` staff panel (`admin.html`, rewrite at `vercel.json:8`), `noindex` and `X-Frame-Options: DENY`
- [ ] R-16 Custom 404 page with links to popular pages (`404.html`)
- [ ] R-17 Clean URLs: `*.html` requests redirect to the extension-less path (`vercel.json:3`)
- [ ] R-18 Deep links honoured: `/shop?category=`, `?gender=`, `?is_new=true`, `?search=` / `?q=`, `?product=<id>`; `/track?order=` / `?id=`; `/contact?subject=`; `/dashboard?setpw=1`; `/admin?invite=<token>`; `/admin?mode=staff`
- [ ] R-19 `/admin#<view>`: the open admin view is written to the URL hash and restored from it on reload, taking precedence over the view remembered for the session (`assets/js/admin.js:1988-1989`, `:2022`)
- [ ] R-20 Cross-page anchors used in the legal copy: `/privacy#data-deletion` (`terms.html:463`) and `/dashboard#settings` (`privacy.html:709`) *(defect today: the dashboard ignores the hash)*

### 2.2 Global shell on storefront pages (G)

- [ ] G-01 Header with logo, primary navigation (Home, Shop, Women, Men, Kids) and active-link state
- [ ] G-02 Account button: opens the sign-in modal when signed out; shows initials and links to `/dashboard` when signed in
- [x] G-03 Cart button with live item-count badge
- [x] G-04 Mobile navigation drawer: account block, Home, Shop, New Arrivals, Cart, Wishlist; category shortcuts (Women, Men, Kids, Lingerie, Loungewear, Underwear); support links (FAQs, Size Guide, Contact, Terms, Privacy)
- [ ] G-05 Theme: light, dark and system, persisted, applied before first paint, switchable from the floating control, the mobile drawer and the dashboard
- [x] G-06 Search overlay: opens from the header or Ctrl/Cmd+K, closes on Escape or backdrop; debounced product search over name, category and description (8 results)
- [x] G-07 Search fallback: six latest products under "You might like" when nothing matches, plus a "View all results" link to `/shop?search=`
- [x] G-08 Cart drawer: line items with image, size, colour; quantity up/down; remove; subtotal; checkout link; continue shopping; empty state
- [x] G-09 Footer: shop links, help links (My Account, Track Order, FAQs, Size Guide, Contact), legal links, social links (Instagram, TikTok, WhatsApp from `config.js:25-29`), current year
- [x] G-10 Floating WhatsApp button with a small pop-up card and a pre-filled enquiry message
- [ ] G-11 Cookie and consent dialog: Essential (locked), Analytics, Marketing, Functional; "Accept All", "Save Preferences", "Essential Only"; choice stored *(defect today: not enforced on later page loads)*
- [x] G-12 Toast notifications (success, error, info, warning)
- [x] G-13 Skip-to-content link
- [ ] G-14 Loading skeletons per page and a slow-network spinner after three seconds
- [ ] G-15 Scroll-reveal entrance animation, with a reduced-motion rule
- [ ] G-16 Form persistence for the session: non-password field values on checkout and contact survive a reload
- [ ] G-17 Scroll position restored on reload; top of page on fresh navigation
- [ ] G-18 Account-level text size preference (small, medium, large) applied site-wide
- [ ] G-19 Live catalogue refresh through Supabase Realtime on the `products` table (home and shop grids)
- [ ] G-20 Post-delivery review prompt: after sign-in, a pop-up asks for a star rating and comment on the most recent delivered order without a review *(defect today)*
- [ ] G-21 On mobile, focused form fields scroll into view above the keyboard
- [ ] G-22 Social links and WhatsApp number driven from one configuration object
- [ ] G-23 Print stylesheet: header, footer, mobile navigation, buttons, modals, toasts, WhatsApp widget, cart drawer, quick view and shop sidebar are hidden; product cards and cart lines do not break across pages; the shop grid prints in three columns (`assets/css/styles.css:7706-7736`, `:9855-9869`). There is no dedicated receipt or invoice print layout

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

- [x] H-01 Hero: headline, supporting line, link to the shop, link to new arrivals
- [ ] H-02 Hero image supplied from the admin (site setting `hero_image`)
- [x] H-03 New Arrivals grid: up to eight active products flagged `is_new`, falling back to the latest products
- [ ] H-04 Product cards: image, name, price, rating stars, "new" marker, wishlist toggle, quick-view and quick-add actions
- [ ] H-05 Category showcase for Lingerie, Loungewear and Underwear with admin-managed images, each linking to the filtered shop
- [ ] H-06 Service facts row (delivery, quality, returns, WhatsApp support)
- [ ] H-07 Customer testimonials: up to six approved entries, with an empty state
- [ ] H-08 Closing link to the full collection
- [ ] H-09 Structured data: Organisation and WebSite with SearchAction (`home.html:78-107`)

### 2.5 Shop and product (S)

- [x] S-01 Catalogue grid of all active, non-deleted products with skeleton loading
- [x] S-02 Filter by category (Lingerie, Loungewear, Underwear, Accessories)
- [x] S-03 Filter by gender (Women, Men, Kids, Unisex)
- [x] S-04 Price range filter with dual sliders and numeric inputs (0–500,000)
- [x] S-05 Filter by delivery type (express, standard)
- [x] S-06 "In stock only" and "New arrivals only" toggles
- [x] S-07 In-page text search over name, category and description
- [x] S-08 Sort: newest, most reviewed, price ascending, price descending, name
- [x] S-09 Result count, active-filter chips with individual removal, "clear all", mobile filter toggle with an active-filter count
- [x] S-10 "No products found" state with a clear-filters action
- [x] S-11 Filters and search pre-applied from URL parameters
- [x] S-12 Product quick view: gallery with thumbnails, previous/next and a full-screen image viewer opened by double-click or double-tap (`assets/js/shop.js:995-1015`, `:1940-1962`). The storefront gallery has no swipe today; swipe exists only in the admin viewer (MI-02). The rebuild adds it (section 12.7)
- [x] S-13 Product quick view: name, category, price, description, pack type, delivery-type tag, stock indicator
- [x] S-14 Size selection with per-size availability
- [ ] S-15 Colour selection with swatches (when the product allows it), per-colour availability, "Assorted" handling
- [x] S-16 Quantity stepper capped by variant, colour, size or product stock (`shop.js:1018-1065`)
- [x] S-17 Add to cart from quick view; opens the cart drawer
- [x] S-18 Edit a cart line from the cart or checkout: reopens quick view pre-filled and replaces the line
- [ ] S-19 Quick add from a card for products without size or colour choices
- [x] S-20 Wishlist toggle on cards and in quick view
- [ ] S-21 Share: Facebook, X, Instagram, TikTok, WhatsApp, copy link
- [x] S-22 Size-guide link from quick view
- [ ] S-23 Reviews in quick view: average, count, list of up to 20 approved reviews
- [ ] S-24 "Write a review" available only to signed-in customers with a delivered order containing the product; form with name, email, title, star rating, comment; held for approval
- [x] S-25 `/shop?product=<id>` opens that product directly
- [ ] S-26 Analytics events: view item, add to cart, add to wishlist, search

### 2.6 Wishlist (W)

- [ ] W-01 Wishlist stored on the device and synchronised to the account
- [x] W-02 Wishlist page: grid of saved products with image, price, rating and "new" marker
- [x] W-03 Remove one item; clear the whole wishlist
- [x] W-04 Item count and empty state with a link to the shop
- [ ] W-05 Open quick view or add to cart from a wishlist card

### 2.7 Cart (C)

- [ ] C-01 Cart stored on the device (`LBS_CART_V1`) and synchronised to the account
- [x] C-02 Cart page: line items with image, name, size, colour, unit price and line total
- [x] C-03 Quantity up/down, remove, edit (S-18)
- [x] C-04 Clear cart with confirmation
- [x] C-05 Promo code entry: validated against `promo_codes` (active, not expired, under usage limit); percentage discount shown; removable *(defect today: discount never reaches the order)*
- [x] C-06 Delivery estimator: state selector populated from the configured fee table, "Free" for zero
- [x] C-07 Summary: subtotal, discount, delivery, total
- [ ] C-08 Proceeding to checkout requires sign-in; the sign-in modal opens otherwise
- [ ] C-09 Progress indicator (Cart, Shipping, Payment, Done) and breadcrumb
- [x] C-10 Empty-cart state

### 2.8 Checkout and payment (K)

- [x] K-01 Three-step accordion: Contact, Delivery, Payment, with per-step validation, completion ticks and edit buttons
- [x] K-02 Contact step: first name, last name, email, phone
- [ ] K-03 "Use my profile details" banner for signed-in customers
- [x] K-04 Delivery step: address, city, state (Lagos, Ogun, Oyo, Osun, Ondo, Ekiti, Abuja FCT), landmark, order notes
- [ ] K-05 Saved-address picker that fills the delivery fields
- [ ] K-06 Google Places address autocomplete restricted to Nigeria, when a Maps key is configured (currently blank)
- [x] K-07 Delivery fee by state from the configured table; totals update on change
- [x] K-08 Payment method: Bank Transfer (active) and Pay with Card (shown as "Coming Soon", disabled)
- [x] K-09 Bank details panel (bank, account number, account name) with copy-to-clipboard
- [x] K-10 Receipt upload: image or PDF, 5 MB limit, file name preview, remove
- [x] K-11 "I have sent the payment" confirmation, enabled only once a receipt is attached
- [x] K-12 Order summary: items with edit links, subtotal, discount row, delivery, total
- [ ] K-13 Place Order: uploads the receipt, creates the order, clears and synchronises the cart, redirects to the confirmation page *(defect today)*
- [ ] K-14 Order numbers generated by the database in the form `LBS-DDMMYYYY-NNNN`
- [x] K-15 Double-submit guard and button loading state
- [x] K-16 Empty-cart state on the checkout page
- [ ] K-17 Order confirmation email to the customer and notification to the store (trigger and `send-order-email`, not tracked: `README.md:78-80`)

### 2.9 Confirmation and tracking (T)

- [x] T-01 Confirmation page: order number, items, subtotal, delivery, total, delivery address, contact details, note that an email is on its way
- [x] T-02 Confirmation page redirects to the shop when opened without an order
- [x] T-03 Track page: look up by order number (`LBS…`) or by order-id prefix *(defect today for guests)*
- [x] T-04 Track result: status badge, five-step timeline (Placed, Confirmed, Processing, Shipped, Delivered), cancelled state, items and total
- [ ] T-05 Track page auto-search from `?order=` / `?id=`
- [x] T-06 "Not found" state

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

- [x] P-01 Contact form: name, email, phone, subject (order, product, sizing, returns, wholesale, other), order ID, message
- [ ] P-02 Contact submission stored in `contact_messages` and emailed through `send-contact-email`; success panel with "send another"
- [x] P-03 Contact fallback to a pre-filled WhatsApp message when submission throws
- [x] P-04 Contact channels: WhatsApp, phone, email, Instagram, TikTok
- [x] P-05 FAQ: category tabs (all, orders, shipping, returns, payment, sizing, account), accordion, live search with a no-results state
- [x] P-06 Size guide: how to measure (bust, underbust, waist, hips)
- [x] P-07 Size charts with tabs: bras, panties, bodysuits, loungewear
- [x] P-08 Bra size calculator from underbust and bust measurements in centimetres (`assets/js/size.js:27-57`): both fields required; band 30 to 42 in 5 cm underbust steps starting below 68 cm (`:38-44`); cup A, B, C, D, DD or E in 3 cm steps of bust minus underbust starting below 11 cm (`:49-54`); result shown as band plus cup *(defect today: BUG-32)*
- [x] P-09 Privacy policy with a table of contents that highlights the section in view (9 sections)
- [x] P-10 Terms of service with the same table of contents behaviour (10 sections)
- [x] P-11 FAQ content: 23 questions in six groups (Orders 4, Shipping 5, Returns & Exchanges 4, Payment 3, Sizing 3, Account 4), each answer keeping its links to `/shop`, `/dashboard`, `/track`, `/contact`, `/size`, WhatsApp and Instagram (`faq.html:438-1002`)
- [x] P-12 FAQ behaviour in detail: search field in the page hero; one answer open at a time; choosing a tab clears the search; the search waits 300 ms, matches question and answer text across all groups, hides groups with no match and deselects the tabs; "Clear Search" restores everything (`faq.html:385-394`; `assets/js/faq.js:11-33`, `:36-51`, `:54-101`, `:104-107`) *(defect today: BUG-30)*
- [ ] P-13 FAQ answers that repeat operational data and must stay in step with it: cancellation window, delivery fees per state, delivery times, return window, refund time, bank details (`faq.html:512`, `:580-585`, `:601-607`, `:680`, `:745`, `:777-781`) *(defect today: BUG-31)*
- [x] P-14 FAQ closing panel "Still have questions?" linking to `/contact` (`faq.html:1021-1033`)
- [x] P-15 Size guide introduction and measuring advice (lightweight underwear, a soft tape, snug but not tight) above the four measuring cards (`size.html:371-375`, `:387-392`)
- [x] P-16 Size chart data: bras 32A to 38D (eight rows: underbust in centimetres and inches, cup, bust in centimetres); panties XS to XXL (waist and hips in centimetres and inches); loungewear XS to XXL (bust, waist, hips in centimetres, UK size 6 to 16); bodysuits XS to XL (bust, waist, hips and torso length in centimetres) (`size.html:453`, `:535`, `:603`, `:671`)
- [x] P-17 Fit tips: between sizes, torso length, fabric and stretch, when to measure (`size.html:732-784`)
- [x] P-18 Size guide closing panel "Still Not Sure?" linking to `/contact` (`size.html:833-842`)
- [x] P-19 Legal page furniture on both pages: "Last updated" date in the hero, introduction, table of contents that stays in view on desktop, section anchors offset below the fixed header, highlighted call-out paragraphs, closing contact panel (`privacy.html:337`, `:344-377`, `:484-489`, `:843-849`; `assets/css/styles.css:18568-18574`, `:18641-18644`; `assets/js/legal.js:5-19`)
- [x] P-20 Privacy "Data Deletion Instructions" section: four request routes (dashboard, contact form, WhatsApp with pre-filled text, email), lists of data deleted and data retained, processing time, links to the Facebook and Google data controls (`privacy.html:696-807`)
- [x] P-21 Terms sections in order: Acceptance of Terms, Eligibility, Account Registration, Orders & Payment, Shipping & Delivery, Returns & Refunds, Intellectual Property, Prohibited Activities, Limitation of Liability, Contact Us (`terms.html:394-711`); the terms state the 30-minute cancellation window, the delivery fee table, the seven-day return rules and the 3–5 day refund time (`terms.html:518-524`, `:540-545`, `:565-601`)

### 2.13 Admin — access and shell (M)

- [x] M-01 Staff sign-in; access granted only when `is_admin()` returns true, otherwise signed out with "Access denied"
- [ ] M-02 Staff sign-up from an invitation link: token validated, email pre-filled and locked, role carried from the invitation
- [ ] M-03 Email confirmation screen, verified screen and expired-link screen for staff
- [ ] M-04 Password reset and set-new-password flows for staff, with the password rules
- [ ] M-05 Staff mode (`?mode=staff`): sign-up tab hidden, mode kept across redirects
- [ ] M-06 Welcome email to new staff with role and permissions (`send-admin-welcome`), sent once
- [ ] M-07 Complete-profile prompt when first or last name is missing
- [ ] M-08 Welcome overlay on sign-in and a sign-out overlay
- [ ] M-09 Sidebar navigation across twelve views, collapsible on mobile; last view remembered for the session
- [x] M-10 Role-based interface: Activity Logs, Manage Admins, Trash and Invite are shown only to owner, super admin and developer *(defect today: interface only)*
- [x] M-11 Role label beside the status text; name and role in the sidebar
- [ ] M-12 Idle timeout after 30 minutes with a 60-second warning and "stay signed in"
- [ ] M-13 Change password from the sidebar; "View Store" link
- [x] M-14 Theme switch (light, system, dark) in the top bar, and a light/dark switch in the sidebar footer for narrow screens (`admin.html:968-993`, `:824-832`; `assets/js/admin.js:196-212`)
- [x] M-15 Confirm dialog (danger, warning and information variants), three-second toast, and five-second undo toast with a countdown bar for destructive actions (`assets/js/admin.js:229-272`, `:1168-1176`, `:300-331`) *(defect today: the undo toast is never displayed, BUG-19)*
- [x] M-16 Keyboard shortcuts: Ctrl/Cmd+S saves the product form while the editor is open, Escape closes dialogs, the image viewer and the mobile menu (`assets/js/admin.js:623-641`, `:1966-1973`)
- [ ] M-17 Activity logging of staff actions with device information (device type, browser, operating system); staff name and role added by a database trigger
- [ ] M-18 Staff form validation messages: empty sign-in ("Kindly input your login details."), per-field "required" messages, the five password rules and "Passwords do not match." on sign-up and set-password (`assets/js/admin.js:6012-6021`, `:6023-6047`, `:6057-6072`)
- [ ] M-19 The sign-up tab is hidden once any member of staff exists, unless the visitor arrives by invitation (`assets/js/admin.js:8434-8449`)
- [ ] M-20 An invalid or expired invitation shows the expired-link screen with a request-a-new-invitation message (`assets/js/admin.js:8402-8412`)
- [ ] M-21 The expired-link screen offers "Resend Confirmation Email" for sign-up links and "Request Password Reset" otherwise; the verified screen signs the user out and offers "Proceed to Staff Login" (`assets/js/admin.js:1484-1502`, `:1531-1539`, `:1364`, `:1390-1401`)
- [ ] M-22 A non-staff account that verifies through the admin link is sent to `/home` (`assets/js/admin.js:8297-8302`, `:8348-8351`)
- [ ] M-23 Password reset replies "If the email exists, a recovery link has been sent."; after a new password is set the user is signed out and returned to sign-in; a reload during recovery keeps the set-password form (`assets/js/admin.js:8138`, `:8168-8170`, `:8259-8268`)
- [ ] M-24 Top bar: page title, staff name with role, product count, export menu, refresh-all button (inventory, dashboard, orders, analytics, messages, activity) and theme buttons (`admin.html:856-857`, `:954-966`; `assets/js/admin.js:5834-5853`)
- [ ] M-25 Sidebar grouped as Store, Customers, Insights and Settings, with "Invite Admin" opening the invitation dialog and "Logout" in the footer (`admin.html:719-803`, `:833-836`)
- [ ] M-26 Each view loads its data when opened; Orders, Activity, Analytics and Messages have their own refresh buttons; the admin holds no Realtime subscription (`assets/js/admin.js:2052-2100`, `:3345-3346`, `:6897`, `:9215`)
- [ ] M-27 Loading skeletons for the product grid, lists, dashboard widgets, reviews, messages and tables (`assets/js/admin.js:358-419`, `:3002-3003`)
- [ ] M-28 Events written to the activity log: sign-in, profile completed, product create and update, delete, bulk delete, restore, permanent delete and empty trash, order status change, staff promote, demote and remove, invitation, site images saved, customer suspend, ban and reactivate, return-privilege change and customer delete (`assets/js/admin.js:5823`, `:1868`, `:6493`, `:6339`, `:3583`, `:2900`, `:2921`, `:2955`, `:3321`, `:2454`, `:2483`, `:2525`, `:5516`, `:2667`, `:7621`, `:7547`, `:7465`). Review moderation and message actions are not logged today
- [x] M-29 On narrow screens data tables collapse into cards with a label before each value (`assets/css/admin.css:4407-4408`; `assets/js/admin.js:3083-3093`)
- [x] M-30 Admin print stylesheet: sidebar, top bar, dialogs, toasts and the bulk bar are hidden and the content offset is removed (`assets/css/admin.css:5247-5265`)
- [ ] M-31 Browser storage keys in use: local `lbs-admin-auth`, `theme_pref`, `LBS_WELCOME_SENT_<user id>`, `lbs_site_images_updated`; session `LBS_ADMIN_VIEW`, `LBS_ADMIN_STAFF_MODE`, `LBS_ADMIN_RECOVERY_MODE` (`assets/js/supabase.js:14`; `assets/js/admin.js:126`, `:1551`, `:2675`, `:2023`, `:66-68`)

### 2.14 Admin — dashboard view (MD)

- [x] MD-01 Totals: products, orders, revenue, pending orders
- [x] MD-02 Recent orders widget: the five latest orders with short id, date, customer and status badge; empty and error states (`assets/js/admin.js:5620-5669`)
- [x] MD-03 Low-stock widget: up to five products with a quantity below 10, lowest first; "All products in stock" when none (`assets/js/admin.js:5680-5703`) *(defect today: BUG-23)*
- [x] MD-04 Pending-orders and unread-messages badges in the sidebar
- [x] MD-05 The revenue total counts delivered orders only (`assets/js/admin.js:5572-5574`)
- [x] MD-06 "View All" links from the two widgets to Orders and Inventory (`admin.html:1047`, `:1057`) *(defect today: no handler is bound, BUG-28)*

### 2.15 Admin — inventory and product editor (MI)

- [x] MI-01 Inventory list, newest first, with search, category filter (Accessories, Lingerie, Loungewear, Underwear), stock filter (in stock, out of stock) and pagination (12 per page) *(defect today: the two filters do nothing, BUG-20)*
- [ ] MI-02 Product cards with image viewer (swipe, previous and next, dots, count)
- [x] MI-03 Bulk select and bulk move to trash, with a confirm dialog and undo *(defect today: the bulk bar is never displayed, BUG-19)*
- [x] MI-04 Product editor ("Add Product"): name, price, description, category, gender (Women, Men, Unisex, Kids), quantity, delivery type (standard, same-day)
- [x] MI-05 Sizes and colours are entered as variants (MI-13), with colour suggestions; colour type switch (Open Selection, Assorted Pack); pack type
- [x] MI-06 Variant stock list (size × colour × quantity) with add, remove, quantity steppers and low/out-of-stock markers (low at five or fewer). The grid-style matrix in the script has no markup and is dead code
- [ ] MI-07 Image upload with client-side compression to the `product-images` bucket, slider preview (swipe, dots) and remove. Images cannot be reordered today: new uploads are appended after the existing ones (`assets/js/admin.js:6451`)
- [x] MI-08 Active ("Live") and "New Arrival" switches
- [x] MI-09 Edit an existing product; delete (soft delete to trash) from the card or the editor, with a confirm dialog and undo *(defect today: the undo toast is never displayed, BUG-19)*
- [ ] MI-10 Audit fields (`created_by`, `updated_by`, `updated_at`) set by triggers
- [ ] MI-11 Inventory search over name, category and description with a clear button, a live product count in the top bar and a "No products match your search" state (`assets/js/admin.js:3425-3432`, `:3447`, `:3653-3664`; `admin.html:1149-1152`)
- [x] MI-12 Product card: first image, name, price, "N in stock" or "Out of Stock", Edit and Remove, and a selection tick (`assets/js/admin.js:3744-3782`)
- [x] MI-13 Variant entry row: size (XS, S, M, L, XL, XXL, XXXL, One Size), free-text colour with fifteen suggestions, quantity; quick-size buttons S, M, L, XL; Enter adds; an existing size-and-colour pair has its quantity replaced; negative quantities are refused (`admin.html:1419-1500`; `assets/js/admin.js:4713-4771`, `:4944-4965`)
- [x] MI-14 Variant list grouped by size in a fixed order, each line with a colour dot (31 named colours), a per-size colour count, and a footer with variant and unit totals; the heading counter shows total units (`assets/js/admin.js:4842-4924`, `:4572-4604`, `:4483-4491`)
- [x] MI-15 The product's `sizes` and `colors` are derived from the variants with summed quantities; older products stored as plain string lists are still read on edit (`assets/js/admin.js:4798-4840`, `:5320-5368`)
- [x] MI-16 "Assorted Pack" shows the pack type (2-in-1, 3-in-1, 4-in-1) and saves the product with no colours and no variant stock; "Open Selection" saves both (`admin.html:1389-1403`; `assets/js/admin.js:4141-4152`, `:6468-6474`)
- [ ] MI-17 Image handling: several files at once; each resized to fit 800 × 1000 px and re-encoded as JPEG at quality 0.82 (files under 50 KB, and files that are not images, are left alone); stored at `products/<product id>/<timestamp>_<name>`; double-click opens a full-screen preview (`assets/js/admin.js:424-477`, `:6259-6276`, `:5194-5198`; `admin.html:1520-1531`)
- [ ] MI-18 Editor modes: "Add New Product" with "Clear Form"; "Editing <name>" with a Delete button; after saving or deleting, the editor resets and returns to the inventory (`assets/js/admin.js:5232-5281`, `:5300-5302`, `:5219-5227`, `:6500-6503`)
- [x] MI-19 Required fields: name, price, category and stock quantity; price and quantities not below zero (`admin.html:1295`, `:1305-1306`, `:1329`, `:1356-1357`) *(defect today: BUG-25)*

### 2.16 Admin — orders (MO)

- [x] MO-01 Counters for pending, processing, shipped, delivered
- [x] MO-02 Orders table with status filter, refresh and pagination
- [x] MO-03 Order detail: customer, contact, delivery address, items, totals, discount and promo code, notes, payment method, link to the uploaded receipt
- [x] MO-04 Status progression (pending → processing → shipped → delivered) with one action per step ("Process Order", "Ship Order", "Mark Delivered"), and cancel where allowed (`assets/js/admin.js:3124-3155`) *(defect today: no staff action sets `confirmed`, BUG-22)*
- [x] MO-05 Order timeline in the detail view: Pending, Processing, Shipped, Delivered, or a single Cancelled marker (`assets/js/admin.js:3157-3183`)
- [x] MO-06 Table columns: short order id (first eight characters), date, customer, item count, total, status, View; newest first; ten per page (`assets/js/admin.js:3083-3098`, `:3008`, `:2990`)
- [x] MO-07 Status filter values: all, pending, processing, shipped, delivered, cancelled (`admin.html:1215-1220`)
- [x] MO-08 Cancel is offered while an order is pending or processing and asks for confirmation; delivered and cancelled orders show a final-status label and no action (`assets/js/admin.js:3124-3155`, `:3194-3199`, `:3288-3292`)
- [x] MO-09 A status change sets `updated_at`, is written to the activity log, closes the dialog and reloads the table (`assets/js/admin.js:3307-3310`, `:3321-3324`)
- [ ] MO-10 The detail header shows the order number (falling back to the short id) and the date and time; the payment panel shows the payment reference (`assets/js/admin.js:3216`, `:3227-3231`, `:3247`)

### 2.17 Admin — customers (MC)

- [x] MC-01 Customer table with search, totals (all, new, with orders), order count and spend per customer
- [ ] MC-02 Customer detail modal: profile (name, email, phone, WhatsApp number, date of birth, joined, order count, total spent, status) and the visit data in MC-11 (`assets/js/admin.js:7701-7709`). It does not list the customer's orders
- [ ] MC-03 Suspend, ban and reactivate, each with an email to the customer
- [ ] MC-04 Revoke and restore return privilege, with an email
- [ ] MC-05 Delete customer data with double confirmation and an email
- [ ] MC-06 Message a customer from the row (opens compose)
- [ ] MC-07 Customer export as CSV, JSON, TXT and PDF from the Customers view, with the columns name, email, phone, WhatsApp, orders, total spent, joined (`assets/js/admin.js:7334-7344`, `:1072-1080`)
- [ ] MC-08 Table columns: number, name, email, phone, WhatsApp number, date of birth, orders, total spent, joined, status, actions; oldest account first; no pagination (`admin.html:2241-2251`; `assets/js/admin.js:7158`, `:7250-7260`)
- [x] MC-09 Figures: orders are matched to customers by email; "total spent" counts delivered orders only; "New (30d)" counts accounts created in the last 30 days (`assets/js/admin.js:7167-7174`, `:7191-7196`)
- [x] MC-10 Search over name, email, phone and WhatsApp number (`assets/js/admin.js:7289-7301`) *(defect today: BUG-21)*
- [ ] MC-11 Customer detail "Location & Device" from recorded visits: last IP address, country, region, city, device, browser, operating system, device brand, screen size, known IP addresses and cities; table of the 20 most recent visits (date, page, IP address, location, device, time spent) (`assets/js/admin.js:7677-7682`, `:7717-7727`, `:7743-7762`)
- [ ] MC-12 Deleting a customer removes wishlist items, cart items, reviews, visits and messages, de-links orders (which are kept) and deletes the profile; every customer action is written to the activity log (`assets/js/admin.js:7412-7434`, `:7465`, `:7547`, `:7621`)

### 2.18 Admin — messages (MM)

- [ ] MM-01 Inbox list with counters (total, unread, replied), search, subject filter, pagination
- [x] MM-02 Message detail: sender, phone, order ID, body, reply thread
- [ ] MM-03 Reply by email from a chosen sender address (`send-admin-reply`); reply stored in `message_replies`; status set to replied
- [x] MM-04 Mark as unread; delete message with its replies
- [ ] MM-05 Compose a new message to a customer chosen by search
- [ ] MM-06 Two-pane layout on desktop, list/detail with back button at 900 px and below (`assets/js/admin.js:8711-8714`)
- [ ] MM-07 Filters: status chips (All, Unread, Replied, Read); category list (General Inquiry, Order Issue, Returns & Exchanges, Sizing Help, Wholesale, Other, Order Notifications); search over name, email, message and order ID with a 250 ms delay; 20 per page (`admin.html:2465-2520`; `assets/js/admin.js:8554-8577`, `:8460`, `:9237-9243`)
- [x] MM-08 List card: initials, name, category, status badge (New, Read, Replied) and a 90-character preview of the latest reply (prefixed "You:" for staff) or of the original message, with a relative time (`assets/js/admin.js:8609-8654`, `:8684-8699`)
- [x] MM-09 Opening a message marks it read and updates the counters and the sidebar badge; the thread shows the original message and all replies, customer and staff, in time order, scrolled to the latest (`assets/js/admin.js:8716-8725`, `:8811-8853`, `:8805-8807`)
- [ ] MM-10 Sender addresses offered for replies and new messages: support@, info@, orders@ and contact@ on the store domain (`admin.html:2688-2697`, `:2395-2408`)
- [ ] MM-11 Compose in detail: recipient search from two characters (eight matches by name or email), the chosen recipient shown as a removable tag, optional subject with a default, message required; the message is stored as a `contact_messages` row with status "replied" and emailed (`assets/js/admin.js:9065-9081`, `:9110-9138`, `:9151-9154`, `:9167-9173`, `:9180-9194`) *(defect today: BUG-26)*

### 2.19 Admin — reviews, site images, staff, activity, trash (MX)

- [ ] MX-01 Reviews list with status and rating filters and counters
- [ ] MX-02 Approve, reject and delete a review *(defect today)*
- [ ] MX-03 Site images: hero and three category images, each by URL or by upload to the `site-images` bucket, with preview and save
- [ ] MX-04 Storefront picks up new site images without a redeploy
- [x] MX-05 Manage admins: list with role badges
- [x] MX-06 Promote to super admin, demote to editor, remove a member of staff
- [ ] MX-07 Invite a member of staff by email with a role (editor or super admin); seven-day expiry; invitation email (`send-admin-invite`); fallback link shown if the email fails
- [ ] MX-08 Activity log with search, action filter and refresh
- [x] MX-09 Trash: list soft-deleted products, restore, delete permanently, empty trash
- [ ] MX-10 Review card: reviewer name (or email), date, star rating, product name, comment and status, with Approve, Reject and Delete (delete asks for confirmation); counters for total, approved, pending, rejected and average rating (`assets/js/admin.js:7848-7870`, `:7911-7928`, `:7950`)
- [ ] MX-11 Site images in detail: recommended dimensions shown beside each field; typing a URL updates the preview; uploads are compressed, named with a timestamp and given a public URL; each setting stored as `{url, alt}`; saving signals other open storefront tabs to refresh (`admin.html:1689-1693`, `:1740-1743`; `assets/js/admin.js:2624-2658`, `:2675`, `:2691-2694`, `:2735-2744`)
- [x] MX-12 Staff list ordered by role priority then date; the signed-in user is marked "You"; owner and developer accounts are marked "Protected" and offer no actions; promote, demote and remove are logged and removal asks for confirmation (`assets/js/admin.js:2406-2413`, `:2365-2391`, `:2505-2510`)
- [ ] MX-13 Invitation in detail: email format checked; inviting the same email again replaces its token, role and expiry; role choices described as "Editor - Can add and edit products" and "Super Admin - Full access"; the invitation is logged (`assets/js/admin.js:5444-5446`, `:5456-5466`, `:5516`; `admin.html:226-227`)
- [ ] MX-14 Activity log in detail: the latest 100 entries; each shows staff name, role badge, action, entity, subject, device, browser and operating system, and a relative time; search over staff name, subject, email, entity and action with a 250 ms delay; action filter values login, create, update, delete, restore, invite (`assets/js/admin.js:2263-2267`, `:2238-2252`, `:2298-2309`, `:3354-3360`; `admin.html:1623-1629`)
- [ ] MX-15 Trash in detail: each entry shows image, name, category and how long ago it was deleted; restoring returns the product to the inventory; permanent delete and "Empty Trash" each ask for confirmation; all three are logged (`assets/js/admin.js:2817-2846`, `:2884-2906`, `:2936-2941`, `:2975-2977`)

### 2.20 Admin — analytics and exports (MA)

- [x] MA-01 Period selector (7, 30, 90 days) and refresh
- [x] MA-02 Indicators: page views, customers, orders, revenue, conversion rate
- [ ] MA-03 Revenue bar chart and order-status donut
- [ ] MA-04 Traffic chart, top pages, top products
- [ ] MA-05 Device type, device brand/model and browser tables
- [ ] MA-06 Visitors by country and by Nigerian state
- [ ] MA-07 Google Analytics and Meta Pixel configuration status cards
- [ ] MA-08 Export products, orders, customers, reviews and activity logs as CSV
- [ ] MA-09 Export the same five data sets as PDF (jsPDF with AutoTable)
- [ ] MA-10 The period selector governs the revenue chart, traffic chart, top pages, device tables and location tables; page views, customers, orders, revenue, conversion rate, the status donut and top products are all-time (`assets/js/admin.js:6554-6564`, `:6575-6586`, `:6602-6604`, `:6831-6833`)
- [ ] MA-11 Definitions: revenue is the total of delivered orders; conversion rate is orders divided by customers; top pages lists 15 with share of views; top products lists 10 by units, with revenue from delivered orders; countries lists 20; device brands lists 15; Nigerian states are visits with country code NG grouped by region (`assets/js/admin.js:6579-6586`, `:6798-6800`, `:6841-6860`, `:7061-7063`, `:6999`, `:7090`)
- [ ] MA-12 CSV columns: products (name, category, price, quantity, gender, sizes, colours, active, new, created); orders (order number, customer name, email, phone, status, total, subtotal, shipping cost, payment method, delivery state, item count, created); customers (name, email, phone, created); reviews (product id, reviewer name, reviewer email, rating, title, comment, status, created); activity (action, entity, entity id, staff id, details, created; latest 500); files named `<set>_<YYYY-MM-DD>.csv` (`assets/js/admin.js:698-712`, `:723-738`, `:754-761`, `:776-787`, `:797-812`) *(defect today for the activity set: BUG-24)*
- [ ] MA-13 PDF layout: title, export date and time, record count, table with a brand-coloured header and striped rows, landscape when there are more than six columns (`assets/js/admin.js:855-877`); columns per data set at `assets/js/admin.js:889-898`, `:929-938`, `:974`, `:1005-1012`, `:1046`
- [ ] MA-14 Export menu in the top bar on every view, ten entries (five CSV, five PDF), with a "no data" message for an empty set (`admin.html:862-951`; `assets/js/admin.js:650-653`, `:885-888`)

### 2.21 Analytics and tracking (N)

- [ ] N-01 Google Analytics 4 page views and e-commerce events (view item, add to cart, wishlist, begin checkout, purchase, search, sign-up, login)
- [ ] N-02 Meta Pixel page views and matching events
- [ ] N-03 First-party visit record per session in `site_visits`: page, referrer, device type, browser, operating system, device brand and model, screen and viewport size
- [ ] N-04 Approximate location (country, region, city, IP) from `ipapi.co`, falling back to `ipwho.is`
- [ ] N-05 Time on page recorded when the tab is hidden or closed
- [ ] N-06 Visit linked to the account after sign-in

### 2.22 Progressive web app (Q)

- [x] Q-01 Storefront web manifest (name, icons, standalone, start URL `/home`)
- [x] Q-02 Separate admin manifest ("LBS Admin", start URL `/admin`)
- [ ] Q-03 Storefront service worker: network-first pages with cached fallback, cached icons, offline image placeholder
- [ ] Q-04 Admin service worker scoped to `/admin`
- [ ] Q-05 Install banner on Android and install instructions on iOS, with dismissal remembered
- [x] Q-06 Update flow: new worker activates and the page reloads once
- [ ] Q-07 Push notification and notification-click handlers in the storefront worker (the admin worker has none)
- [ ] Q-08 Admin worker caching: the admin shell, icons and manifest are pre-cached; navigation is network-first, falling back to the cached page and then to `/admin`; scripts and styles are always fetched fresh; other same-origin files are served from cache and refreshed in the background; old admin caches are deleted on activation; Supabase and other third-party requests are left alone (`admin-sw.js:12-21`, `:39-56`, `:66-76`, `:81-93`, `:96-98`, `:100-128`)
- [ ] Q-09 Admin worker messages `SKIP_WAITING`, `GET_VERSION` and `FORCE_UNREGISTER`; each area registers its own worker and removes the other's registration where the scopes overlap (`admin-sw.js:132-146`; `assets/js/app.js:2330-2353`)

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
- [ ] E-13 `send-admin-reply` request contract, to be re-specified because the source is not tracked: replies and account notices send `recipientEmail`, `recipientName`, `originalSubject`, `replyText` and `fromEmail` (replies also `messageId` and `originalMessage`); compose sends `to`, `customerName`, `subject`, `message` and `fromEmail` (`assets/js/admin.js:8894-8904`, `:7450-7458`, `:9188-9194`)

### 2.26 SEO and platform (O)

- [ ] O-01 Title and meta description on every page
- [ ] O-02 Canonical links on public pages; `noindex` on cart, checkout, track and admin
- [ ] O-03 Open Graph tags and Twitter card on public pages
- [x] O-04 `robots.txt` and `sitemap.xml`
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
| Admin size-chip selector, colour and size stock lists, variant matrix table | `assets/js/admin.js:3933-4017`, `:4179-4325`, `:4403-4440`, `:4493-4569`; `admin.html` has no `#sizeChips`, `#addColorBtn`, `#pColorName` or `#variantMatrix` | Superseded by the variant list (MI-13, MI-14) |
| Admin status selector for orders | `assets/js/admin.js:3328-3332`, `:3383`; no `#orderStatusSelect` or `#updateOrderStatusBtn` in `admin.html` | Superseded by the status buttons (MO-04) |
| Admin recent-activity widget | `assets/js/admin.js:5729-5789`; never called, and no `#recentActivityList` in `admin.html` | |

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
| SEC-26 | `assets/js/admin.js:7718`, `:7724`, `:7726-7727` | The customer detail dialog writes `country_code`, `device_model` and the lists of known IP addresses and cities from `site_visits` into the page unescaped. Any visitor can insert and update visit rows (SEC-08), so this is a second stored script injection into a staff session, alongside SEC-14 | High |
| SEC-27 | `assets/js/admin.js:2358-2359`, `:2828`, `:2831-2832`, `:5720` | Staff names and emails in Manage Admins, product names and categories in the trash, and product names in the low-stock widget are written unescaped. The values are staff-authored or come from sign-up metadata | Medium |
| SEC-28 | `privacy.html:688-690` against `assets/js/admin.js:7717`, `:7726` | The privacy policy says visit records are kept "in anonymised form". The admin stores and displays each customer's raw IP addresses, cities and devices | Medium |

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
| BUG-19 | `admin.html:102`, `:111`; `assets/css/admin.css:122-124`; `assets/js/admin.js:325`, `:3519`, `:3553` | The undo toast and the bulk actions bar carry the `hidden` attribute, the admin stylesheet forces `[hidden]` to `display: none !important`, and the script only toggles an `active` class. Neither is ever displayed: undo after a delete is unavailable and bulk delete cannot be reached | Medium |
| BUG-20 | `admin.html:1101-1137`; `assets/js/admin.js:3680`, `:3709`, `:3726` | The inventory category and stock menus are built from `.dropdown-item` buttons while the script listens for `.ms-item` inside `.ms-wrapper`. Choosing an entry does nothing | Medium |
| BUG-21 | `assets/js/admin.js:7272-7273`, `:7799`, `:7811` | The Message and Details buttons store the row's position in the list as rendered and look it up in the unfiltered list. After a search they open a different customer, so a message can be composed to the wrong person | High |
| BUG-22 | `assets/js/admin.js:3124-3136` against `supabase_complete.sql:654`; `assets/js/dashboard.js:1238`; `assets/js/track.js:47` | The `confirmed` status exists in the table constraint, the customer timeline and the tracking page, and the FAQ and terms promise a confirmation once payment is verified (`faq.html:821-823`, `terms.html:512-515`). No staff action sets it; the admin moves an order straight from pending to processing | Medium |
| BUG-23 | `assets/js/admin.js:5709-5723` against `supabase_complete.sql:198` | The low-stock widget selects by `qty` but prints `product.stock` and `product.sku`, columns the `products` table does not have. Each row reads "undefined left" and "SKU: N/A" | Medium |
| BUG-24 | `assets/js/admin.js:805`, `:808`, `:1049` against `supabase_complete.sql:309-311` | The activity export reads `entity_type` and `details`; the table columns are `entity` and `metadata`. The entity column is blank in both the CSV and the PDF, and the CSV details column is always `{}` | Low |
| BUG-25 | `admin.html:1280`; `assets/js/admin.js:6459-6463`, `:6270-6273` | The product form is `novalidate` and the submit handler checks nothing, so a product with no name, price or category can be saved. An image that fails to upload is skipped silently and the product is reported as saved | Medium |
| BUG-26 | `assets/js/admin.js:9076`, `:9180-9198` | Compose finds recipients only in the list loaded by the Customers view; opened first from Messages it finds nobody. It then calls `send-admin-reply` with different field names from a reply (E-13), does not read the response and always reports "Message sent successfully!" | Medium |
| BUG-27 | `assets/js/admin.js:3010-3012`, `:3030-3039` | The four order counters are computed from the rows returned for the current status filter, so three of them read zero whenever a filter is applied | Low |
| BUG-28 | `admin.html:1047`, `:1057`; `admin.html:246` against `assets/js/admin.js:1889`; `admin.html:1378` against `assets/css/styles.css:7196` | Small admin wiring faults: the dashboard "View All" links have no handler; the complete-profile close button uses `data-close-profile` while the script binds `data-close-complete-profile`; a "backwards compatibility" block in the product form relies on a hiding class defined only in the storefront stylesheet, which the admin does not load, so its "Available Sizes" label is shown with nothing under it | Low |
| BUG-29 | `assets/js/admin.js:6652` against `:6579-6581`; `:6602-6604` | Analytics figures disagree: the revenue chart sums every order in the period, cancelled included, while "Total Revenue" counts delivered orders only; page views are an all-time count beside a period selector | Low |
| BUG-30 | `faq.html:438`, `:544` with `assets/css/styles.css:18286-18293`; `assets/js/faq.js:28-31` | On first load the "All" tab is selected but only the Orders group has the `active` class, so only four of 23 questions are shown. After a search, choosing a tab clears the field but leaves non-matching questions hidden | Low |
| BUG-31 | `faq.html:512` against `terms.html:518-519`; `faq.html:585`, `terms.html:545`; `faq.html:940` against `assets/js/admin.js:1433` | The published copy contradicts itself and the product: cancellation is "within 1 hour" in the FAQ and 30 minutes in the terms and the code (D-06); both pages quote a fee for "Other states" that checkout does not offer (K-04); the FAQ says reset links last 24 hours and the staff screen says one hour | Medium |
| BUG-32 | `size.html:824`; `assets/css/styles.css:19156-19162`; `assets/js/size.js:28-34` | The calculator result panel has two `class` attributes, so `u-hidden` is dropped and an empty result ("-") shows before any calculation. The inputs' `min` and `max` are not enforced, a missing value raises a browser `alert`, and the calculator can return sizes (30, 40, 42 bands; DD, E cups) that the chart does not list | Low |
| BUG-33 | `contact.html:448` against `admin.html:2511-2520`; `assets/js/admin.js:8466-8474` | The contact form sends the subject `product`, which the admin has no label or filter for; the admin offers `general`, which the form never sends | Low |

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
| STR-14 | `assets/js/admin.js:3933-4017`, `:4179-4325`, `:4493-4569`, `:5729-5789` | About 500 lines of admin script have no markup to act on (see the dead-code table in section 2); the stylesheet still carries their rules (`assets/css/admin.css:5268`) | Medium |
| STR-15 | `assets/js/admin.js:1586`, `:5479`, `:8886` | The Supabase project URL is typed into the script three times as a fallback or directly, beside the configured value | Low |
| STR-16 | `admin.html:45`; `assets/js/admin.js:126`; `admin.html:2729-2735`; `assets/js/admin.js:836-840` | The admin page reads the storefront theme key before paint and then applies a different key (BUG-14), and loads jsPDF from one CDN in the page and from another in the script | Low |

### 5.4 Performance

| # | Where | Problem | Severity |
|---|---|---|---|
| PERF-01 | `assets/css/styles.css:1` | One 612 KB unminified stylesheet for every page; 176 selectors defined more than once; Lighthouse reports 77 KiB transferred and unused on the home page | High |
| PERF-02 | `assets/js/shop.js:163-168` | The whole catalogue is fetched with `select("*")` and filtered in the browser; no pagination | Medium |
| PERF-03 | `home.html:1264-1282` | Eleven scripts on the home page, including reCAPTCHA on every page for a modal most visitors never open | Medium |
| PERF-04 | `assets/js/home.js:685` | Hero and category images are fetched from the database after load and swapped in; the hero cannot be preloaded and is the largest paint | Medium |
| PERF-05 | `assets/js/analytics.js:538` | A blocking-order geo-IP request to a third party at the start of every session | Low |
| PERF-06 | `assets/css/styles.css:2690` | 66 `backdrop-filter` declarations and 68 keyframe animations in the storefront stylesheet | Low |
| PERF-07 | `assets/js/admin.js:5565-5567`, `:6575-6577`, `:6831-6833`, `:7163-7165`, `:3005-3008` | The admin reads the whole `orders` table in the browser five separate ways (dashboard, analytics totals, top products, customer totals, orders list) and paginates and aggregates on the client; `site_visits` is read the same way for each analytics table | Medium |
| PERF-08 | `admin.html:2726-2735` | jsPDF and AutoTable are loaded on every admin page load although exports are occasional and the script already has an on-demand loader (`assets/js/admin.js:833-841`) | Low |

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
| A11Y-08 | `faq.html:447`; `faq.html:405`; `size.html:438` | FAQ questions are buttons with no `aria-expanded` or `aria-controls`; the FAQ and size-chart tabs have no tab roles or selected state. The open or selected state is conveyed by style alone | Medium |
| A11Y-09 | `admin.html:129`, `:166`, `:188`, `:330`; `assets/js/admin.js:269-270` | No admin dialog has `role="dialog"`, `aria-modal` or a label; focus is not trapped or returned, and only the invitation and complete-profile dialogs move focus inside (`assets/js/admin.js:5398`, `:1828`). Several destructive actions use the browser's `confirm` instead (`assets/js/admin.js:2506`, `:2937`, `:7392`) | High |
| A11Y-10 | `assets/css/admin.css:696`, `:2579`, `:5585`; `assets/css/styles.css:329` | The admin stylesheet removes outlines in nine places and has no `:focus-visible` rule; the storefront stylesheet has one `:focus-visible` rule against 28 outline removals. Neither admin animation set has a reduced-motion rule (16 keyframes in `admin.css`, none guarded) | Medium |
| A11Y-11 | `assets/js/admin.js:7264-7279`, `:3754`; `admin.html:10` | In the admin, the seven customer actions are icon-only buttons named only through `title`, the product selection tick is a `div` that cannot be reached by keyboard, and the page disables zoom in the same way as the storefront (A11Y-01) | Low |

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
│   │   ├── ui/                     Button, Input, Select, Dialog, Drawer, BottomSheet, StickyActionBar, Toast, Badge, Table, Skeleton, Stepper, Tabs
│   │   └── layout/                 Header, Footer, MobileNav, BottomNav, SearchOverlay
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
│   └── e2e/                        parity flows (phone and desktop projects), mobile suite, accessibility, viewport checks
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
- **Breakpoints (one set):** 480, 768, 1024, 1280, 1536. Layouts are designed first at 360, 390 and 430 (section 12.2) and checked at 360, 390, 430, 768, 1024, 1280 and 1536.
- **Rhythm:** sections are separated by 96 px on desktop and 56 px on mobile. Product imagery is 4:5, hero and category imagery 3:4, matching `IMAGE_SIZING_GUIDE.md` so existing photographs fit without re-cropping.
- **Admin:** fixed 248 px sidebar from 1024 px, drawer below; denser spacing and `body-sm` as the base.

### 7.5 Scales

- **Spacing (4/8 based):** 0, 4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96, 128.
- **Radius (one scale):** `none` 0 for photographs and full-bleed sections; `sm` 2 px for inputs, buttons and badges; `md` 4 px for cards and menus; `lg` 8 px for dialogs and drawers; `full` for avatars and the cart count. Square-edged photographs are a deliberate part of the editorial look.
- **Shadow (one scale, warm-tinted):** `none` (default; separation comes from hairlines and background steps); `sm` `0 1px 2px rgb(28 21 23 / 0.06)` for sticky header and raised menus; `md` `0 8px 24px rgb(28 21 23 / 0.10)` for popovers and toasts; `lg` `0 24px 48px rgb(28 21 23 / 0.16)` for dialogs and drawers. Cards do not lift on hover.
- **Icons:** Lucide only, 1.5 px stroke, 20 px in the interface and 16 px inline. Social marks are text links in the footer, since a single icon set is used and brand logos are not part of it.
- **Motion:** 120 ms for colour and opacity, 200 ms for drawers and dialogs, 320 ms as the maximum for a gallery cross-fade; one easing curve (`cubic-bezier(0.2, 0, 0, 1)`). Motion only confirms an action or shows where something came from. No scroll-triggered entrance animations beyond a single short fade on first paint of imagery, no counters, no parallax. `prefers-reduced-motion` removes all movement.

### 7.6 Key screens

Each screen below is designed at phone width first; the phone behaviour (bottom navigation, sticky action bars, sheets, safe areas) is specified in section 12 and takes precedence where this section describes only the desktop arrangement.

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

**Account (`/dashboard`).** Left navigation list on desktop; on mobile a one-tap section switcher, either a tab row under the header with the shop's bottom navigation kept, or the present bottom tab bar (section 12.3 and decision 11 in 9.6). Overview shows three figures in a single bordered row and the latest orders as a list. Orders are rows, not cards; a row opens a detail panel with the timeline, items and the cancel or return action when available. Settings are grouped under plain headings with switches.

**Admin (`/admin`).** Utilitarian and dense: ivory ground, white tables with hairline rows, wine reserved for the primary action in each view. Sidebar with grouped links and counts for pending orders and unread messages. Orders and customers are tables with sticky headers that become stacked rows below 768 px; detail opens in a right-hand drawer on desktop and as a full screen with a bottom action bar on phones (section 12.7). The product editor is a two-column form (details and variants on the left, images and visibility on the right) with a sticky save bar. Order detail shows the receipt beside the total with two explicit actions, "Confirm payment" and "Reject receipt".

**Emails.** White background, wordmark at the top, serif heading, body in a system sans fallback, one flat wine button, no gradients or emoji.

---

## 8. Rebuild plan

### 8.1 Phases and commits

**How the work is ordered.** Mobile is the priority (section 12), so every screen is designed and built at 360, 390 and 430 px first and widened afterwards; no phase builds a desktop layout and "makes it responsive" later. Each phase closes only when the pages it delivers pass the gates of section 13 that can already be run on them (type check, lint, tests at the phone size and the desktop size, build, the page-by-page mobile checklist in 12.9, and screenshots at every width). Nothing is called done, and no pull request is opened, until every gate in section 13 passes.

**Phase 0 — Foundations (3.5 days)**
1. `chore: scaffold Next.js 16 app with TypeScript strict, ESLint and Prettier`
2. `chore: add environment schema and .env.example (names only)`
3. `db: add baseline migration captured from the live schema`
4. `chore: generate database types and add Supabase clients`
5. `ci: add build, lint, type-check, unit and e2e workflows`
6. `ci: add phone and desktop Playwright projects, viewport screenshot run and Lighthouse mobile budgets`
7. `feat: add proxy with session refresh, security headers and CSP nonce`

Before any legacy file is touched, "before" screenshots of all sixteen current pages are captured at 360, 390, 430, 768, 1024, 1280 and 1536 px in both themes and kept for the pull request (gate (e) in section 13). This is a recorded task, not a commit.

**Phase 1 — Design system, phone first (5.5 days)**
8. `feat(ui): add design tokens and global styles`
9. `feat(ui): add fonts and type scale`
10. `feat(ui): add Button, Input, Select, Checkbox, Switch, Badge`
11. `feat(ui): add Dialog, Drawer, Toast, Tabs, Skeleton, Table, Stepper`
12. `feat(ui): add BottomSheet, StickyActionBar and safe-area layout utilities`
13. `feat(brand): add redrawn wordmark, monogram and icon set`
14. `feat(layout): add header, footer, mobile navigation drawer and theme control`
15. `feat(layout): add mobile bottom navigation`

**Phase 2 — Catalogue (9 days)**
16. `feat(catalogue): add product queries and domain types`
17. `feat(home): add opening spread, new arrivals, categories, testimonials`
18. `feat(shop): add grid, filter sheet, sort, search and URL state`
19. `feat(product): add product page with variants and stock rules`
20. `feat(product): add swipe gallery with counter and pinch-zoom viewer`
21. `feat(product): add size guide sheet and sticky add-to-bag bar`
22. `feat(product): add quick view sheet and dialog`
23. `feat(search): add search overlay with keyboard shortcut`
24. `feat(wishlist): add wishlist store and page`
25. `feat(reviews): add review list, eligibility check and submission`
26. `feat(catalogue): add realtime refresh`
27. `feat(seo): add product metadata, structured data and legacy product redirect`

**Phase 3 — Cart, checkout, orders (7 days)**
28. `feat(cart): add cart store on existing storage keys, drawer and page`
29. `db: add place_order and validate_promo functions with stock decrement`
30. `feat(cart): add promo code and delivery estimate`
31. `feat(cart): add sticky checkout bar and one-thumb quantity steppers`
32. `feat(checkout): add contact, delivery and payment steps with mobile keyboards, autofill and inline validation`
33. `feat(checkout): add private receipt upload and place-order action`
34. `feat(orders): add confirmation page`
35. `feat(orders): add tracking page with verified lookup`
36. `feat(email): add order confirmation and store notification`

**Phase 4 — Authentication and account (5 days)**
37. `feat(auth): add sign-in, sign-up, Google sign-in and callback route`
38. `feat(auth): add reset, set-password, verification and expired-link screens`
39. `feat(auth): add server-side captcha verification and account-status enforcement`
40. `feat(account): add overview and orders with cancel and return actions`
41. `feat(account): add addresses and profile`
42. `feat(account): add settings, data export, deactivation and deletion`
43. `feat(sync): add cross-device merge and realtime updates`
44. `feat(email): add customer welcome and account emails`

**Phase 5 — Content pages (3 days)**
45. `feat(contact): add contact form, message storage and email`
46. `feat(faq): add categories, accordion and search`
47. `feat(size): add measuring guide, charts and calculator`
48. `feat(legal): add privacy and terms with section navigation`
49. `feat: add not-found and error pages`

**Phase 6 — Admin, usable from a phone (15.5 days)**
50. `feat(admin): add server gate, staff sign-in and invitation sign-up`
51. `feat(admin): add shell, phone navigation, idle timeout and activity logging`
52. `feat(admin): add dashboard view`
53. `feat(admin): add inventory list, filters and bulk actions`
54. `feat(admin): add product editor with variants and image upload`
55. `feat(admin): add trash`
56. `feat(admin): add orders list, detail, status flow and payment confirmation`
57. `feat(admin): add phone order detail with receipt viewer and bottom action bar`
58. `feat(admin): add customers table, detail and account actions`
59. `feat(admin): add messages inbox, reply and compose`
60. `feat(admin): add reviews moderation`
61. `feat(admin): add site images`
62. `feat(admin): add staff management and invitations`
63. `feat(admin): add activity log`
64. `feat(admin): add analytics views`
65. `feat(admin): add CSV, JSON, TXT and PDF exports`
66. `feat(email): add staff invitation, welcome and customer reply emails`

**Phase 7 — Consent, analytics, PWA (4 days)**
67. `feat(consent): add consent dialog and enforcement`
68. `feat(analytics): add GA4 and Meta Pixel events behind consent`
69. `feat(analytics): add first-party visit recording through the server`
70. `feat(pwa): add manifests, service worker, offline page, install prompt and update flow`
71. `feat(pwa): add time-boxed admin worker retirement`

**Phase 8 — Hardening and SEO (3 days)**
72. `db: tighten row-level policies and role functions`
73. `db: make receipts private and add signed access`
74. `feat(seo): add sitemap, robots, canonical rules and Open Graph images`
75. `chore: add redirects for legacy URLs`
76. `chore: remove edge functions and order-email trigger after parity sign-off`

**Phase 9 — Quality gates and cut-over (7 days)**
77. `test: add parity e2e suite at phone and desktop sizes`
78. `test: add accessibility and viewport suites`
79. `test: add mobile suite for gestures, keyboards, safe areas and sticky bars`
80. `docs: rewrite README and add operations notes`
81. `chore: remove legacy static files`

Phase 9 then runs the gates of section 13 in order on a preview deployment: "after" screenshots at every width and in both themes, Lighthouse mobile on the listed pages, the independent review of the finished diff with every finding fixed and re-checked (fixes are ordinary `fix:` commits, each with its test), and finally the owner's approval. The pull request is opened only after gates (a) to (h) pass, and nothing is merged or deployed before gate (i).

### 8.2 Verification plan

Section 13 is the authority on what must pass and how it is checked; this table lists the checks in the order they are run.

| Area | Check | Pass condition |
|---|---|---|
| Build | `npm run build` | Exit 0, no warnings |
| Lint | `eslint . --max-warnings 0` | 0 errors, 0 warnings |
| Types | `tsc --noEmit` | 0 errors; no suppressions in the tree (searched for in CI) |
| Unit | `vitest run` | Pricing, promo, delivery fee, stock cap, merge rules, validators all pass |
| Parity | Section 2 checklist, each of the 354 items ticked against a Playwright test or a recorded manual check on a staging Supabase project | 354 of 354 |
| End-to-end | `playwright test` with the `phone` (390 × 844, touch) and `desktop` (1280 × 800) projects; the flows are listed in section 13 (b) | Every flow passes in both projects |
| Mobile checklist | Section 12.9, every entry, checked at 360, 390 and 430 px | Every entry ticked, with the test or screenshot that shows it |
| Viewports | Playwright screenshots of every route at 360, 390, 430, 768, 1024, 1280, 1536, in light and dark | No horizontal scroll, no overlap, no clipped text, nothing hidden behind a fixed bar |
| Accessibility | `@axe-core/playwright` on every route in both themes; manual keyboard and screen-reader pass through shop → product → cart → checkout and through admin orders | No WCAG 2.2 AA violations; zoom allowed; visible focus; dialogs and sheets trap and return focus |
| Lighthouse | Mobile, production build on a preview deployment, on home, shop, product, cart, checkout, track | 90 or more in all four categories, LCP under 2.5 s, CLS under 0.1, and the budgets of 12.6 met (cart, checkout and track are deliberately `noindex`, which Lighthouse counts against SEO; see gate (h) in section 13 and decision 12 in 9.6) |
| Security headers | Response check on a preview deployment | HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors`, and a CSP with nonces and no `'unsafe-inline'` script |
| Database | Policy tests as `anon`, customer, editor, super admin, owner | Each role can do exactly what section 10 specifies and nothing more |
| SEO assets | Automated check | Unique title and description per route; canonical; Open Graph and Twitter images that resolve; `sitemap.xml` with products; `robots.txt`; favicon set; both manifests valid |
| Redirects | Scripted requests for every row of the URL map in 3.5 | Expected status and target |
| Payments | Staging walk-through on a phone: place order, upload receipt from the photo library, staff confirm from a phone, stock reduced, emails sent; forced failure shows an error and keeps the cart | As described |
| Independent review | Section 13 (f) | No open finding |
| Owner approval | Section 13 (i) | Given in writing on the pull request |

### 8.3 Effort estimate

| Phase | Working days |
|---|---|
| 0 Foundations | 3.5 |
| 1 Design system, phone first | 5.5 |
| 2 Catalogue | 9 |
| 3 Cart, checkout, orders | 7 |
| 4 Authentication and account | 5 |
| 5 Content pages | 3 |
| 6 Admin, usable from a phone | 15.5 |
| 7 Consent, analytics, PWA | 4 |
| 8 Hardening and SEO | 3 |
| 9 Quality gates and cut-over | 7 |
| **Total** | **62.5** |

The estimate has been revised twice. It moved from 51.5 to 54 days after the line-by-line read of the admin and the content pages: the admin gained 51 checklist items (variant editor, per-customer visit history, compose, export contracts, staff sign-up rules) and 12 newly verified defects (BUG-19 to BUG-29, SEC-26), so Phase 6 moved from 12 to 14 days; the content pages gained 11 items and four defects, so Phase 5 moved from 2.5 to 3 days. It then moved from 54 to 62.5 days when the mobile-first work of section 12 and the gates of section 13 were made part of the phases: Phase 0 +0.5 (phone and desktop test projects, screenshot run, Lighthouse budgets), Phase 1 +1.5 (bottom sheet, sticky action bar, safe-area utilities, bottom navigation), Phase 2 +2 (swipe gallery and viewer, size-guide sheet, sticky add-to-bag bar, filter sheet), Phase 3 +1 (one-thumb cart and checkout, keyboards and inline validation), Phase 6 +1.5 (admin phone layouts, from 14 to 15.5) and Phase 9 +2 (mobile test suite, screenshots, Lighthouse runs, independent review and one round of fixes).

The estimate assumes the owner's inputs in section 9 arrive before Phase 2 and that the live schema matches what the client code implies. A second round of review fixes is not included. Card payments through Monnify are not included (about 4 further days if approved).

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
| Existing product photographs are too heavy or the wrong ratio for the image budgets in 12.6 | Budgets are enforced on the rendered sizes, not the originals; images that cannot meet them at acceptable quality are listed for the owner (9.4) before Phase 2 ends |
| Phone behaviour differs between emulation and real devices (keyboard, safe areas, the round trip to a banking app) | The Playwright phone project is the gate, and the checkout, receipt upload and admin payment confirmation are also walked through on a real Android phone and a real iPhone before the pull request (8.2) |
| Lighthouse scores vary between runs | Three runs per page with the median reported, on a preview deployment, with the version recorded (section 13, gate (h)) |

---

## 9. Needed from the owner

### 9.1 Access and source material

1. A schema-only dump of the live Supabase database (tables, policies, functions, triggers, storage buckets and policies), or permission to run `supabase db pull` against it.
2. The source of the edge functions `send-contact-email`, `send-admin-reply`, `send-user-welcome` and `send-order-email`, and the SQL of the order-email trigger.
3. A staging Supabase project (or approval to create one) for rehearsal.
4. Confirmation of the Supabase plan, specifically whether image transformation is enabled.
5. An export of device brand, model and viewport width from the `site_visits` table (N-03), or read access to it, so that the phone widths in section 12.2 can be checked against real visitors.
6. The phones the owner and staff use to manage the shop (make and model), so the admin is tested on them, and the name of the person who will give the final approval on the pull request (gate (i), section 13).

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
- Approval for a maskable app icon to be drawn from the monogram with the required safe zone (the manifests reuse the ordinary 192 px icon today: `site.webmanifest:26-31`).

### 9.5 Copy and content

- The brand name: "Lingerie by Sisioyin" or "Lingeries by Sisioyin" (both are in use).
- Home headline and one supporting sentence in the owner's own voice; a one-line description of the brand for the footer.
- Evidence for, or removal of, the "500+ happy customers" figure and the "24/7 support" claim; actual WhatsApp response hours.
- The delivery states and fees to be shown, and whether delivery outside the seven listed states is offered (the home page says "Nationwide shipping", the checkout offers seven states).
- The returns policy in two sentences for product pages and checkout.
- Bank details to display at checkout, held in one place.
- Whether checkout must accept phone numbers from outside Nigeria (section 12.5 validates Nigerian numbers unless told otherwise).
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
11. **Mobile navigation in the account.** A shop-wide bottom navigation (Shop, Search, Wishlist, Bag, Account) with the five account sections as a tab row under the header (recommended), or the present account-only bottom bar with the shop navigation hidden on `/dashboard` (section 12.3).
12. **Lighthouse SEO on `noindex` pages.** `/cart`, `/checkout` and `/track` are deliberately `noindex`, which Lighthouse counts against the SEO category. Accept 90 or more in the other three categories for those pages (recommended), or make them indexable (section 13, gate (h)).
13. **Units in the size guide.** Inches are shown today for bras and panties only. Keep that (recommended for launch), or also offer inches for loungewear, bodysuits and the calculator, converted from the centimetre figures (section 12.7).

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

**Mobile and gates**
- Mobile first: every screen is designed and built at 360, 390 and 430 px before any wider layout, to the rules of section 12 (44 px targets, 16 px text and controls, safe-area insets, correct keyboards and autofill, the budgets of 12.6). A screen that is right on desktop and wrong on a phone is not done.
- Nothing is called done until every gate in section 13 passes; no check is silenced, skipped or loosened to get there.
- Instead: a design system for the project (colour tokens, a type scale, a 4/8-based spacing scale, one radius scale, one shadow scale); a restrained palette (one primary, at most one accent, a well-built neutral scale); a deliberate font pairing; a strong grid and generous white space; one icon set; real images through `next/image` with correct `sizes` and alt text.

---

## 12. Mobile first (the priority)

Most customers of this shop arrive on a phone, from Instagram, TikTok or a WhatsApp link (`assets/js/config.js:25-29`), and the owner is likely to manage orders from a phone as well. The phone is therefore the primary design target for every page, the storefront and the admin alike; tablet and desktop layouts are derived from it. This section records what the code does on a phone today, what the rebuild will do instead, and a checklist for every page. It is part of the build order (section 8.1) and of the gates (section 13), not an addition after the fact.

### 12.1 Present mobile state (evidence)

Read from the code; nothing in this table was measured on a device.

| Area | What the code does today | Evidence | What must change |
|---|---|---|---|
| Viewport | Every one of the sixteen pages sets `maximum-scale=1, user-scalable=no`, with `interactive-widget=resizes-content` and `viewport-fit=cover` | `home.html:9-10`, `checkout.html:9-10`, `admin.html:9-10` (identical on all pages) | Allow zoom (A11Y-01). Keep `viewport-fit=cover` and `interactive-widget=resizes-content` |
| Breakpoints | Written desktop-first: base rules, then `max-width` overrides. 40 distinct media queries in the storefront stylesheet; the most used are `max-width: 480px` (59 blocks), `768px` (49), `640px` (34), `380px` (27) and `360px` (21). The admin stylesheet has 18 distinct queries | `assets/css/styles.css` and `assets/css/admin.css` (counted with a pattern search) | One mobile-first set (7.4): base styles are the 360 px layout; `min-width` queries only |
| Horizontal scroll | Overflow is hidden rather than prevented: `overflow-x: hidden` on `html` and `body`, further `!important` overrides in the phone blocks, and a script that resets the horizontal scroll position after each checkout step | `assets/css/styles.css:255`, `:265`, `:26861`, `:27007`, `:27162`; `assets/js/checkout.js:193-197` | No element may be wider than the viewport; no `overflow-x: hidden` on the root as a mask |
| Header | Fixed, 72 px high, with the top safe-area inset applied as padding inside that fixed height, so the inset eats into the bar on notched phones. A 64 px mobile height token is defined and never used | `assets/css/styles.css:1460-1466`, `:234-235` | Header height grows by the inset; 56 px on phones |
| Header actions on a phone | Below 768 px the search and account buttons are hidden; only the bag and the menu remain. The search overlay opens only from that hidden button or from Ctrl/Cmd+K, and the mobile drawer has no search entry, so product search (G-06) cannot be reached on a phone outside the shop page's own search box | `assets/css/styles.css:1578-1589`; `assets/js/app.js:1939-1941`, `:1963-1970`; `home.html:329-480` | Search, wishlist, bag and account one tap away in the bottom navigation (12.3) |
| Safe-area insets | Used in five places only: header, drawer header, dashboard bottom bar, dashboard content padding, and the WhatsApp button on the dashboard. Not applied to the toast, the WhatsApp button elsewhere, the install banner or the cart drawer; not used anywhere in the admin stylesheet | `assets/css/styles.css:1466`, `:12532`, `:13196`, `:16083`, `:16119`; toast `:1411-1413`; WhatsApp `:12913-12916`; install banner `:11958-11966` | Every fixed or sticky element uses the insets (12.5) |
| Fixed and sticky elements | 37 `position: fixed` or `sticky` declarations in the storefront stylesheet and 11 in the admin. Z-indices are set outside the token scale (`9999 !important`, `10000 !important`, `99999`) | `assets/css/styles.css:1675`, `:4889`, `:6080`, `:11963`, `:19783` | One layering scale; an inventory of fixed elements per page (12.5) |
| Viewport units | `100vh` is used 18 times in the storefront stylesheet and `100dvh` twice; the quick view is capped at `90vh`, which is taller than the visible area when the browser bars are showing | `assets/css/styles.css:264`, `:4905`, `:9442`, `:6078-6079` | `dvh`/`svh` units for full-height sheets and drawers |
| Tap targets below 44 px | Wishlist heart on cards 34 px; quick-view close 32 px on phones; cart-drawer steppers 28 px (24 px below 480 px, 36 px on touch devices); cart-page steppers 36 px; cart edit and remove 32 px; checkout edit button, copy-account button and receipt remove 28 px; sign-in close 34 px; dashboard bottom-bar labels at 0.62 rem with 0.3 rem padding | `assets/css/styles.css:4476-4481`, `:2986-2992`, `:9449-9454`, `:6300-6302`, `:9588-9591`, `:9785-9788`, `:6773-6775`, `:6829-6834`, `:12173-12175`, `:11826-11828`, `:10614-10619`, `:10718-10720`, `:8628-8638`, `:16087-16098` | 44 px minimum everywhere, 48 px for primary actions (12.3) |
| Tap targets that are adequate | Header buttons 48 px; size buttons raised to 44 px and quantity buttons to 44 px on touch devices; lightbox close 44 px and arrows 48 px | `assets/css/styles.css:1591-1594`, `:9768-9783`, `:6542-6547`, `:6578-6583` | Keep the sizes |
| Text size | The base is 16 px, but a pattern search finds 1,165 font-size declarations below 16 px in the storefront stylesheet. Examples on phones: buttons 14 px, card names 13 px, track input 14 px, sign-in inputs 0.9 rem, dashboard selects 0.82 rem, size tables 11 px. Inputs below 16 px make iOS Safari zoom on focus, which the disabled zoom currently hides | `assets/css/styles.css:151`, `:616`, `:9361-9362`, `:20276`, `:8792`, `:16901`, `:20405-20408` | 16 px body and 16 px form controls (12.4) |
| Product gallery | Previous and next arrows, thumbnails, and a full-screen viewer opened by double-click or double-tap. There are no touch handlers on the gallery, so it cannot be swiped; swipe exists only in the admin image viewer. The viewer has arrows, a counter and a download button, and no pinch-zoom | `assets/js/shop.js:995-1015`, `:1376-1446`, `:1940-1962`; `assets/js/admin.js:1201` | Swipe, counter and pinch-zoom (12.7) |
| Gallery images | The main quick-view image is cropped to a square on phones although product photographs are 4:5; it is loaded from the original URL at full size, while cards request a 400 px rendition. Thumbnails have no `alt`. No `<img>` in any page or script carries `width` and `height`. A `srcset` helper exists and is never called | `assets/css/styles.css:5017-5019`, `:9468-9470`; `assets/js/shop.js:588`, `:595`, `:202-203`, `:222`; `assets/js/utils.js:468-492` | 4:5 frames, responsive sources, reserved space (12.6, 12.7) |
| Quick view on a phone | Below 480 px it is a bottom sheet with its own inner scroll. "Add to Cart" sits inside the scrolling area after description, size, colour and quantity, and a chevron "scroll hint" is added to tell the customer there is more below | `assets/css/styles.css:9440-9460`, `:5630-5634`; `assets/js/shop.js:663-677`, `:965-984` | Sticky add-to-bag bar (12.7) |
| Home cards | On touch devices the first tap on a new-arrival card reveals its buttons and a second tap acts | `assets/js/home.js:535-561` | One tap opens the product |
| Size guide from a product | A plain link to `/size`, which leaves the product and discards the chosen size, colour and quantity | `assets/js/shop.js:619` | Bottom sheet over the product (12.7) |
| Size tables | Four charts of five columns each. Bras and panties give centimetres and inches side by side as separate columns; loungewear and bodysuits are in centimetres only; the calculator takes centimetres only. There is no unit switch. Below 640 px the tables are given a 480 px minimum width, 11 px text and horizontal scrolling. The calculator inputs are `type="number"` without `inputmode`, are read with `parseInt`, and report errors with `alert()` (BUG-32) | `size.html:463-469`, `:545-551`, `:615-617`, `:683-686`, `:796-813`; `assets/css/styles.css:20395-20410`; `assets/js/size.js:28-33` | Tables that fit 360 px (12.7) |
| Checkout fields | `type` and `autocomplete` are largely correct already: `given-name`, `family-name`, `email` (`type="email"`), `tel` (`type="tel"`), `street-address`, `address-level2`, `address-level1`; landmark and notes are `off`. No field anywhere in the product has `inputmode` or `enterkeyhint` | `checkout.html:571-613`, `:659-717` | Complete the attributes (12.5) |
| Checkout validation | Checks only that required fields are not empty; marks the border red and shows one generic toast. No format check on email or phone | `assets/js/checkout.js:205-231` | Inline messages per field (12.5) |
| Checkout primary action | "Place Order" is the last element of the order-summary panel, below the three steps; it is not fixed. Step edit buttons are 28 px | `checkout.html:956-962`; `assets/css/styles.css:11444-11451`, `:11826-11828` | Bottom-anchored action bar (12.3) |
| Receipt upload | A hidden file input inside a label, accepting `image/*,.pdf`; no `capture` attribute, so the phone offers the photo library and files | `checkout.html:876-881` | Keep this behaviour; enlarge the target |
| Account forms | Profile and address fields carry `autocomplete`; the date-of-birth field uses `autocomplete="birthday"`, which is not a valid token (the token is `bday`); the address form takes the state as free text although checkout uses a list | `dashboard.html:575-621`; `assets/js/dashboard.js:548-574` | Correct tokens; one state list |
| Keyboard handling | Focused fields are scrolled to the centre after 350 ms on user agents that look mobile; the sign-in modal is repositioned from `visualViewport` | `assets/js/app.js:3007-3021`; `assets/js/auth.js:176-195` | Layout that does not need scripting (12.5) |
| Dashboard | A five-item bottom bar (Home, Profile, Orders, Address, Settings) below 768 px, with the bottom inset | `dashboard.html:1036-1052`; `assets/css/styles.css:16072-16121` | See 12.3 and decision 11 in 9.6 |
| WhatsApp button | Fixed 24 px from the bottom-right corner, 60 px (52 px below 480 px), shown after a delay; moved above the bottom bar only on the dashboard | `assets/css/styles.css:12913-12935`, `:13186-13199` | Positioned from the insets and above any bottom bar |
| Themes | Light, dark and system exist in both the storefront and the admin (344 and 76 dark-theme selectors). `theme-color` is the brand pink on every page; the manifest uses `#0b0b0f` | `assets/css/styles.css:7481`; `home.html:18`; `site.webmanifest:9-10` | Both themes kept and checked on every page (12.8) |
| Fonts and icons | A render-blocking Google Fonts stylesheet requesting nine weights (Inter 300–700, Cormorant Garamond 400–700) and the whole Font Awesome stylesheet from a CDN | `home.html:61-71` | Self-hosted subset fonts; one tree-shaken icon set (12.6) |
| Admin on a phone | Same viewport restrictions. The sidebar becomes a drawer below 992 px; tables become stacked rows below 768 px; buttons, navigation items and pagination get a 44 px minimum on touch devices, but product-card buttons stay at 40 px and toggles at 40 px. The messages view switches to list-then-detail at 900 px and below (MM-06). Scrollbars are hidden on phones. Price and quantity fields are `type="number"` without `inputmode`. The bulk-actions bar is styled as fixed 24 px from the bottom with no inset, and is in any case never displayed (BUG-19). No safe-area inset is used anywhere in the admin stylesheet. The receipt opens as a link in a new tab. The customers table is not paginated (MC-08) | `assets/css/admin.css:4081-4098`, `:4347-4364`, `:5171-5196`, `:179-186`, `:958-960`; `admin.html:1300`, `:1351`, `:1454`; `assets/js/admin.js:3248` | Admin phone layouts (12.7) |
| Service worker | Pre-caches fourteen page URLs and four icons; navigations are network-first with the cached page or `/home` as the fallback; CSS and JavaScript are deliberately never cached, so a page served offline arrives without its stylesheet or scripts. Images are served stale-while-revalidate; an offline image request gets a transparent 1 × 1 GIF | `sw.js:13-33`, `:110-126`, `:129-138`, `:140-187` | A styled offline page and cached static assets (12.8) |
| Manifests and install | Both manifests declare `"scope": "/"`, while the admin worker is registered with the `/admin` scope. The same 192 px icon is declared as the maskable icon. The install banner is fixed to the bottom at z-index 99999 with no inset and appears three seconds after the browser offers installation (five seconds on iOS). Push handlers exist in the worker; nothing in the scripts subscribes to push | `site.webmanifest:6-7`, `:26-31`; `admin.webmanifest:6-7`; `assets/js/app.js:2203-2219`, `:2330-2335`; `assets/css/styles.css:11958-11975`; `sw.js:193-214` | 12.8 |

Lighthouse on the present static shell is in section 4.1; it already reports `meta-viewport` (zoom disabled) as a failure.

### 12.2 Layouts designed at 360, 390 and 430 px first

- Every screen is drawn and built at **360 px** (the narrowest phone still common on Android), **390 px** and **430 px** before any wider layout exists. The 360 px layout is the base stylesheet; wider layouts are added with `min-width` queries at the breakpoints of 7.4 (480, 768, 1024, 1280, 1536).
- Side gutter 16 px at all three widths. Content never depends on a particular width between 360 and 430: tiles and fields are fluid, and nothing is positioned with fixed pixel offsets from both sides.
- The acceptance check at each of the three widths is the same: no horizontal scroll, no text clipped or truncated where it carries meaning (product names may wrap to two lines; prices never wrap or truncate), the primary action visible without scrolling on arrival where 12.3 says so, and nothing under a fixed bar.
- A product name of 60 characters, a price of `₦1,250,000`, a seven-size product, a ten-colour product, a bag of twelve lines and an account with no orders are used as the test content, so the layouts are proved against awkward data and not only the tidy case.
- The first-party visit records already store device brand, model, screen and viewport size (N-03); the owner is asked in 9.1 for that breakdown so the three widths can be confirmed against real visitors before Phase 1 ends.

### 12.3 Thumb reach, primary actions and tap targets

**Bottom navigation (storefront, below 768 px).** Five destinations: Shop, Search, Wishlist, Bag (with the live count, G-03) and Account (initials when signed in, G-02). It suits this product because the present header hides search and account on phones (12.1), the wishlist is two taps deep in the drawer, and the dashboard already uses a bottom bar. The bar is 56 px high plus the bottom inset, labels are 12 px under 24 px icons, and each item is at least 64 px wide. The header keeps the wordmark, the menu button (categories, support and legal links, theme) and nothing else on phones. The bottom navigation is not shown on `/checkout` (a focused flow with its own action bar) or in the admin.

**Account sections.** The dashboard's five sections become a horizontally scrolling tab row directly under the header, so that the global bottom navigation stays in place with Account highlighted. This keeps what D-02 provides (one tap between the five sections on a phone) in a different position; because it changes where an existing control sits, it is held for the owner as decision 11 in 9.6. If the owner prefers the present arrangement, the dashboard keeps its own bottom bar and the global one is hidden there.

**Primary action per page, in the thumb zone.**

| Page | Primary action on a phone | Placement |
|---|---|---|
| Product page and quick view | Add to bag | Sticky bar at the bottom: price, chosen size and colour in one line, and a 48 px full-width button. Until a size is chosen the button reads "Select a size" and opens the size picker. The bar replaces the bottom navigation on the product page |
| Shop | Filter and sort | A two-button bar (Filter with the active count, Sort) pinned under the header while scrolling up, opening bottom sheets; "Show N items" at the bottom of the filter sheet |
| Cart | Checkout | Sticky bar above the bottom navigation: total and a 48 px "Checkout" button |
| Checkout | Continue, then Place order | One bottom-anchored bar whose label follows the step ("Continue to delivery", "Continue to payment", "Place order — ₦…"). The order total is always in the bar |
| Confirmation | Track this order | Full-width button under the order number; WhatsApp as the secondary action |
| Track | Track order | Button directly under the two fields |
| Wishlist | Add to bag on each tile | 44 px button under each tile |
| Contact, size calculator, sign-in, profile, address | Submit | Full-width 48 px button at the end of the form, never under the keyboard |
| Admin order detail | Confirm payment / next status | Bottom action bar (12.7) |

**Tap targets.** Every interactive element is at least 44 × 44 px, with at least 8 px between adjacent targets; primary buttons are 48 px high. Where the visible control is smaller by design (the wishlist heart on a tile, a remove icon, a copy icon, a close button), the hit area is extended to 44 px. This applies in particular to the elements listed as too small in 12.1. Destructive actions (remove from bag, clear bag, cancel order, delete address) are never adjacent to the primary action.

### 12.4 Type, line length and no horizontal scroll

- Body text is 16 px (`body`, 7.3) on phones; nothing a customer must read to buy is below 14 px (`body-sm`: secondary lines, table cells), and 12 px (`caption`) is reserved for timestamps and meta. The present 11 px table text, 0.62 rem tab labels and 13 px product names go.
- **All form controls are 16 px or larger**, so iOS Safari does not zoom on focus and zoom no longer has to be disabled. Pinch-zoom is allowed on every page (`user-scalable=no` and `maximum-scale=1` are removed).
- Line length: at 360–430 px with 16 px gutters, body copy runs to roughly 40–50 characters; long-form pages (FAQ answers, privacy, terms) keep the 680 px reading width of 7.4 on larger screens. No justified text.
- Headings use the mobile sizes already set in 7.3 (for example `display-xl` 40/44 below 768 px) and may wrap; no heading is scaled with viewport units alone.
- Prices use tabular figures and `white-space: nowrap`.
- The customer text-size preference (G-18) scales the root size; the layouts are checked at the large setting at 360 px.
- No horizontal page scroll at any width from 360 px upwards. The only horizontally scrolling regions are deliberate ones with visible affordance: the new-arrivals row, the gallery, the account tab row and filter chips. A Playwright assertion (`document.documentElement.scrollWidth <= clientWidth`) runs on every route at 360, 390 and 430 px.

### 12.5 Sticky bars, safe areas and forms

**Fixed and sticky elements.** One inventory, one layering scale, and insets everywhere.

| Element | Position on a phone | Rule |
|---|---|---|
| Header | Sticky top, 56 px plus `env(safe-area-inset-top)` | Content starts below it; in-page anchors use `scroll-margin-top` equal to the header height |
| Bottom navigation | Fixed bottom, 56 px plus `env(safe-area-inset-bottom)` | The page reserves the same height as bottom padding, so the footer and last line are never covered |
| Sticky action bars (add to bag, checkout, place order, admin actions) | Fixed bottom, above or instead of the bottom navigation, with the bottom inset | Hidden while the on-screen keyboard is open, so they never cover the field being typed in |
| Shop filter and sort bar | Sticky under the header | Appears on scroll up, leaves on scroll down |
| WhatsApp button (G-10) | 48 px, bottom right, offset by the height of whatever bar is present plus 16 px plus the inset | Never overlaps a bar, a toast or the last tile's button |
| Toasts (G-12) | Above the bottom bars, inside the insets | Announced through a live region (A11Y-05) |
| Consent dialog (G-11), install prompt (Q-05) | Bottom sheet inside the insets | Never shown over an open sheet or the checkout action bar |
| Sheets and drawers (bag, filters, size guide, quick view, sign-in) | `100dvh` maximum, their own scroll, bottom inset on the last control | Background inert; focus trapped and returned; closed by the close button, the backdrop, Escape and a downward drag |

Left and right insets are applied to the page gutters for landscape use. The `theme-color` meta follows the theme (12.8).

**Forms.** Every field has a visible label above it (no placeholder-only labels), a 16 px control at least 48 px high, the attributes below, and validation that runs when the field loses focus and again on submit. An error appears as text directly under the field, tied to it with `aria-describedby`, and the first invalid field receives focus; errors are never shown by colour alone (A11Y-04). The same zod schema validates on the server. Checkout and contact values continue to survive a reload (G-16). `enterkeyhint="next"` is set on every field but the last of a form, which takes `done` or `send`.

*Checkout (`/checkout`), K-02 and K-04:*

| Field | `type` | `inputmode` | `autocomplete` | Other attributes and validation |
|---|---|---|---|---|
| First name | `text` | — | `given-name` | `autocapitalize="words"`; required |
| Last name | `text` | — | `family-name` | `autocapitalize="words"`; required |
| Email | `email` | `email` | `email` | `autocapitalize="none"`, `spellcheck="false"`; required, valid address |
| Phone | `tel` | `tel` | `tel` | Required; accepts `0XXXXXXXXXX` or `+234XXXXXXXXXX`, stored in international form (see 9.5 for numbers outside Nigeria) |
| Saved address (K-05) | `select` | — | `off` | Fills the fields below |
| Address | `text` | — | `shipping address-line1` | Required. (`street-address`, used today, is meant for a multi-line control) |
| City | `text` | — | `shipping address-level2` | `autocapitalize="words"`; required |
| State | `select` | — | `shipping address-level1` | Options from the delivery-fee table (SC-05), not typed twice (STR-09); the total updates on change (K-07) |
| Landmark | `text` | — | `off` | Optional |
| Order notes | `textarea` | — | `off` | Optional; 500-character limit shown |
| Payment method (K-08) | `radio` | — | — | Each option a 56 px row; "Pay with card" shown as unavailable |
| Receipt (K-10) | `file` | — | — | `accept="image/*,application/pdf"`, no `capture`, so the customer can pick the screenshot their banking app has just saved or take a photograph; 5 MB limit explained before selection and enforced on the server |
| "I have sent the payment" (K-11) | `checkbox` | — | — | 44 px row; replaces the present two-second timer |

*Cart (`/cart`):* promo code — `type="text"`, `autocomplete="off"`, `autocapitalize="characters"`, `spellcheck="false"`, `enterkeyhint="done"`; delivery state — `select` from the same fee table.

*Sign-in, sign-up and password forms (A-01 to A-07, M-01 to M-04):* sign-in email — `type="email"`, `inputmode="email"`, `autocomplete="username"`; sign-in password — `autocomplete="current-password"`; sign-up first and last name — `given-name`, `family-name`; sign-up email — `autocomplete="email"`; new password and confirmation — `autocomplete="new-password"`; the show/hide toggle (A-15) is a 44 px button. The password rules (A-03) are listed under the field and tick off as they are met.

*Account (`/dashboard`):* profile first name `given-name`; last name `family-name`; email `type="email"`, read-only; phone `type="tel"`, `inputmode="tel"`, `autocomplete="tel"`; date of birth `type="date"`, `autocomplete="bday"`; gender `select`, `autocomplete="sex"`; WhatsApp number (D-12) `type="tel"`, `inputmode="tel"`, `autocomplete="tel"`. Address form: label `text`, `autocomplete="off"`; street `address-line1`; city `address-level2`; state `select` with `address-level1` and the same list as checkout; phone `tel`.

*Contact (`/contact`), P-01:* name `autocomplete="name"`; email `type="email"`, `inputmode="email"`, `autocomplete="email"`; phone `type="tel"`, `inputmode="tel"`, `autocomplete="tel"`; subject `select`; order number `type="text"`, `autocapitalize="characters"`, `autocomplete="off"`, with the real format `LBS-DDMMYYYY-NNNN` as the hint (the present placeholder shows a format the shop does not issue: `contact.html:459-465`); message `textarea`, `enterkeyhint="send"` on the form's last control.

*Track (`/track`):* order number `type="text"`, `autocapitalize="characters"`, `spellcheck="false"`, `autocomplete="off"`; email `type="email"`, `inputmode="email"`, `autocomplete="email"` (or phone, per decision 2 in 9.6).

*Search (overlay, shop, FAQ, admin lists):* `type="search"`, `inputmode="search"`, `enterkeyhint="search"`, `autocomplete="off"`, with a 44 px clear button.

*Numbers:* quantity inputs `type="text"`, `inputmode="numeric"`, `pattern="[0-9]*"`; price filter (S-04) the same; size calculator (P-08) `inputmode="decimal"` with the unit shown in the label, and its result shown in the page instead of an alert; admin price and stock fields `inputmode="numeric"`.

*Reviews (S-24, G-20):* name `autocomplete="name"`, email `type="email"`, title and comment with `autocapitalize="sentences"`; star rating as five 44 px radio buttons.

### 12.6 Performance on a mid-range Android over mobile data

**Targets.** Measured with Lighthouse in its default mobile configuration (emulated mid-range Android, throttled mobile network) against a production build on a Vercel preview, three runs per page, median taken:

- Performance, Accessibility, Best Practices and SEO each 90 or more (gate (h), section 13);
- Largest Contentful Paint under 2.5 s; Cumulative Layout Shift under 0.1; Total Blocking Time under 200 ms;
- Interaction to Next Paint under 200 ms. Lighthouse does not report INP in a page-load run, so it is checked separately: the Playwright phone project replays the key interactions (open the filter sheet, choose a size, add to bag, change a quantity, move between checkout steps) under 4× CPU throttling and asserts that the longest interaction, read from the browser's Event Timing entries, is under 200 ms.

None of these figures has been measured for the rebuild; they are targets. The present figures for the static shell are in 4.1.

**Budgets (compressed transfer size unless stated).**

| Item | Budget |
|---|---|
| JavaScript on first load, storefront routes | 180 KB per route |
| JavaScript on first load, admin routes | 300 KB; jsPDF and AutoTable load only when an export is requested and are not part of this figure |
| CSS | 40 KB in total (the present stylesheet is 612 KB uncompressed, PERF-01) |
| Fonts | Two families, at most six WOFF2 files, Latin subset, 150 KB in total; only the body regular weight and the display weight used above the fold are preloaded; `font-display: swap` with size-adjusted fallbacks so the swap does not move the layout |
| Hero image (LCP on home) | 160 KB at phone widths, AVIF or WebP, preloaded with `fetchpriority="high"`; its URL is rendered on the server, not swapped in after load (PERF-04) |
| Product tile image | 35 KB each at phone widths (two columns: `sizes="(max-width: 767px) 50vw, (max-width: 1279px) 33vw, 25vw"`) |
| Product gallery image | 140 KB at phone widths (`sizes="100vw"` below 768 px); the first is eager, the rest lazy |
| Total transfer before scrolling, home and shop | 900 KB |
| Total transfer before scrolling, other pages | 700 KB |
| Third-party scripts before interaction | None. reCAPTCHA loads when the sign-in sheet opens; GA4 and Meta Pixel load only after consent (SEC-21); no geo-IP request from the browser (PERF-05) |
| Requests to render the first screen | 25 or fewer |

**How the budgets are met.** Server-rendered pages with the product data in the HTML; `next/image` with explicit `width` and `height` (or a fixed aspect-ratio frame) on every image so nothing shifts; the catalogue paginated on the server instead of fetched whole (PERF-02); below-the-fold images lazy; sheets and the admin exports loaded on demand; no `backdrop-filter` layers (PERF-06); hashed static assets cached for a year instead of the present `no-store` and `no-cache` headers (STR-07). The budgets are enforced in CI by the Lighthouse budget file added in commit 6 and by a bundle-size check on the build output.

### 12.7 Touch patterns for this shop

**Product gallery.** A horizontally scrolling strip with CSS scroll-snap (one image per snap, full width, 4:5 frame, edge to edge), so swiping is native and needs no gesture library. A counter ("2 / 5") sits in the bottom corner of the frame and dots are not used above five images. The first image is eager and prioritised; the others are lazy. Every image has reserved space from its aspect ratio, so the gallery never shifts the page. Tapping an image opens the full-screen viewer: swipe between images, pinch to zoom and double-tap to zoom to 2×, pan while zoomed, a 44 px close button inside the top inset, and the counter. Zoom in the viewer is handled with `touch-action` and pointer events; page-level pinch-zoom also remains available everywhere. The "download image" button of the present viewer is kept for parity inside the viewer's menu. On desktop the same component shows thumbnails in a column (7.6).

**Variant and size selection.** Size buttons are at least 48 × 48 px in a wrapping row with 8 px gaps; an unavailable size stays visible, struck through, and is announced as unavailable (S-14). Colour swatches are 44 px with the chosen colour's name written beside the label (S-15); "Assorted" is text, not a swatch. The quantity stepper has 44 px buttons and a numeric field capped by the stock rules (S-16); at the cap the plus button is disabled and the reason is shown ("Only 2 left in this size"). Choosing a variant never scrolls the page.

**Size guide without losing one's place.** "Size guide" beside the size label opens a bottom sheet over the product (and over the quick view) with the chart for that product's category selected, the how-to-measure notes, and the bra calculator; closing it returns to the product with the chosen size, colour and quantity intact. The `/size` page remains (R-12, P-06 to P-08) and shares the same components. Tables are built to fit 360 px without sideways scrolling: the size column is fixed at the left, measurements are ranges in 14 px tabular figures, and every chart keeps all of its data (P-16). The product has no unit switch today: the bra and panty charts print centimetres and inches as adjacent columns, the loungewear and bodysuit charts are in centimetres only, and the calculator takes centimetres (`size.html:463-469`, `:545-551`, `:615-617`, `:683-686`, `:796-806`). Two columns per measurement is what forces the present tables to 480 px. At phone widths each chart therefore shows one unit at a time behind a two-option control (cm / in) placed above the table, with centimetres first; from 768 px both units appear side by side as now. For the two charts that carry inches today the control only changes how existing data is shown. Whether inches should also be offered for loungewear, bodysuits and the calculator (converted from the centimetre figures) is the owner's decision 13 in 9.6; until it is made, those stay in centimetres and show no control.

**Quick view.** On phones a bottom sheet at up to `100dvh` with the same gallery, selectors and sticky add-to-bag bar as the product page, and the product name linking to the full page. One tap on a tile opens the product page; the quick-view and quick-add buttons (H-04, S-19) are visible on the tile without a first "reveal" tap.

**One-thumb bag and checkout.**
- Adding to the bag confirms in place (the button shows "Added", the count in the bottom navigation updates, and a toast offers "View bag"); the drawer opens as a bottom sheet rather than a 280 px side panel (`assets/css/styles.css:6072-6077`).
- Bag lines: image, name, size and colour, a 44 px stepper, line total, and "Edit" and "Remove" as text buttons with 44 px targets. Removing shows an undo toast for five seconds instead of a confirmation dialog.
- The sticky checkout bar shows the total and "Checkout"; the promo field and the delivery estimate sit above it in the summary.
- Checkout is one column. The order summary is a collapsed row at the top showing the item count and total, expanding in place. Each completed step collapses to a one-line summary with an "Edit" button of 44 px.
- **Payment hand-off, as the code implements it today and as it stays:** there is no redirect to a payment gateway. The customer transfers the total from their own banking app to the shop's account at Moniepoint MFB and uploads the receipt (`checkout.html:808-929`). On a phone this means leaving the browser and coming back, so the payment step is built for that round trip: the account number and the exact amount each have a 44 px copy button with a "Copied" confirmation; the account name is shown in full; the step states plainly that the page can be left and will be as it was on return (the form state already persists, G-16, and the bag is stored on the device, C-01); the receipt control opens the photo library or files; the selected file is shown with its name and a thumbnail; and "Place order" stays disabled, with the reason beside it, until the receipt is attached and the confirmation is ticked. "Pay with card" remains listed as unavailable (K-08). Payment is confirmed by a member of staff, and the page says so.
- If placing the order fails, the bag is kept, the error is shown above the action bar, and nothing redirects (BUG-01).

**Confirmation and tracking.** The confirmation shows the order number in large tabular figures with a copy button, what happens next in three sentences, "Track this order" as the primary button and "Message us on WhatsApp" (pre-filled with the order number) as the secondary one. Tracking is a vertical timeline with real timestamps (SC-04), the current step first on a phone, and the lookup fields pre-filled from the link (T-05).

**Account.** Orders are rows that open a full-screen detail on phones; "Cancel order" shows the remaining time (D-06) and sits away from "Track"; a return request opens WhatsApp or the contact form with the order number filled in (D-07). Switches are 44 px rows whose whole width is the target.

**Admin on a phone.** The owner must be able to run the day from a phone, so the four frequent jobs are designed there first: confirming a payment, moving an order on, answering a message and correcting stock.
- Navigation: a top bar with the view title, and a bottom bar with Orders, Inventory, Messages, Dashboard and More (the remaining views in a sheet, filtered by role). The pending-order and unread-message counts (MD-04) sit on the bottom bar.
- Orders: a list of rows (order number, customer, item count, total, status badge, time), newest first, ten per page as today (MO-06), with the status filter as chips (MO-07); pull to refresh in addition to the refresh button (MO-02). Order detail is a full screen: status and timeline, items, totals, the delivery address, the customer's phone number as a `tel:` link and a WhatsApp link, and the receipt shown in the page through a signed URL (SC-14), opening in the same pinch-zoom viewer as the storefront. A bottom action bar carries the one valid next step: "Confirm payment" first (the step that is missing today, BUG-22, and that 7.6 adds), then "Process order", "Ship order" and "Mark delivered" (MO-04). "Reject receipt" and "Cancel" (offered while an order is pending or processing, MO-08) sit in an overflow menu behind a confirmation.
- Inventory and product editor: a single-column form; price and stock with numeric keyboards; images added from the camera or the photo library, several at once, compressed on the device as today (MI-07, MI-17), each with a 44 px remove control (images cannot be reordered today, and reordering is not added without the owner asking); the variant entry row (MI-13) as stacked fields with the quick-size buttons at 44 px, and the variant list (MI-14) as one row per variant with a 44 px stepper; required-field errors shown under the fields (MI-19, BUG-25); a sticky "Save" bar above the inset. Bulk selection uses a bar inside the inset that is actually shown (BUG-19).
- Messages: list, then detail with the reply box fixed above the keyboard (MM-06); status chips and the category list in a filter sheet (MM-07); compose as a full screen with the recipient search and sender address as 48 px rows (MM-10, MM-11).
- Customers, reviews, staff, activity, trash: stacked rows with a label before each value, as the present card layout does (M-29), and the row's actions in a sheet with text labels instead of seven icon-only buttons (A11Y-11). The customer list is paginated on the server (PERF-07). The customer detail, including the visit history table (MC-11), is a full screen whose visit rows stack. Analytics: indicators in a two-column grid, charts at full width with values readable at 360 px; tables of devices and locations as ranked lists. The export menu (MA-14) and "refresh all" (M-24) move into the More sheet on phones; exports (MA-08, MA-09) hand the file to the system share or download dialog. The open view stays in the URL hash (R-19), so the phone's back gesture moves between views and out of a detail screen instead of leaving the admin.
- Idle timeout warning (M-12), confirm dialog and undo toast (M-15) are bottom sheets and toasts inside the insets.

### 12.8 Themes and the installed app

**Light and dark.** The product has both, plus "system", in the storefront and the admin (G-05, M-14), and both are kept with the palettes of 7.2. Every page is checked in both themes at every width (gate (e)). The theme is applied before first paint from the stored preference, as today, with one storage key instead of three (BUG-14); the existing `LBS_THEME` value is read so a returning customer keeps their choice. `theme-color` and the manifest colours follow the theme (`#FAF6F0` light, `#161012` dark) so the browser bar and the installed app's status bar match the page. Product photographs sit on `nude-100` placeholders in light and the surface colour in dark, never on pure white in the dark theme.

**Progressive web app, as found and as rebuilt.**
- Kept: both manifests at their present URLs, standalone display, the storefront worker at `/sw.js`, the install prompt on Android and the instructions on iOS with dismissal remembered, the update flow, and the push and notification-click handlers in the storefront worker (Q-01 to Q-07). The admin's shell and static files are cached by the same new worker so that an installed admin still opens (Q-08, Q-09), while `/admin-sw.js` is retired as described in 3.5. Nothing subscribes to push today, and the rebuild does not add a subscription.
- Changed: hashed CSS and JavaScript are cached by the worker, so a page opened offline is styled and works; a small offline page explains that the connection is down, keeps the bottom navigation, and shows the bag from the device; `/checkout`, `/dashboard`, admin data and all Supabase requests are never served from the cache; images are cached with a cap (60 entries, 30 days). The storefront `start_url` becomes `/`. The admin manifest's scope becomes `/admin` to match its purpose, and `/admin-sw.js` is retired as described in 3.5. A proper maskable icon with a safe zone replaces the reused 192 px icon (9.4).
- Install prompt: not shown during a first visit or over any sheet or action bar. It is offered after an order is placed and from an "Install the app" row in the menu; dismissal is remembered for seven days as today. In standalone mode the layouts use the insets and there is an in-app back control on the product and order-detail pages, since the browser's own is absent.

### 12.9 Page-by-page mobile checklist

Built from the routes and features of section 2. Each entry is checked at 360, 390 and 430 px, in light and dark, and is ticked only against a Playwright test or a screenshot. These entries are in addition to the 354 parity items and do not change that count.

**Every page (global shell: G-01 to G-22)**
- [ ] Zoom is allowed; no horizontal scroll; body text 16 px; all targets 44 px or more
- [ ] Header 56 px plus the top inset; wordmark and menu button only on phones; anchors are not hidden under it
- [ ] Bottom navigation with Shop, Search, Wishlist, Bag (live count) and Account, inside the bottom inset; the active item is marked; the page's last content clears it
- [ ] Menu drawer lists categories, support and legal links and the theme control; closes by button, backdrop, Escape and swipe; focus returns to the menu button
- [ ] Search opens from the bottom navigation with the keyboard up, a `search` keyboard and results as 56 px rows; "View all results" reaches `/shop?search=`
- [ ] Bag opens as a bottom sheet with 44 px steppers, undo on remove and the checkout button inside the inset
- [ ] Sign-in opens as a full-height sheet; fields are not covered by the keyboard; password managers fill both fields; Google sign-in is a 48 px button
- [ ] Consent dialog is a bottom sheet with labelled switches, usable with one hand, and does not cover the page's primary action once dismissed
- [ ] WhatsApp button sits above whatever bottom bar is present and never overlaps a toast or button
- [ ] Toasts appear above the bottom bars and are announced
- [ ] Skeletons match the final layout so nothing shifts when content arrives (CLS under 0.1)
- [ ] Footer links are 44 px rows in single-column groups; the copyright line passes contrast
- [ ] Light and dark both correct; the browser bar colour follows the theme
- [ ] Printing from a phone (G-23) hides the header, bottom navigation, action bars, sheets and the WhatsApp button

**Home (`/`, R-01, R-02; H-01 to H-09)**
- [ ] Hero photograph first at full width in a 3:4 frame, preloaded; headline, one sentence and the shop link visible without scrolling at 390 × 844
- [ ] "New in" row scrolls sideways with snap, shows part of the next tile as the cue, and does not trap vertical scrolling
- [ ] Tiles: one tap opens the product; wishlist heart with a 44 px target; name wraps to two lines; price never truncates
- [ ] Category mosaic stacks to one column with captions under the images
- [ ] Service line reads as plain text with a `tel:`/WhatsApp link, no icon cards
- [ ] Testimonial section is omitted when empty and shows one quotation at a time when not

**Shop (`/shop`, R-03; S-01 to S-11)**
- [ ] Two-column grid of 4:5 tiles with 12 px gaps; images sized for 50vw
- [ ] Filter and sort bar pinned under the header; filter opens a full-height sheet with category, gender, price, delivery, stock and new-arrival controls as 48 px rows, "Show N items" and "Clear all" in a bar inside the inset
- [ ] Price range: two numeric fields with numeric keyboards; the dual slider has 44 px thumbs that cannot overlap
- [ ] Active filters as chips in one scrolling row, each removable with a 44 px target
- [ ] Sort opens a sheet of five options, not a native select clipped by the bar
- [ ] Search field uses the `search` keyboard and filters without layout shift
- [ ] Result count stays visible; the empty state has a "Clear filters" button
- [ ] Pagination or "Load more" is a 48 px full-width button; scroll position is restored on return from a product (G-17)
- [ ] Filters from URL parameters are reflected in the chips on arrival

**Product page (`/products/<slug>`, new; S-12 to S-26)**
- [ ] Gallery swipes with snap, shows the counter, reserves its 4:5 space and loads the first image eagerly
- [ ] Viewer: swipe, pinch-zoom, double-tap zoom, 44 px close inside the top inset
- [ ] Name, price and stock note directly under the gallery; price visible without scrolling at 390 × 844
- [ ] Size buttons 48 px; unavailable sizes struck through and not selectable; colour swatches 44 px with the name written out
- [ ] Size guide opens as a sheet and returns with the selection intact
- [ ] Quantity stepper 44 px; cap reason shown
- [ ] Sticky add-to-bag bar inside the inset shows price and selection; prompts for a size when none is chosen; never covers the size buttons when they are scrolled to
- [ ] Wishlist toggle 44 px; share uses the system share sheet where available, with the listed links (S-21) and "Copy link" as the fallback
- [ ] Description, delivery and returns as disclosure rows of 48 px
- [ ] Reviews: summary, list, and the review form with 44 px stars and correct keyboards
- [ ] `/shop?product=<id>` lands on this page; the back control returns to the grid at the same position

**Quick view (S-12 to S-25)**
- [ ] Bottom sheet up to `100dvh`, own scroll, drag to close, same gallery and sticky bar as the product page
- [ ] Editing a bag line (S-18) opens it pre-filled and the bar reads "Update bag"

**Wishlist (`/wishlist`, R-08; W-01 to W-05)**
- [ ] Two-column grid; remove with a 44 px target and undo; "Add to bag" under each tile
- [ ] "Clear wishlist" is away from the tiles and confirms in a sheet
- [ ] Empty state has one button to the shop

**Cart (`/cart`, R-04; C-01 to C-10)**
- [ ] Lines readable at 360 px: 72 px image, name on two lines, size and colour, stepper, line total
- [ ] Edit and Remove with 44 px targets; undo on remove; "Clear cart" confirms in a sheet
- [ ] Promo field with capitals keyboard; applied code shown as a removable chip; error text under the field
- [ ] Delivery estimate select uses the native picker; "Free" shown for Lagos
- [ ] Summary rows in tabular figures; sticky bar with total and "Checkout" above the bottom navigation
- [ ] Signed-out checkout opens the sign-in sheet and returns to the cart afterwards (C-08)
- [ ] Progress indicator fits one line at 360 px

**Checkout (`/checkout`, R-05; K-01 to K-17)**
- [ ] No bottom navigation; header shows the wordmark and a "Back to bag" link only
- [ ] Order summary collapsed at the top with count and total; expands in place
- [ ] Every field in the table of 12.5 has the stated type, keyboard and autofill; browser autofill completes contact and address in one action
- [ ] Inline error text under each invalid field; first invalid field focused; no toast-only errors
- [ ] "Use my profile details" and the saved-address picker are 48 px rows
- [ ] State select updates the delivery fee and the total in the action bar immediately
- [ ] Completed steps collapse to one line with a 44 px "Edit"
- [ ] Bank details: account number and amount each with a 44 px copy button and a "Copied" confirmation; nothing truncated at 360 px
- [ ] Receipt: opens the photo library or files; shows file name, thumbnail and remove (44 px); oversize or wrong-type files explained in text
- [ ] The page survives leaving for the banking app and returning: fields, step and bag intact
- [ ] Action bar inside the inset, hidden while the keyboard is open, label follows the step, shows the total; disabled state explains what is missing
- [ ] Double submission is impossible and the button shows progress (K-15)
- [ ] Failure keeps the bag and shows the error above the bar

**Confirmation (`/confirmation`, R-06; T-01, T-02)**
- [ ] Order number large with a copy button; what happens next in three sentences
- [ ] "Track this order" as the primary button, WhatsApp as the secondary one, both 48 px
- [ ] Items, totals and address in one column, tabular figures, nothing truncated

**Track (`/track`, R-07; T-03 to T-06)**
- [ ] Two fields with correct keyboards and capitals for the order number; button under the fields
- [ ] Result: status badge, vertical timeline with real times, items and total; cancelled state distinct without relying on colour
- [ ] `?order=` pre-fills and searches; "not found" is plain text with a WhatsApp link

**Account (`/dashboard`, R-09; D-01 to D-19)**
- [ ] Sign-in gate is the same sheet as elsewhere
- [ ] Section switcher reachable with one thumb (tab row or bottom bar, per decision 11) and scrolls the active tab into view
- [ ] Overview figures in one bordered row that fits 360 px; recent orders as rows
- [ ] Orders: status filter as chips; a row opens a full-screen detail with timeline, items, totals
- [ ] Cancel shows the countdown, confirms in a sheet and is not beside another button; return request opens WhatsApp or the contact form pre-filled
- [ ] Addresses: add form with the attributes of 12.5; delete with undo
- [ ] Profile: correct keyboards; native date picker for date of birth; save button above the keyboard
- [ ] Settings: switches as full-width 44 px rows; theme and text size take effect immediately
- [ ] Data download works on a phone (file handed to the system dialog); deactivate and delete each confirm in two steps and sit at the end of the page
- [ ] Set-new-password (`?setpw=1`) sheet shows the rules and is not covered by the keyboard

**Contact (`/contact`, R-10; P-01 to P-04)**
- [ ] Channels first as 56 px rows: WhatsApp, call (`tel:`), email (`mailto:`), Instagram, TikTok
- [ ] Form fields as in 12.5; subject uses the native picker; `?subject=` pre-selects
- [ ] Success panel replaces the form; a failed save says so and offers WhatsApp (BUG-11)

**FAQ (`/faq`, R-11; P-05, P-11 to P-14)**
- [ ] Search field at the top with the `search` keyboard and a 44 px clear button; matches across all six groups; no-results state offers "Clear search" and WhatsApp (P-12)
- [ ] Category tabs in one scrolling row with the active tab visible and announced; "All" shows all 23 questions on arrival (BUG-30)
- [ ] Questions are rows of at least 48 px that wrap rather than truncate; only the tapped answer opens; the opened question stays in view; answers at 16 px
- [ ] Links inside answers (shop, dashboard, track, contact, size guide, WhatsApp, Instagram: P-11) have 44 px targets and do not sit on adjacent lines without spacing
- [ ] Fees, times and bank details in the answers (P-13) fit 360 px, with the account number copyable
- [ ] "Still have questions?" panel (P-14) ends the page with one 48 px button to `/contact`, clear of the bottom navigation

**Size guide (`/size`, R-12; P-06 to P-08, P-15 to P-18)**
- [ ] Introduction and measuring advice (P-15) above the four measuring cards, which stack in one column with diagrams that fit the width
- [ ] Chart tabs (bras, panties, bodysuits, loungewear) in one row, 44 px, with the selected tab announced
- [ ] Each chart keeps every row and value of P-16 and fits 360 px without sideways scrolling, in 14 px tabular figures, with the size column fixed; the cm / in control shows on the charts that carry both units
- [ ] Calculator: two fields with decimal keyboards and "cm" in the labels; out-of-range values explained under the field; no empty result shown before a calculation; result in the page, not an alert (BUG-32)
- [ ] Fit tips (P-17) as plain paragraphs or disclosure rows of 48 px
- [ ] "Still not sure?" panel (P-18) with one 48 px button to `/contact`
- [ ] The same charts and calculator render inside the product's size-guide sheet

**Privacy and terms (`/privacy`, `/terms`, R-13, R-14, R-20; P-09, P-10, P-19 to P-21)**
- [ ] "Last updated" date and introduction first (P-19); table of contents is a collapsed "On this page" row at the top on phones, not a sticky sidebar, and marks the section in view
- [ ] 16 px text at reading width; call-out paragraphs keep their emphasis without shrinking the text
- [ ] Section anchors, including `/privacy#data-deletion` and `/dashboard#settings` (R-20), land below the header
- [ ] Data-deletion routes (P-20) as four 48 px rows: dashboard, contact form, WhatsApp with the pre-filled text, email
- [ ] The delivery-fee table and other tabular terms (P-21) fit 360 px without sideways scrolling
- [ ] Closing contact panel clear of the bottom navigation

**Not found and error (R-16)**
- [ ] Message, a button to the shop and the bottom navigation; no dead end

**Admin — access and shell (`/admin`, R-15, R-19; M-01 to M-31)**
- [ ] Zoom allowed; no horizontal scroll; 16 px controls; all targets 44 px or more, in both themes (A11Y-11)
- [ ] Staff sign-in, invitation sign-up, reset, set-password, verified and expired-link screens: single column, correct keyboards and autofill, 48 px buttons, validation messages under the fields (M-01 to M-05, M-18 to M-23)
- [ ] Complete-profile prompt as a sheet with a working close control (M-07, BUG-28)
- [ ] Top bar with the view title and the staff name and role; bottom bar with Orders, Inventory, Messages, Dashboard and More; counts on Orders and Messages (M-09, M-11, M-24, MD-04)
- [ ] More sheet lists the remaining views in their groups (Store, Customers, Insights, Settings), Invite, Change password, View store, the export menu, refresh all, the theme switch and Logout (M-13, M-14, M-24, M-25); role-restricted entries absent for editors (M-10)
- [ ] The open view is kept in the URL hash and restored on reload; the back gesture moves between views (R-19)
- [ ] Skeletons match the phone layouts (M-27); each view's refresh control is 44 px and pull to refresh works where a refresh button exists (M-26)
- [ ] Confirm dialog, toast and the five-second undo toast appear inside the insets and above the bottom bar, and the undo toast is actually shown (M-15, BUG-19)
- [ ] Idle warning with "Stay signed in" as a 48 px button (M-12); welcome and sign-out overlays fit 360 px (M-08)
- [ ] Dialogs and sheets trap and return focus and are labelled (A11Y-09)

**Admin — dashboard (MD-01 to MD-06)**
- [ ] Four totals in a two-column grid in tabular figures; revenue labelled as delivered orders (MD-01, MD-05)
- [ ] Recent orders and low stock as rows with real quantities; "View all" links are 44 px and work (MD-02, MD-03, MD-06, BUG-23, BUG-28)

**Admin — inventory and product editor (MI-01 to MI-19)**
- [ ] Inventory as two-column cards at 360 px with image, name, price, stock, Edit and Remove at 44 px, and a selection control reachable by touch and keyboard (MI-12)
- [ ] Search with a clear button and the live count; category and stock filters in a sheet, and working (MI-01, MI-11, BUG-20); pagination as 48 px controls
- [ ] Card image viewer swipes, with previous and next at 44 px, dots and a count (MI-02)
- [ ] Bulk selection bar inside the inset with the count, "Move to trash" and "Cancel" (MI-03)
- [ ] Editor in one column: name, price, description, category, gender, quantity, delivery type, colour type and pack type as full-width 48 px controls; numeric keyboards for price and quantities (MI-04, MI-05, MI-16)
- [ ] Variant entry: size picker, colour field with suggestions as a list that does not cover the field, quantity with a numeric keyboard, quick-size buttons at 44 px, and the keyboard's "done" key adds the variant (MI-13)
- [ ] Variant list grouped by size, one row per colour with a 44 px stepper and remove, low and out-of-stock markers, totals in the footer (MI-06, MI-14)
- [ ] Images: several picked at once from the camera or library; preview swipes; remove at 44 px; a failed upload is reported (MI-07, MI-17, BUG-25)
- [ ] "Live" and "New arrival" switches as full-width 44 px rows (MI-08)
- [ ] Sticky bar with Save (and Delete or "Clear form" in the overflow) above the inset, hidden while the keyboard is open; required-field errors under the fields (MI-09, MI-18, MI-19)

**Admin — orders (MO-01 to MO-10)**
- [ ] Four counters in a two-column grid that stay correct when a filter is applied (MO-01, BUG-27)
- [ ] Orders as rows: order number, date, customer, item count, total, status badge; status filter as chips in one scrolling row; ten per page with 48 px pagination (MO-02, MO-06, MO-07)
- [ ] Order detail as a full screen: header with order number, date and time; customer and contact with the phone number as `tel:` and WhatsApp links; delivery address; items; totals with discount and promo code; notes; payment method and reference (MO-03, MO-10)
- [ ] Receipt shown in the page through a signed URL and opened in the pinch-zoom viewer; a PDF receipt opens in the system viewer
- [ ] One next-step action in the bottom bar inside the inset; cancel and reject behind a confirmation; delivered and cancelled orders show a final-status label and no action (MO-04, MO-08)
- [ ] After a status change the detail updates in place with a toast, and the list is current on return (MO-09)
- [ ] Timeline vertical with real times (MO-05)

**Admin — customers (MC-01 to MC-12)**
- [ ] Totals in a row that fits 360 px; search with the `search` keyboard (MC-01, MC-10)
- [ ] Customers as stacked rows with a label before each value (name, email, phone, WhatsApp, orders, total spent, joined, status), paginated (MC-08, MC-09, M-29)
- [ ] Row actions in a sheet with text labels: Details, Message, Suspend, Ban, Reactivate, Revoke or restore returns, Delete; each destructive action confirms, delete twice (MC-03 to MC-06, MC-12); the action always applies to the customer shown, including after a search (BUG-21)
- [ ] Customer detail as a full screen; phone and WhatsApp number are tappable links; "Location & Device" and the 20 recent visits as stacked rows, not a table wider than the screen (MC-02, MC-11)
- [ ] Customer export (CSV, JSON, TXT, PDF) from a sheet, file handed to the system dialog (MC-07)

**Admin — messages (MM-01 to MM-11)**
- [ ] Counters in one row; status chips in a scrolling row; category list and search in a filter sheet; 20 per page (MM-01, MM-07)
- [ ] List cards with initials, name, category, status badge, a two-line preview and the relative time, each at least 64 px high (MM-08)
- [ ] Detail as a full screen with a 44 px back control; the thread in time order, scrolled to the latest; opening marks it read and updates the bottom-bar count (MM-02, MM-06, MM-09)
- [ ] Reply box fixed above the keyboard with the sender address as a native picker and a 48 px Send; mark unread and delete in the overflow, delete confirmed (MM-03, MM-04, MM-10)
- [ ] Compose as a full screen: recipient search with 56 px result rows, the chosen recipient as a removable tag, subject, message, sender address; works when opened directly from Messages; a failed send says so (MM-05, MM-11, BUG-26)

**Admin — reviews, site images, staff, activity, trash (MX-01 to MX-15)**
- [ ] Reviews: counters two per row; status and rating filters as native pickers; cards with Approve, Reject and Delete at 44 px, delete confirmed (MX-01, MX-02, MX-10)
- [ ] Site images: one image per section with the preview at full width, the recommended dimensions as text, a URL field (`type="url"`, `inputmode="url"`), upload from the library, and a sticky Save (MX-03, MX-04, MX-11)
- [ ] Staff: rows with role badge, "You" and "Protected" markers; promote, demote and remove in a sheet, removal confirmed (MX-05, MX-06, MX-12)
- [ ] Invitation sheet: email keyboard, role as two described 56 px options, the fallback link copyable with a 44 px button (MX-07, MX-13)
- [ ] Activity log: entries as stacked rows (staff, role, action, subject, device, relative time); search and the action filter in a sheet (MX-08, MX-14)
- [ ] Trash: rows with image, name, category and age; Restore and "Delete permanently" at 44 px and apart; "Empty trash" at the end of the page; each confirmed (MX-09, MX-15)

**Admin — analytics and exports (MA-01 to MA-14)**
- [ ] Period selector as three chips; a note states which figures follow the period and which are all-time (MA-01, MA-10, BUG-29)
- [ ] Indicators two per row in tabular figures (MA-02)
- [ ] Revenue bars, status donut and traffic chart at full width, with values readable at 360 px without hover and a text summary for each (MA-03, MA-04)
- [ ] Top pages, top products, devices, brands, browsers, countries and Nigerian states as ranked lists with the share beside each, not tables wider than the screen (MA-04 to MA-06, MA-11)
- [ ] Configuration status cards stack (MA-07)
- [ ] Export sheet with the ten entries as 48 px rows and the "no data" message; CSV and PDF complete on a phone, PDF generation loaded on demand (MA-08, MA-09, MA-12 to MA-14)
- [ ] Printing an admin view hides the navigation, bars and toasts (M-30)

**Installed app and offline (Q-01 to Q-09)**
- [ ] Installs from the menu and after an order; opens at `/` in standalone mode with correct status-bar colour in both themes
- [ ] Offline: a styled page with the bag from the device; checkout and account are never served stale
- [ ] An update activates and reloads once, without losing a filled checkout form
- [ ] The admin installs separately and opens at `/admin`; during the retirement release `/admin-sw.js` unregisters itself and an installed admin keeps working (Q-04, Q-08, Q-09, section 3.5)

---

## 13. Quality gates (must all pass before the PR)

Nothing in this rebuild is called done until every gate below passes, and the pull request is not opened until gates (a) to (h) have passed on the same commit. A gate that fails is fixed at its cause; it is never passed by weakening the check. The repository has no toolchain today (section 4), so the commands below are the ones the rebuild adds in Phase 0 and runs in CI on every push.

**(a) Type check and lint clean, with no workarounds.**
- `npx tsc --noEmit` — 0 errors, with `strict`, `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` on (3.3).
- `npx eslint . --max-warnings 0` — 0 errors, 0 warnings. `npx prettier --check .` — no differences.
- A CI step searches the tree for `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`, `eslint-disable`, `as any`, `as unknown as` and fails if any is found. `tsconfig.json` and `eslint.config.mjs` are compared with their Phase 0 versions in the review; a loosened option fails the gate.

**(b) A test for every rule, fix and key flow, and the suite passing.**
- Unit (`npx vitest run`): pricing and totals, promo validation, delivery fee by state, stock caps per variant, the cart and wishlist merge rules, every zod schema (including the phone and order-number formats), money and date formatting, the bra-size calculation. Every defect in section 5 that is fixed in code has a test named after its number (for example `BUG-04 promo discount reaches the order`).
- Database: policy tests run against a local Supabase (`supabase start`, `supabase test db`) as `anon`, customer, editor, super admin and owner, one for each `SEC-` and `SC-` item.
- End-to-end (`npx playwright test`), run in two projects on every push — **`phone`** (390 × 844, touch, mobile user agent) and **`desktop`** (1280 × 800) — with the phone project also repeating the layout assertions at 360 and 430 px. The flows:
  1. Browse the shop, filter and sort, open a product, choose size and colour, add to bag, change the quantity, check out through contact, delivery and bank transfer with a receipt upload, reach the confirmation, and track the order.
  2. A failed order keeps the bag and shows the error (BUG-01); a double tap on "Place order" creates one order.
  3. A promo code applied in the cart reduces the order total and its use is counted (BUG-04).
  4. Stock is reduced by an order and an out-of-stock size cannot be added (BUG-05).
  5. Sign-up, email verification landing, sign-in, Google sign-in entry, forgot password and set new password; a suspended account is refused by the server.
  6. Wishlist add and remove, and synchronisation of bag and wishlist between two signed-in sessions.
  7. Search from the bottom navigation to a product; the no-match fallback.
  8. Size guide opened from a product and closed with the selection intact; the calculator.
  9. Account: order detail, cancel within 30 minutes, return request hand-off, add and delete an address, edit the profile, change theme and text size, download data, delete account.
  10. Contact form submission and its failure path; FAQ search.
  11. Consent: analytics and marketing scripts absent until accepted, and the choice honoured on the next page load.
  12. Admin: staff sign-in; an editor cannot reach restricted views or data; confirm a payment from the receipt and advance an order to delivered; edit a product's variant stock and images; reply to a message; approve a review and see it on the storefront; invite a member of staff and accept the invitation; export orders.
  13. Guest order tracking with the order number and email; a wrong pair reveals nothing.
  14. Legacy URLs redirect as in the map of 3.5.
  15. Offline: the offline page appears, and checkout is not served from the cache.
- Pass: every test green in both projects, no test skipped or marked as expected to fail, and each of the 354 parity items mapped to a test or a recorded manual check.

**(c) The production build passes.** `npm ci && npm run build` exits 0 with no warnings on the Node version in `.nvmrc`, and the Vercel preview deployment of the same commit succeeds. The bundle-size check against the budgets of 12.6 is part of this gate.

**(d) Data and secret safety.**
- No secrets on the client: a script searches `.next/static` and the rendered HTML for the names and values of every server-only variable in 9.2 (`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `RECAPTCHA_SECRET_KEY`, the Monnify secret if present) and for a JWT whose role is `service_role`; any hit fails. Only `NEXT_PUBLIC_` variables may appear. `.env*` files other than `.env.example` (names only) are ignored by git, and the history of the branch is searched for the same values.
- Server-side validation and authorisation: every server action and route handler parses its input with zod and checks the session and role before acting (tested in (b)); `/admin` returns a redirect, not markup, to a visitor who is not staff; the policy tests pass.
- Safe headers on the preview: `curl -sI` on `/`, `/checkout` and `/admin` shows HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors`, and a content security policy with nonces and without `'unsafe-inline'` for scripts.
- Receipts are private: an unauthenticated request for a receipt object is refused; a signed URL expires.
- `npm audit --audit-level=high` reports nothing.

**(e) Seen on screen.** A Playwright run captures every route — the thirteen storefront routes, the product page, the 404 page, the staff sign-in screens and each of the twelve admin views, plus the open states of the bag, filter, size-guide, quick-view and sign-in sheets — at 360, 390, 768, 1024, 1280 and 1536 px (and at 430 px for the phone layouts), in light and in dark. Each capture is compared by eye against the design direction in section 7 and the checklist in 12.9, phone widths first. The "before" captures taken in Phase 0 and the "after" captures are attached to the pull request side by side, phone first. Pass: no horizontal scroll, overlap, clipped text, content under a fixed bar or wrong-theme colour in any capture.

**(f) Independent review of the finished diff.** A reviewer who did not write the code reads the complete diff looking for real defects only: security (authorisation, injection, exposure of receipts or customer data), privacy (consent, IP storage, what is logged), data loss (orders, stock, bag and wishlist merges, migrations) and broken flows. Every finding is fixed at its cause with a test, and the reviewer re-checks each fix; the review is repeated on the changed code until it returns nothing. The findings and their resolutions are listed in the pull request.

**(g) The professional finish.** Checked page by page against section 11: no gradients, gradient text, glows, glass effects or blurred shapes; one icon set and no emoji as icons; not the stock template; the banned phrases absent (a scripted search of the source and of the rendered text); no placeholder images, lorem ipsum, `console.log`, commented-out code or TODO; unsupported claims removed (DES-05); copy in plain British English, read through once by a person for spelling (colour, organise, centre) and for anything that reads as filler.

**(h) Lighthouse mobile 90 or more in all four categories.** `npx lighthouse <preview URL> --form-factor=mobile` (default mobile throttling), three runs per page, median reported, on `/`, `/shop`, a product page, `/cart`, `/checkout`, `/track`, `/size` and `/contact`. Pass: Performance, Accessibility, Best Practices and SEO each 90 or more, LCP under 2.5 s, CLS under 0.1, and the INP check of 12.6 under 200 ms. The scores are pasted into the pull request as a table with the Lighthouse version. One point is declared in advance rather than discovered later: `/cart`, `/checkout` and `/track` are deliberately `noindex` (O-02), and Lighthouse counts a `noindex` page against its SEO category (the present pages score 66 for that reason, 4.1). For those three pages the gate is 90 or more in the other three categories, every other SEO audit passing, and `noindex` confirmed as intended; the owner is asked to accept this, or to decide otherwise, as decision 12 in 9.6. `/admin` is checked in the same way after signing in.

**(i) The owner's approval.** The owner reviews the preview deployment on their own phone and the pull request (screenshots, scores, review findings, the ticked parity and mobile checklists) and approves in writing on the pull request. Nothing is merged, no migration is applied to the live database and nothing is deployed to production before that approval.

---

## 14. What will make it stand out

The comparison is with the kinds of shop a customer of this brand is likely to use instead; the descriptions are of what such shops typically do, not claims about any named business.

- **Vendors who sell through Instagram and WhatsApp alone.** Typically: prices and sizes confirmed in direct messages, account details sent in chat, payment confirmed by a screenshot, and no way to see stock or follow an order without asking.
- **Large marketplaces.** Typically: very wide catalogues with card and other payment options and their own delivery, but generic product pages, sizing information that varies by seller, and little sense of a brand.
- **Small brands on hosted shop builders and templates.** Typically: a standard theme with a card gateway, product pages that look alike from shop to shop, and a size chart as an image or a separate page.
- **International lingerie retailers.** Typically: thorough fit guidance, but foreign-currency prices, longer delivery and returns that are impractical from Nigeria.

Against that, the rebuild can deliver and verify the following.

1. **A shop that is built for the phone in one hand.** Swipe galleries with pinch-zoom, size and colour buttons a thumb can hit, a bag and checkout whose main button is always at the bottom of the screen, and search, wishlist, bag and account one tap away. Verified by the checklist in 12.9, the phone Playwright project and Lighthouse mobile 90 or more (gates (b), (e), (h)). The present site hides search on phones, has no swipe and disables zoom (12.1), so the difference is concrete.

2. **Bank transfer done properly.** The shop's customers pay by transfer, and that is kept (section 1). What changes is that the transfer step is designed for the round trip to a banking app: one tap copies the account number and the exact amount, the receipt is attached from the photo library, the order is created on the server with the right total and stock, and the customer is told truthfully that a person will confirm the payment. Staff confirm from a phone with the receipt on screen, and the customer sees real timestamps when tracking. This sits between the informality of ordering by chat and the card-only checkout of template shops. Verified by flows 1, 2 and 12 in gate (b) and the staging walk-through in 8.2.

3. **Fit information where the decision is made.** The size guide opens over the product without losing the selection, the charts are readable at 360 px, the bra calculator is one tap away, and each size shows whether it is in stock. For a product bought by measurement and rarely returned casually, this removes the commonest reason to leave the page and ask. Verified by flow 8 and the size-guide entries in 12.9.

4. **WhatsApp as part of the shop rather than a substitute for it.** The store already answers customers on WhatsApp (G-10, D-07, P-03). The rebuild carries context into each hand-off — the product, the order number, the reason — from the product page, the confirmation, tracking and returns, so the conversation starts with the facts and the order itself stays in the system with its status and history. Verified by the pre-filled links in the e2e flows.

5. **Plain facts, fast, on mobile data.** Naira prices, the delivery fee for each of the seven states shown before checkout with Lagos free (`assets/js/config.js:32-41`), real stock per size, real order times, and no invented figures such as the present "500+" counter (DES-05); pages that meet the budgets of 12.6 on a mid-range phone. Verified by gates (g) and (h).

These are the differentiators the plan commits to. None depends on a feature the shop does not have today, and each is tied to a gate, so it either passes or it is not claimed.

---

No rebuild work will start until the owner approves this plan, and no pull request will be opened until every gate in section 13 passes.
