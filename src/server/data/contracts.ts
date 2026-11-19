import type { AddressInput, ProfileInput } from "@/schemas/auth";
import type {
  ActivityEntry,
  AdminReview,
  AdminTestimonial,
  Address,
  BankDetails,
  CustomerRecord,
  InboxMessage,
  OrderStatus,
  PaymentChange,
  PaymentMethodId,
  PaymentMethodState,
  PromoRecord,
  Profile,
  SessionUser,
  StaffMember,
  StaffRole,
  StoreSettings,
} from "@/types/account";
import type { Product } from "@/types/domain";
import type { CatalogueQuery } from "@/types/catalogue";
import type { ContactMessage } from "@/schemas/contact";
import type { OrderInput } from "@/schemas/checkout";
import type {
  OrphanReceipt,
  Page,
  Paged,
  PlaceOrderResult,
  QuoteResult,
  StoredOrder,
} from "@/types/orders";

/**
 * The data-access interface. The pages and server actions depend only on these contracts. Today the
 * mock store in `src/server/mock` implements them; the Supabase implementation drops in later by
 * implementing the same contracts and being returned from `src/server/data/index.ts`.
 */

export type Result<T = undefined> =
  | ({ readonly ok: true } & (T extends undefined ? object : { readonly value: T }))
  | { readonly ok: false; readonly message: string };

export type Audience = "customer" | "staff";

/**
 * Authentication is session based, as Supabase is: the repository owns the session. The Supabase
 * implementation keeps it in the cookies written by `@supabase/ssr`, refreshes it in the proxy
 * (`refreshSession`) and never hands a token to the actions. A recovery or Google link arrives at
 * `/auth/callback?code=...`, which calls `exchangeCode`; the password is then changed with
 * `updatePassword` on that session.
 */
export interface AuthRepository {
  signIn(
    email: string,
    password: string,
    audience: Audience,
    context: { readonly ip: string },
  ): Promise<Result<SessionUser>>;
  /**
   * Creates the account. The value is the signed-in user, or `null` when the project requires the
   * address to be confirmed first (a confirmation link has been sent and there is no session yet).
   */
  signUp(input: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }): Promise<Result<SessionUser | null>>;
  /** What a staff invitation link carries (address and role), or null when it is unknown, used or expired. */
  invitation(
    token: string,
  ): Promise<{ readonly email: string; readonly role: "editor" | "super_admin" } | null>;
  /**
   * Creates the staff account behind an invitation. The address and the role come from the
   * invitation, never from the form. The value is the signed-in user, or `null` when the address
   * must be confirmed first.
   */
  acceptInvitation(input: {
    token: string;
    firstName: string;
    lastName: string;
    password: string;
  }): Promise<Result<SessionUser | null>>;
  /** The provider address to send the browser to; `redirectTo` is the absolute `/auth/callback` URL. */
  signInWithGoogle(redirectTo: string): Promise<Result<{ readonly url: string }>>;
  /** `redirectTo` is the absolute `/auth/callback` URL. `devLink` is only ever set in local development. */
  requestPasswordReset(
    email: string,
    audience: Audience,
    redirectTo: string,
  ): Promise<{ readonly devLink: string | null }>;
  /** Exchanges the one-time `code` from an email or provider link for a session of this audience. */
  exchangeCode(code: string, audience: Audience): Promise<Result>;
  /** Sets a new password for the current session of this audience (a recovery session or a signed-in user). */
  updatePassword(password: string, audience: Audience): Promise<Result>;
  /** Whether this password is right for the address; used before a sensitive change. Never signs anyone in. */
  confirmPassword(email: string, password: string): Promise<boolean>;
  currentUser(audience: Audience): Promise<SessionUser | null>;
  /** Called by the proxy on every request so an expiring session is renewed. */
  refreshSession(): Promise<void>;
  signOut(audience: Audience): Promise<void>;
}

