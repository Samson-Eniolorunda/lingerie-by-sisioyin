import { randomBytes } from "node:crypto";
import { canTransition } from "@/lib/order-rules";
import { REUPLOAD_HOURS, applyCancellation } from "./orders";
import { deriveStock } from "@/lib/variants";
import { isProtectedRole } from "@/lib/permissions";
import type {
  AdminRepository,
  AdminProduct,
  AnalyticsReport,
  ProductDraft,
  Tally,
} from "@/server/data/contracts";
import type { CustomerRecord, OrderStatus, SessionUser } from "@/types/account";
import { ORDER_STATUSES } from "@/types/account";
import type { StoredOrder } from "@/types/orders";
import { getDb, nextId, seededRandom, type Db } from "./db";

function log(db: Db, actor: SessionUser, action: string, subject: string): void {
  db.activity.unshift({
    id: nextId(db, "act"),
    at: new Date().toISOString(),
    actor: `${actor.firstName} ${actor.lastName}`.trim() || actor.email,
    role: actor.role ?? "editor",
    action,
    subject,
  });
}

function slugify(name: string, taken: readonly string[]): string {
  const base =
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "product";
  let slug = base;
  let n = 2;
  while (taken.includes(slug)) slug = `${base}-${n++}`;
  return slug;
}

function applyDraft(
  draft: ProductDraft,
  base: Pick<AdminProduct, "id" | "slug" | "createdAt" | "avgRating" | "reviewCount">,
): AdminProduct {
  const stock = deriveStock(draft.variants, draft.allowColourSelection);
  return {
    ...base,
    name: draft.name,
    category: draft.category,
    gender: draft.gender,
    priceNgn: draft.priceNgn,
    description: draft.description,
    deliveryType: draft.deliveryType,
    isNew: draft.isNew,
    active: draft.active,
    deletedAt: null,
    allowColourSelection: draft.allowColourSelection,
    packType: draft.allowColourSelection ? "Single" : draft.packType,
    ...stock,
    images: draft.images.map((image) => ({
      src: image.src,
      alt: image.alt || `${draft.name}`,
      width: 800,
      height: 1000,
    })),
  };
}

/** One pass over the orders, grouped by account and by email, instead of one pass per customer. */
function ordersByOwner(db: Db): {
  byUser: Map<string, StoredOrder[]>;
  byEmail: Map<string, StoredOrder[]>;
} {
  const byUser = new Map<string, StoredOrder[]>();
  const byEmail = new Map<string, StoredOrder[]>();
  for (const order of db.orders.values()) {
    const map = order.userId !== null ? byUser : byEmail;
    const key = order.userId ?? order.email;
    map.set(key, [...(map.get(key) ?? []), order]);
  }
  return { byUser, byEmail };
}

function customerRows(db: Db): CustomerRecord[] {
  const { byUser, byEmail } = ordersByOwner(db);
  return [...db.users.values()]
    .filter((u) => u.role === null && u.profile.status !== "deleted")
    .map((u) => {
      const orders = [
        ...(byUser.get(u.profile.id) ?? []),
        ...(u.emailVerified ? (byEmail.get(u.profile.email) ?? []) : []),
      ];
      return {
        id: u.profile.id,
        name: `${u.profile.firstName} ${u.profile.lastName}`.trim(),
        email: u.profile.email,
        phone: u.profile.phone,
        createdAt: u.profile.createdAt,
        status: u.profile.status,
        orderCount: orders.length,
        totalSpentNgn: orders
          .filter((o) => o.status === "delivered")
          .reduce((n, o) => n + o.total, 0),
        returnPrivilege: u.returnPrivilege,
      };
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function tally(entries: Iterable<[string, number]>, limit: number): Tally[] {
  return [...entries]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, value]) => ({ label, value }));
}

const PAGES: readonly [string, number][] = [
  ["/", 38],
  ["/shop", 26],
  ["/products/lace-balconette-bra", 9],
  ["/cart", 7],
  ["/checkout", 5],
  ["/faq", 4],
  ["/size", 4],
  ["/contact", 3],
];

