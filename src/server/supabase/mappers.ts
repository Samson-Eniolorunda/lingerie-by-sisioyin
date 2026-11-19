import type {
  ActivityEntry,
  InboxMessage,
  PaymentStatus,
  OrderStatus,
  Profile,
  PromoRecord,
  StaffRole,
  UserStatus,
} from "@/types/account";
import type { AdminProduct } from "@/server/data/contracts";
import type { StoredLine, StoredOrder } from "@/types/orders";
import { num, str } from "./util";

type Row = Record<string, unknown>;

export function productFromRow(row: Row): AdminProduct {
  const name = str(row.name);
  const images = Array.isArray(row.images) ? (row.images as string[]) : [];
  return {
    id: str(row.id),
    slug: str(row.slug),
    name,
    category: str(row.category) as AdminProduct["category"],
    gender: str(row.gender) as AdminProduct["gender"],
    priceNgn: num(row.price_ngn),
    qty: num(row.qty),
    sizes: (row.sizes as AdminProduct["sizes"]) ?? [],
    colours: (row.colors as AdminProduct["colours"]) ?? [],
    variantStock: ((row.variant_stock as Row[]) ?? []).map((v) => ({
      size: str(v.size),
      color: str(v.color),
      qty: num(v.qty),
    })),
    description: str(row.description),
    images: images.map((src) => ({ src, alt: name, width: 800, height: 1000 })),
    isNew: Boolean(row.is_new),
    allowColourSelection: Boolean(row.allow_color_selection),
    deliveryType: str(row.delivery_type) as AdminProduct["deliveryType"],
    packType: str(row.pack_type) || "Single",
    avgRating: num(row.avg_rating),
    reviewCount: num(row.review_count),
    createdAt: str(row.created_at),
    stockVersion: num(row.stock_version),
    active: Boolean(row.is_active),
    deletedAt: row.is_deleted ? str(row.updated_at) : null,
  };
}

export function orderFromRow(row: Row): StoredOrder {
  const items = Array.isArray(row.items) ? (row.items as Row[]) : [];
  const lines: StoredLine[] = items.map((i) => ({
    productId: str(i.product_id),
    name: str(i.name),
    size: str(i.size),
    colour: str(i.colour),
    qty: num(i.qty),
    unitPriceNgn: num(i.unit_price_ngn),
  }));
  return {
    orderNumber: str(row.order_number),
    userId: row.user_id ? str(row.user_id) : null,
    email: str(row.customer_email).toLowerCase(),
    phone: str(row.customer_phone),
    customerName: str(row.customer_name),
    address: str(row.delivery_address),
    city: str(row.delivery_city),
    state: str(row.delivery_state),
    landmark: str(row.landmark),
    lines,
    subtotal: num(row.subtotal),
    discount: num(row.discount_amount),
    delivery: num(row.shipping_cost),
    total: num(row.total),
    promoCode: row.promo_code ? str(row.promo_code) : null,
    status: str(row.status) as OrderStatus,
    paymentStatus: str(row.payment_status) as PaymentStatus,
    receiptPath: row.receipt_path ? str(row.receipt_path) : null,
    receiptReuploadUntil: row.receipt_reupload_until ? str(row.receipt_reupload_until) : null,
    refundAmount:
      row.refund_amount === null || row.refund_amount === undefined ? null : num(row.refund_amount),
    idempotencyKey: str(row.idempotency_key),
    notes: str(row.notes),
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
  };
}

export function profileFromRow(row: Row): Profile {
  const settings = (row.dashboard_settings as Row | null) ?? {};
  const gender = str(settings.gender);
  return {
    id: str(row.id),
    email: str(row.email),
    firstName: str(row.first_name),
    lastName: str(row.last_name),
    phone: str(row.phone),
    dateOfBirth: str(row.date_of_birth),
    gender: (["female", "male", "other"].includes(gender) ? gender : "") as Profile["gender"],
    createdAt: str(row.created_at),
    status: str(row.account_status) as UserStatus,
    deletionRequestedAt: row.deletion_requested_at ? str(row.deletion_requested_at) : null,
  };
}

export function promoFromRow(row: Row): PromoRecord {
  return {
    id: str(row.id),
    code: str(row.code),
    percent: num(row.discount_percent),
    active: Boolean(row.is_active),
    expiresAt: row.expires_at ? str(row.expires_at) : null,
    usageLimit: row.max_uses === null || row.max_uses === undefined ? null : num(row.max_uses),
    usedCount: num(row.used_count),
    createdAt: str(row.created_at),
  };
}

export function messageFromRow(row: Row, replies: Row[]): InboxMessage {
  return {
    id: str(row.id),
    name: str(row.name),
    email: str(row.email),
    phone: str(row.phone),
    subject: str(row.subject),
    orderNumber: str(row.order_number),
    body: str(row.body),
    status: str(row.status) as InboxMessage["status"],
    receivedAt: str(row.created_at),
    replies: replies.map((r) => ({
      id: str(r.id),
      from: "staff" as const,
      author: str(r.author_name),
      body: str(r.body),
      sentAt: str(r.created_at),
    })),
  };
}

export function activityFromRow(row: Row): ActivityEntry {
  const meta = (row.metadata as Row | null) ?? {};
  return {
    id: str(row.id),
    at: str(row.created_at),
    actor: str(meta.admin_name) || "Admin",
    role: (str(meta.admin_role) || "editor") as StaffRole,
    action: str(row.action),
    subject: str(row.subject),
  };
}