export interface OrdersRepository {
  /** What the customer must transfer, worked out on the server from current prices. */
  quote(input: {
    readonly lines: OrderInput["lines"];
    readonly promoCode?: string | undefined;
    readonly state: string;
  }): Promise<QuoteResult>;
  place(
    input: OrderInput,
    context: { readonly userId: string | null; readonly now?: Date },
  ): Promise<PlaceOrderResult>;
  byNumber(orderNumber: string): Promise<StoredOrder | null>;
  /** The guest lookup: the order number and the email together. */
  lookup(orderNumber: string, email: string): Promise<StoredOrder | null>;
  /** Replaces a rejected receipt while the re-upload window is open. */
  attachReceipt(orderNumber: string, receiptPath: string, now?: Date): Promise<Result>;
  /** Only whether a code is valid and its percentage; never the list of codes. */
  validatePromo(code: string, now?: Date): Promise<Result<{ code: string; percent: number }>>;
  /** Cancels pending orders whose rejected receipt was not replaced in time; for the cron. */
  expireUnpaid(now?: Date): Promise<number>;
}

export interface CatalogueRepository {
  list(query: CatalogueQuery, page: Page): Promise<Paged<Product>>;
  bySlug(slug: string): Promise<Product | null>;
  byIds(ids: readonly string[]): Promise<readonly Product[]>;
  newArrivals(limit: number): Promise<readonly Product[]>;
}

export interface ContactRepository {
  submit(message: ContactMessage, now?: Date): Promise<Result>;
}

export interface AccountRepository {
  profile(userId: string): Promise<Profile | null>;
  updateProfile(userId: string, input: ProfileInput): Promise<Result<Profile>>;
  addresses(userId: string): Promise<readonly Address[]>;
  saveAddress(userId: string, input: AddressInput, id?: string): Promise<Result<Address>>;
  deleteAddress(userId: string, id: string): Promise<Result>;
  orders(
    userId: string,
    query: { readonly status?: OrderStatus | undefined },
    page: Page,
  ): Promise<Paged<StoredOrder>>;
  order(userId: string, orderNumber: string): Promise<StoredOrder | null>;
  cancelOrder(userId: string, orderNumber: string): Promise<Result>;
  requestDeletion(userId: string, password: string): Promise<Result>;
  withdrawDeletion(userId: string): Promise<Result>;
  exportData(userId: string): Promise<string>;
}

export interface OrderQuery {
  readonly status?: OrderStatus | undefined;
  readonly search?: string | undefined;
}

export interface AdminProductQuery {
  readonly trash?: boolean | undefined;
  readonly category?: string | undefined;
  readonly stock?: "in" | "out" | "low" | undefined;
  readonly search?: string | undefined;
}

export interface MessageQuery {
  readonly status?: "unread" | "read" | "replied" | undefined;
  readonly search?: string | undefined;
}

export interface MessageCounts {
  readonly all: number;
  readonly unread: number;
  readonly read: number;
  readonly replied: number;
}

export interface CustomerStats {
  readonly total: number;
  readonly newSince: number;
  readonly withOrders: number;
}

export interface ProductDraft {
  readonly name: string;
  readonly category: Product["category"];
  readonly gender: Product["gender"];
  readonly priceNgn: number;
  readonly description: string;
  readonly deliveryType: Product["deliveryType"];
  readonly isNew: boolean;
  readonly active: boolean;
  readonly allowColourSelection: boolean;
  readonly packType: string;
  readonly variants: readonly { size: string; color: string; qty: number }[];
  readonly images: readonly { src: string; alt: string }[];
  /** The stock version the form was loaded with; stock is saved only if it is still current. */
  readonly stockVersion?: number | undefined;
}

export interface AdminProduct extends Product {
  readonly active: boolean;
  /** Rises every time stock changes (an order, a cancellation or an edit). */
  readonly stockVersion?: number | undefined;
  readonly deletedAt: string | null;
}

export interface AnalyticsDay {
  readonly date: string;
  readonly views: number;
  readonly orders: number;
  readonly revenueNgn: number;
}

export interface Tally {
  readonly label: string;
  readonly value: number;
}