function buildAnalytics(db: Db, days: 7 | 30 | 90): AnalyticsReport {
  const DAY = 86_400_000;
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const series = Array.from({ length: days }, (_, i) => {
    const date = new Date(start.getTime() - (days - 1 - i) * DAY);
    const key = date.toISOString().slice(0, 10);
    const dayOrders = [...db.orders.values()].filter((o) => o.createdAt.slice(0, 10) === key);
    const rand = seededRandom(date.getTime() / DAY);
    return {
      date: key,
      views: 60 + Math.floor(rand() * 140) + dayOrders.length * 20,
      orders: dayOrders.length,
      revenueNgn: dayOrders
        .filter((o) => o.status === "delivered")
        .reduce((n, o) => n + o.total, 0),
    };
  });
  const allOrders = [...db.orders.values()];
  const customers = [...db.users.values()].filter((u) => u.role === null).length;
  const pageViews = series.reduce((n, d) => n + d.views, 0);
  const productUnits = new Map<string, number>();
  for (const o of allOrders) {
    if (o.status === "cancelled") continue;
    for (const l of o.lines) productUnits.set(l.name, (productUnits.get(l.name) ?? 0) + l.qty);
  }
  const statusCount = new Map<string, number>();
  for (const o of allOrders) statusCount.set(o.status, (statusCount.get(o.status) ?? 0) + 1);
  const stateCount = new Map<string, number>();
  for (const o of allOrders) stateCount.set(o.state, (stateCount.get(o.state) ?? 0) + 1);
  const scale = pageViews / 100;
  return {
    days,
    sample: true,
    pageViews,
    customers,
    orders: allOrders.length,
    revenueNgn: allOrders.filter((o) => o.status === "delivered").reduce((n, o) => n + o.total, 0),
    conversionPercent: customers === 0 ? 0 : Math.round((allOrders.length / customers) * 1000) / 10,
    series,
    statusBreakdown: tally(statusCount, 6),
    topPages: PAGES.map(([label, share]) => ({ label, value: Math.round(share * scale) })),
    topProducts: tally(productUnits, 10),
    devices: [
      { label: "Mobile", value: Math.round(86 * scale) },
      { label: "Desktop", value: Math.round(11 * scale) },
      { label: "Tablet", value: Math.round(3 * scale) },
    ],
    browsers: [
      { label: "Chrome", value: Math.round(68 * scale) },
      { label: "Safari", value: Math.round(22 * scale) },
      { label: "Samsung Internet", value: Math.round(6 * scale) },
      { label: "Other", value: Math.round(4 * scale) },
    ],
    states: tally(stateCount, 8),
  };
}

type Staffable = Exclude<import("@/types/account").StaffRole, "owner" | "developer">;

