import type { AddressInput, ProfileInput } from "@/schemas/auth";
import type {
  ActivityEntry,
  Address,
  CustomerRecord,
  InboxMessage,
  OrderStatus,
  PromoRecord,
  Profile,
  SessionUser,
  StaffMember,
  StaffRole,
  StoreSettings,
} from "@/types/account";
import type { Product } from "@/types/domain";
import type { StoredOrder } from "@/server/mock/orders";

/**
 * The data-access interface. The pages and server actions depend only on these contracts. Today the
 * mock store in `src/server/mock` implements them; the Supabase implementation drops in later by
 * implementing the same contracts and being returned from `src/server/data/index.ts`.
 */

export type Result<T = undefined> =
  | ({ readonly ok: true } & (T extends undefined ? object : { readonly value: T }))
  | { readonly ok: false; readonly message: string };

export interface AuthRepository {
  signIn(
    email: string,
    password: string,
    audience: "customer" | "staff",
  ): Promise<Result<SessionUser & { token: string }>>;
  signUp(input: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }): Promise<Result<SessionUser & { token: string }>>;
  signInWithGoogle(): Promise<Result>;
  requestPasswordReset(
    email: string,
    audience: "customer" | "staff",
  ): Promise<{ readonly devToken: string | null }>;
  resetPassword(token: string, password: string): Promise<Result>;
  userForToken(
    token: string | undefined,
    audience: "customer" | "staff",
  ): Promise<SessionUser | null>;
  signOut(token: string | undefined): Promise<void>;
}

export interface AccountRepository {
  profile(userId: string): Promise<Profile | null>;
  updateProfile(userId: string, input: ProfileInput): Promise<Result<Profile>>;
  addresses(userId: string): Promise<readonly Address[]>;
  saveAddress(userId: string, input: AddressInput, id?: string): Promise<Result<Address>>;
  deleteAddress(userId: string, id: string): Promise<Result>;
  orders(userId: string): Promise<readonly StoredOrder[]>;
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
}

export interface AdminProduct extends Product {
  readonly active: boolean;
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
  products(): Promise<readonly AdminProduct[]>;
  product(id: string): Promise<AdminProduct | null>;
  createProduct(draft: ProductDraft, actor: SessionUser): Promise<Result<AdminProduct>>;
  updateProduct(id: string, draft: ProductDraft, actor: SessionUser): Promise<Result<AdminProduct>>;
  trashProduct(id: string, actor: SessionUser): Promise<Result>;
  restoreProduct(id: string, actor: SessionUser): Promise<Result>;
  orders(query?: OrderQuery): Promise<readonly StoredOrder[]>;
  order(orderNumber: string): Promise<StoredOrder | null>;
  setOrderStatus(orderNumber: string, status: OrderStatus, actor: SessionUser): Promise<Result>;
  setPaymentDecision(
    orderNumber: string,
    decision: "confirmed" | "rejected",
    actor: SessionUser,
  ): Promise<Result>;
  customers(search?: string): Promise<readonly CustomerRecord[]>;
  setCustomerStatus(
    id: string,
    status: "active" | "suspended" | "banned",
    actor: SessionUser,
  ): Promise<Result>;
  setReturnPrivilege(id: string, allowed: boolean, actor: SessionUser): Promise<Result>;
  promos(): Promise<readonly PromoRecord[]>;
  savePromo(
    input: { code: string; percent: number; expiresAt: string | null; usageLimit: number | null },
    actor: SessionUser,
  ): Promise<Result<PromoRecord>>;
  setPromoActive(id: string, active: boolean, actor: SessionUser): Promise<Result>;
  deletePromo(id: string, actor: SessionUser): Promise<Result>;
  messages(): Promise<readonly InboxMessage[]>;
  markMessage(id: string, status: "read" | "unread"): Promise<Result>;
  replyToMessage(id: string, body: string, actor: SessionUser): Promise<Result>;
  deleteMessage(id: string, actor: SessionUser): Promise<Result>;
  analytics(days: 7 | 30 | 90): Promise<AnalyticsReport>;
  settings(): Promise<StoreSettings>;
  saveSettings(next: StoreSettings, actor: SessionUser): Promise<Result>;
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
  activity(): Promise<readonly ActivityEntry[]>;
}

export interface DataLayer {
  readonly auth: AuthRepository;
  readonly account: AccountRepository;
  readonly admin: AdminRepository;
}