export interface AnalyticsReport {
  readonly days: 7 | 30 | 90;
  readonly sample: boolean;
  readonly pageViews: number;
  readonly customers: number;
  readonly orders: number;
  readonly revenueNgn: number;
  readonly conversionPercent: number;
  readonly series: readonly AnalyticsDay[];
  readonly statusBreakdown: readonly Tally[];
  readonly topPages: readonly Tally[];
  readonly topProducts: readonly Tally[];
  readonly devices: readonly Tally[];
  readonly browsers: readonly Tally[];
  readonly states: readonly Tally[];
}

export interface DashboardSummary {
  readonly productCount: number;
  readonly orderCount: number;
  readonly revenueNgn: number;
  readonly pendingOrders: number;
  readonly unreadMessages: number;
  readonly recentOrders: readonly StoredOrder[];
  readonly lowStock: readonly AdminProduct[];
}

export interface AdminRepository {
  summary(): Promise<DashboardSummary>;
  products(query: AdminProductQuery, page: Page): Promise<Paged<AdminProduct>>;
  productCounts(): Promise<{ readonly live: number; readonly trashed: number }>;
  product(id: string): Promise<AdminProduct | null>;
  createProduct(draft: ProductDraft, actor: SessionUser): Promise<Result<AdminProduct>>;
  updateProduct(id: string, draft: ProductDraft, actor: SessionUser): Promise<Result<AdminProduct>>;
  trashProduct(id: string, actor: SessionUser): Promise<Result>;
  restoreProduct(id: string, actor: SessionUser): Promise<Result>;
  deleteProductForever(id: string, actor: SessionUser): Promise<Result>;
  emptyTrash(actor: SessionUser): Promise<Result<{ removed: number }>>;
  orders(query: OrderQuery, page: Page): Promise<Paged<StoredOrder>>;
  orderCounts(): Promise<Readonly<Record<OrderStatus, number>>>;
  order(orderNumber: string): Promise<StoredOrder | null>;
  setOrderStatus(orderNumber: string, status: OrderStatus, actor: SessionUser): Promise<Result>;
  setPaymentDecision(
    orderNumber: string,
    decision: "confirmed" | "rejected",
    actor: SessionUser,
  ): Promise<Result>;
  /** A cancelled order with an unaccepted receipt: staff checked the bank and enter what arrived (0 = nothing). */
  resolveRefundCheck(orderNumber: string, receivedNgn: number, actor: SessionUser): Promise<Result>;
  /** The refund owed on a cancelled order has been paid back. */
  markRefunded(orderNumber: string, actor: SessionUser): Promise<Result>;
  /** Receipts with no order, open failures first. */
  orphanReceipts(): Promise<readonly OrphanReceipt[]>;
  resolveCheckoutFailure(id: string, resolution: string, actor: SessionUser): Promise<Result>;
  /** Deletes an abandoned upload (no failure on record) or a failure that has been resolved. */
  deleteOrphanReceipt(path: string, actor: SessionUser): Promise<Result>;
  /** Moderation (products.manage): nothing a visitor sends in is shown until a member of staff approves it. */
  reviews(status: "pending" | "approved", page: Page): Promise<Paged<AdminReview>>;
  setReviewApproved(id: string, approved: boolean, actor: SessionUser): Promise<Result>;
  deleteReview(id: string, actor: SessionUser): Promise<Result>;
  testimonials(status: "pending" | "approved", page: Page): Promise<Paged<AdminTestimonial>>;
  setTestimonial(
    id: string,
    change: { readonly approved?: boolean; readonly featured?: boolean },
    actor: SessionUser,
  ): Promise<Result>;
  deleteTestimonial(id: string, actor: SessionUser): Promise<Result>;
  customers(search: string, page: Page): Promise<Paged<CustomerRecord>>;
  customerStats(since: Date): Promise<CustomerStats>;
  setCustomerStatus(
    id: string,
    status: "active" | "suspended" | "banned",
    actor: SessionUser,
  ): Promise<Result>;
  setReturnPrivilege(id: string, allowed: boolean, actor: SessionUser): Promise<Result>;
  deleteCustomer(id: string, actor: SessionUser): Promise<Result>;
  promos(page: Page): Promise<Paged<PromoRecord>>;
  savePromo(
    input: { code: string; percent: number; expiresAt: string | null; usageLimit: number | null },
    actor: SessionUser,
  ): Promise<Result<PromoRecord>>;
  setPromoActive(id: string, active: boolean, actor: SessionUser): Promise<Result>;
  deletePromo(id: string, actor: SessionUser): Promise<Result>;
  messages(query: MessageQuery, page: Page): Promise<Paged<InboxMessage>>;
  messageCounts(): Promise<MessageCounts>;
  message(id: string): Promise<InboxMessage | null>;
  markMessage(id: string, status: "read" | "unread", actor: SessionUser): Promise<Result>;
  replyToMessage(id: string, body: string, actor: SessionUser): Promise<Result>;
  deleteMessage(id: string, actor: SessionUser): Promise<Result>;
  analytics(days: 7 | 30 | 90): Promise<AnalyticsReport>;
  settings(): Promise<StoreSettings>;
  saveSettings(next: StoreSettings, actor: SessionUser): Promise<Result>;
  /** Bank transfer details (Admin, Settings, Payments): saved in the database, every change logged. */
  saveBankDetails(details: BankDetails, actor: SessionUser): Promise<Result>;
  /** Switches a payment method on or off; a gateway that is not connected cannot be switched on. */
  setPaymentMethod(method: PaymentMethodId, enabled: boolean, actor: SessionUser): Promise<Result>;
  /** The latest changes to payment settings, with old and new values. */
  paymentChanges(limit: number): Promise<readonly PaymentChange[]>;
  staff(): Promise<readonly StaffMember[]>;
  setStaffRole(
    id: string,
    role: Exclude<StaffRole, "owner" | "developer">,
    actor: SessionUser,
  ): Promise<Result>;
  removeStaff(id: string, actor: SessionUser): Promise<Result>;
  inviteStaff(
    email: string,
    role: Exclude<StaffRole, "owner" | "developer">,
    actor: SessionUser,
  ): Promise<Result<{ link: string }>>;
  activity(search: string, page: Page): Promise<Paged<ActivityEntry>>;
}