export const mockAdmin: AdminRepository = {
  async summary() {
    const db = getDb();
    const orders = [...db.orders.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const live = db.products.filter((p) => p.deletedAt === null);
    return {
      productCount: live.length,
      orderCount: orders.length,
      revenueNgn: orders.filter((o) => o.status === "delivered").reduce((n, o) => n + o.total, 0),
      pendingOrders: orders.filter((o) => o.status === "pending").length,
      unreadMessages: db.messages.filter((m) => m.status === "unread").length,
      recentOrders: orders.slice(0, 5),
      lowStock: live
        .filter((p) => p.qty < 10)
        .sort((a, b) => a.qty - b.qty)
        .slice(0, 5),
    };
  },

  async products(query, page) {
    const needle = query.search?.trim().toLowerCase() ?? "";
    const all = [...getDb().products]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .filter((p) => (query.trash ? p.deletedAt !== null : p.deletedAt === null))
      .filter((p) => (query.category ? p.category === query.category : true))
      .filter((p) =>
        query.stock === "out"
          ? p.qty === 0
          : query.stock === "in"
            ? p.qty > 0
            : query.stock === "low"
              ? p.qty < 10
              : true,
      )
      .filter(
        (p) =>
          needle === "" ||
          [p.name, p.category, p.description].some((f) => f.toLowerCase().includes(needle)),
      );
    return { items: all.slice(page.offset, page.offset + page.limit), total: all.length };
  },

  async productCounts() {
    const all = getDb().products;
    const trashed = all.filter((p) => p.deletedAt !== null).length;
    return { live: all.length - trashed, trashed };
  },

  async product(id) {
    return getDb().products.find((p) => p.id === id) ?? null;
  },

  async createProduct(draft, actor) {
    const db = getDb();
    const id = nextId(db, "product");
    const product = applyDraft(draft, {
      id,
      slug: slugify(
        draft.name,
        db.products.map((p) => p.slug),
      ),
      createdAt: new Date().toISOString(),
      avgRating: 0,
      reviewCount: 0,
    });
    db.products.unshift(product);
    log(db, actor, "create", product.name);
    return { ok: true, value: product };
  },

  async updateProduct(id, draft, actor) {
    const db = getDb();
    const index = db.products.findIndex((p) => p.id === id);
    const current = db.products[index];
    if (!current) return { ok: false, message: "That product no longer exists." };
    const product = applyDraft(draft, current);
    db.products[index] = product;
    log(db, actor, "update", product.name);
    return { ok: true, value: product };
  },

  async trashProduct(id, actor) {
    const db = getDb();
    const index = db.products.findIndex((p) => p.id === id);
    const current = db.products[index];
    if (!current) return { ok: false, message: "That product no longer exists." };
    db.products[index] = { ...current, deletedAt: new Date().toISOString() };
    log(db, actor, "delete", current.name);
    return { ok: true };
  },

  async restoreProduct(id, actor) {
    const db = getDb();
    const index = db.products.findIndex((p) => p.id === id);
    const current = db.products[index];
    if (!current) return { ok: false, message: "That product no longer exists." };
    db.products[index] = { ...current, deletedAt: null };
    log(db, actor, "restore", current.name);
    return { ok: true };
  },

  async deleteProductForever(id, actor) {
    const db = getDb();
    const current = db.products.find((p) => p.id === id);
    if (!current) return { ok: false, message: "That product no longer exists." };
    if (current.deletedAt === null)
      return { ok: false, message: "Move the product to the trash before deleting it for good." };
    db.products = db.products.filter((p) => p.id !== id);
    log(db, actor, "permanent delete", current.name);
    return { ok: true };
  },

  async emptyTrash(actor) {
    const db = getDb();
    const removed = db.products.filter((p) => p.deletedAt !== null).length;
    db.products = db.products.filter((p) => p.deletedAt === null);
    log(db, actor, "empty trash", `${removed} products`);
    return { ok: true, value: { removed } };
  },

  async orders(query, page) {
    const needle = query.search?.trim().toLowerCase() ?? "";
    const all = [...getDb().orders.values()]
      .filter((o) => (query.status ? o.status === query.status : true))
      .filter(
        (o) =>
          needle === "" ||
          [o.orderNumber, o.customerName, o.email].some((f) => f.toLowerCase().includes(needle)),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { items: all.slice(page.offset, page.offset + page.limit), total: all.length };
  },

  async orderCounts() {
    const counts = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0])) as Record<
      OrderStatus,
      number
    >;
    for (const o of getDb().orders.values()) counts[o.status] += 1;
    return counts;
  },

  async order(orderNumber) {
    return getDb().orders.get(orderNumber) ?? null;
  },

  async setOrderStatus(orderNumber, status: OrderStatus, actor) {
    const db = getDb();
    const order = db.orders.get(orderNumber);
    if (!order) return { ok: false, message: "That order no longer exists." };
    if (!canTransition(order.status, status))
      return {
        ok: false,
        message: `An order that is ${order.status} cannot be moved to ${status}.`,
      };
    // Payment is confirmed only through the payment decision, never by moving the status.
    if (status === "confirmed")
      return { ok: false, message: "Confirm the payment from the receipt check instead." };
    const now = new Date();
    if (status === "cancelled") {
      if (!applyCancellation(db, order, now))
        return { ok: false, message: "That order was already cancelled." };
    } else {
      db.orders.set(orderNumber, { ...order, status, updatedAt: now.toISOString() });
    }
    log(db, actor, "order status", `${orderNumber} to ${status}`);
    return { ok: true };
  },

  async setPaymentDecision(orderNumber, decision, actor) {
    const db = getDb();
    const order = db.orders.get(orderNumber);
    if (!order) return { ok: false, message: "That order no longer exists." };
    if (order.status !== "pending" || order.paymentStatus !== "awaiting_confirmation")
      return {
        ok: false,
        message: "Payment can only be checked on a pending order that has a receipt waiting.",
      };
    const now = new Date();
    db.orders.set(
      orderNumber,
      decision === "confirmed"
        ? {
            ...order,
            status: "confirmed",
            paymentStatus: "confirmed",
            receiptReuploadUntil: null,
            updatedAt: now.toISOString(),
          }
        : {
            ...order,
            status: "pending",
            paymentStatus: "rejected",
            receiptReuploadUntil: new Date(
              now.getTime() + REUPLOAD_HOURS * 3_600_000,
            ).toISOString(),
            updatedAt: now.toISOString(),
          },
    );
    log(
      db,
      actor,
      decision === "confirmed" ? "payment confirmed" : "receipt rejected",
      orderNumber,
    );
    return { ok: true };
  },

  async customers(search, page) {
    const needle = search.trim().toLowerCase();
    const all = customerRows(getDb()).filter(
      (c) =>
        needle === "" || [c.name, c.email, c.phone].some((f) => f.toLowerCase().includes(needle)),
    );
    return { items: all.slice(page.offset, page.offset + page.limit), total: all.length };
  },

  async customerStats(since) {
    const all = customerRows(getDb());
    return {
      total: all.length,
      newSince: all.filter((c) => new Date(c.createdAt).getTime() >= since.getTime()).length,
      withOrders: all.filter((c) => c.orderCount > 0).length,
    };
  },

  async setCustomerStatus(id, status, actor) {
    const db = getDb();
    const user = db.users.get(id);
    if (!user || user.role !== null) return { ok: false, message: "That customer was not found." };
    user.profile = { ...user.profile, status };
    if (status !== "active") {
      for (const [token, record] of db.sessions)
        if (record.userId === id) db.sessions.delete(token);
    }
    log(
      db,
      actor,
      status === "active" ? "customer reactivated" : `customer ${status}`,
      user.profile.email,
    );
    return { ok: true };
  },

  async setReturnPrivilege(id, allowed, actor) {
    const db = getDb();
    const user = db.users.get(id);
    if (!user || user.role !== null) return { ok: false, message: "That customer was not found." };
    user.returnPrivilege = allowed;
    log(
      db,
      actor,
      allowed ? "return privilege restored" : "return privilege revoked",
      user.profile.email,
    );
    return { ok: true };
  },

  async deleteCustomer(id, actor) {
    const db = getDb();
    const user = db.users.get(id);
    if (!user || user.role !== null) return { ok: false, message: "That customer was not found." };
    // Orders are kept and de-linked; the profile, addresses and sessions go (MC-12).
    for (const [token, record] of db.sessions) if (record.userId === id) db.sessions.delete(token);
    db.users.delete(id);
    log(db, actor, "customer deleted", user.profile.email);
    return { ok: true };
  },

  async promos(page) {
    const all = [...getDb().promos].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { items: all.slice(page.offset, page.offset + page.limit), total: all.length };
  },

  async savePromo(input, actor) {
    const db = getDb();
    const code = input.code.trim().toUpperCase();
    if (db.promos.some((p) => p.code === code))
      return { ok: false, message: "A promo code with that name already exists." };
    const promo = {
      id: nextId(db, "promo"),
      code,
      percent: input.percent,
      active: true,
      expiresAt: input.expiresAt,
      usageLimit: input.usageLimit,
      usedCount: 0,
      createdAt: new Date().toISOString(),
    };
    db.promos.unshift(promo);
    log(db, actor, "promo created", code);
    return { ok: true, value: promo };
  },

  async setPromoActive(id, active, actor) {
    const db = getDb();
    const index = db.promos.findIndex((p) => p.id === id);
    const promo = db.promos[index];
    if (!promo) return { ok: false, message: "That promo code no longer exists." };
    db.promos[index] = { ...promo, active };
    log(db, actor, active ? "promo switched on" : "promo switched off", promo.code);
    return { ok: true };
  },

  async deletePromo(id, actor) {
    const db = getDb();
    const promo = db.promos.find((p) => p.id === id);
    if (!promo) return { ok: false, message: "That promo code no longer exists." };
    db.promos = db.promos.filter((p) => p.id !== id);
    log(db, actor, "promo deleted", promo.code);
    return { ok: true };
  },

  async messages(query, page) {
    const needle = query.search?.trim().toLowerCase() ?? "";
    const all = [...getDb().messages]
      .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
      .filter((m) => (query.status ? m.status === query.status : true))
      .filter(
        (m) =>
          needle === "" ||
          [m.name, m.email, m.body, m.orderNumber, m.subject].some((f) =>
            f.toLowerCase().includes(needle),
          ),
      );
    return { items: all.slice(page.offset, page.offset + page.limit), total: all.length };
  },

  async messageCounts() {
    const all = getDb().messages;
    const count = (status: string) => all.filter((m) => m.status === status).length;
    return {
      all: all.length,
      unread: count("unread"),
      read: count("read"),
      replied: count("replied"),
    };
  },

  async message(id) {
    return getDb().messages.find((m) => m.id === id) ?? null;
  },

  async markMessage(id, status, actor) {
    const db = getDb();
    const index = db.messages.findIndex((m) => m.id === id);
    const message = db.messages[index];
    if (!message) return { ok: false, message: "That message no longer exists." };
    db.messages[index] = {
      ...message,
      status: message.status === "replied" && status === "read" ? "replied" : status,
    };
    log(
      db,
      actor,
      status === "read" ? "message marked read" : "message marked unread",
      message.email,
    );
    return { ok: true };
  },

  async replyToMessage(id, body, actor) {
    const db = getDb();
    const index = db.messages.findIndex((m) => m.id === id);
    const message = db.messages[index];
    if (!message) return { ok: false, message: "That message no longer exists." };
    db.messages[index] = {
      ...message,
      status: "replied",
      replies: [
        ...message.replies,
        {
          id: nextId(db, "reply"),
          from: "staff",
          author: actor.firstName || "Staff",
          body,
          sentAt: new Date().toISOString(),
        },
      ],
    };
    log(db, actor, "message reply", message.email);
    return { ok: true };
  },

  async deleteMessage(id, actor) {
    const db = getDb();
    const message = db.messages.find((m) => m.id === id);
    if (!message) return { ok: false, message: "That message no longer exists." };
    db.messages = db.messages.filter((m) => m.id !== id);
    log(db, actor, "message deleted", message.email);
    return { ok: true };
  },

  async analytics(days) {
    return buildAnalytics(getDb(), days);
  },

  async settings() {
    return getDb().settings;
  },

  async saveSettings(next, actor) {
    const db = getDb();
    db.settings = next;
    log(db, actor, "settings saved", "store settings");
    return { ok: true };
  },

  async staff() {
    const rank = { owner: 0, developer: 1, super_admin: 2, editor: 3 } as const;
    return [...getDb().users.values()]
      .filter((u) => u.role !== null)
      .map((u) => ({
        id: u.profile.id,
        name: `${u.profile.firstName} ${u.profile.lastName}`.trim(),
        email: u.profile.email,
        role: u.role ?? ("editor" as const),
        createdAt: u.profile.createdAt,
      }))
      .sort((a, b) => rank[a.role] - rank[b.role] || a.createdAt.localeCompare(b.createdAt));
  },

  async setStaffRole(id, role: Staffable, actor) {
    const db = getDb();
    const user = db.users.get(id);
    if (!user || user.role === null)
      return { ok: false, message: "That member of staff was not found." };
    if (isProtectedRole(user.role))
      return { ok: false, message: "Owner and developer accounts are protected." };
    if (user.profile.id === actor.id)
      return { ok: false, message: "You cannot change your own role." };
    user.role = role;
    log(db, actor, role === "editor" ? "staff demoted" : "staff promoted", user.profile.email);
    return { ok: true };
  },

  async removeStaff(id, actor) {
    const db = getDb();
    const user = db.users.get(id);
    if (!user || user.role === null)
      return { ok: false, message: "That member of staff was not found." };
    if (isProtectedRole(user.role))
      return { ok: false, message: "Owner and developer accounts are protected." };
    if (user.profile.id === actor.id) return { ok: false, message: "You cannot remove yourself." };
    user.role = null;
    for (const [token, record] of db.sessions)
      if (record.userId === id && record.audience === "staff") db.sessions.delete(token);
    log(db, actor, "staff removed", user.profile.email);
    return { ok: true };
  },

  async inviteStaff(email, role: Staffable, actor) {
    const db = getDb();
    const token = randomBytes(16).toString("hex");
    log(db, actor, "invitation", `${email} as ${role}`);
    return { ok: true, value: { link: `/admin/sign-in?invite=${token}` } };
  },

  async activity(search, page) {
    const needle = search.trim().toLowerCase();
    const all = getDb().activity.filter(
      (a) =>
        needle === "" ||
        [a.actor, a.action, a.subject].some((f) => f.toLowerCase().includes(needle)),
    );
    return { items: all.slice(page.offset, page.offset + page.limit), total: all.length };
  },
};
