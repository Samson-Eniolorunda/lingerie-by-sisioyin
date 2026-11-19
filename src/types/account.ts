/** Shapes shared by the account area, the admin and the data-access contracts. */

export type UserStatus = "active" | "suspended" | "banned" | "deleted";
export type StaffRole = "owner" | "super_admin" | "developer" | "editor";
export type OrderStatus =
  "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled";
export type PaymentStatus =
  "awaiting_confirmation" | "confirmed" | "rejected" | "refund_check" | "refund_owed" | "refunded";

export const ORDER_STATUSES: readonly OrderStatus[] = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
];

export interface Profile {
  readonly id: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly phone: string;
  readonly dateOfBirth: string;
  readonly gender: "" | "female" | "male" | "other";
  readonly createdAt: string;
  readonly status: UserStatus;
  readonly deletionRequestedAt: string | null;
}

export interface Address {
  readonly id: string;
  readonly label: string;
  readonly recipient: string;
  readonly phone: string;
  readonly line1: string;
  readonly city: string;
  readonly state: string;
  readonly isDefault: boolean;
}

/** The person behind a session: a customer, or a member of staff with a role. */
export interface SessionUser {
  readonly id: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly role: StaffRole | null;
}

export type MessageStatus = "unread" | "read" | "replied";

export interface MessageReply {
  readonly id: string;
  readonly from: "customer" | "staff";
  readonly author: string;
  readonly body: string;
  readonly sentAt: string;
}

export interface InboxMessage {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly phone: string;
  readonly subject: string;
  readonly orderNumber: string;
  readonly body: string;
  readonly status: MessageStatus;
  readonly receivedAt: string;
  readonly replies: readonly MessageReply[];
}

export interface PromoRecord {
  readonly id: string;
  readonly code: string;
  readonly percent: number;
  readonly active: boolean;
  readonly expiresAt: string | null;
  readonly usageLimit: number | null;
  readonly usedCount: number;
  readonly createdAt: string;
}

export interface CustomerRecord {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly phone: string;
  readonly createdAt: string;
  readonly status: UserStatus;
  readonly orderCount: number;
  readonly totalSpentNgn: number;
  readonly returnPrivilege: boolean;
}

export interface StaffMember {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: StaffRole;
  readonly createdAt: string;
}

/** The bank transfer details customers are shown at checkout (stored in the database). */
export interface BankDetails {
  readonly bankName: string;
  readonly accountNumber: string;
  readonly accountName: string;
  /** An optional line shown with the details, for example "Use your order number as the reference". */
  readonly note: string;
}

export type PaymentMethodId = "bank_transfer" | "paystack" | "flutterwave";

export interface PaymentMethodState {
  readonly method: PaymentMethodId;
  readonly enabled: boolean;
  /** True only once a gateway is really integrated (set by the developer, never from the admin). */
  readonly connected: boolean;
}

export interface PaymentChange {
  readonly id: string;
  readonly at: string;
  readonly by: string;
  readonly entity: "bank_details" | "payment_method";
  readonly key: string;
  readonly oldValue: Record<string, unknown> | null;
  readonly newValue: Record<string, unknown>;
}

export interface StoreSettings {
  readonly announcement: string;
  readonly whatsappNumber: string;
  readonly supportEmail: string;
  readonly lowStockThreshold: number;
  readonly notifyNewOrders: boolean;
}

export interface ActivityEntry {
  readonly id: string;
  readonly at: string;
  readonly actor: string;
  readonly role: StaffRole;
  readonly action: string;
  readonly subject: string;
}