export interface PublicReview {
  readonly id: string;
  readonly productId: string;
  readonly name: string;
  readonly rating: number;
  readonly title: string;
  readonly comment: string;
  readonly createdAt: string;
}

export interface PublicTestimonial {
  readonly id: string;
  readonly name: string;
  readonly location: string;
  readonly rating: number;
  readonly comment: string;
  readonly featured: boolean;
}

export interface VisitInput {
  readonly page: string;
  readonly referrer?: string | undefined;
  readonly deviceType?: string | undefined;
  readonly browser?: string | undefined;
  readonly os?: string | undefined;
  readonly screen?: string | undefined;
  readonly viewport?: string | undefined;
}

/** What checkout, e-mails and legal pages show about payment: read by everyone. */
export interface PaymentsRepository {
  /** The saved bank transfer details, or null when none have been saved yet. */
  bankDetails(): Promise<BankDetails | null>;
  methods(): Promise<readonly PaymentMethodState[]>;
}

/** Reviews, testimonials and page views: what visitors send in. Submissions always wait for approval. */
export interface EngagementRepository {
  reviewsFor(productId: string, limit?: number): Promise<readonly PublicReview[]>;
  submitReview(input: {
    productId: string;
    name: string;
    email: string;
    rating: number;
    title: string;
    comment: string;
  }): Promise<boolean>;
  featuredTestimonials(limit?: number): Promise<readonly PublicTestimonial[]>;
  submitTestimonial(input: {
    name: string;
    location: string;
    rating: number;
    comment: string;
  }): Promise<boolean>;
  /** Records a page view and returns its id, or null when it could not be recorded. */
  recordVisit(input: VisitInput): Promise<string | null>;
  visitDuration(id: string, seconds: number): Promise<void>;
}

export interface DataLayer {
  readonly engagement: EngagementRepository;
  readonly payments: PaymentsRepository;
  readonly catalogue: CatalogueRepository;
  readonly orders: OrdersRepository;
  readonly contact: ContactRepository;
  readonly auth: AuthRepository;
  readonly account: AccountRepository;
  readonly admin: AdminRepository;
}
