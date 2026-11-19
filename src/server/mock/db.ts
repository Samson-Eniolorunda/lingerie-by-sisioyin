import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { DEMO } from "@/config/demo";
import { FIXTURE_PRODUCTS } from "@/data/fixtures";
import { formatOrderNumber } from "@/lib/order-number";
import { computeTotals } from "@/lib/pricing";
import type {
  ActivityEntry,
  AdminReview,
  AdminTestimonial,
  Address,
  BankDetails,
  InboxMessage,
  OrderStatus,
  PaymentChange,
  PaymentMethodState,
  Profile,
  PromoRecord,
  StaffRole,
  StoreSettings,
} from "@/types/account";
import type { AdminProduct } from "@/server/data/contracts";
import type { OrphanReceipt, StoredOrder } from "@/types/orders";

/**
 * The development store. Everything here is invented: names use the reserved `example.test` domain
 * and the figures are generated. It stands in for the database until the live schema is captured,
 * and it is replaced by the Supabase implementation of the contracts in `src/server/data`.
 */

export interface UserRecord {
  profile: Profile;
  passwordHash: string;
  role: StaffRole | null;
  addresses: Address[];
  returnPrivilege: boolean;
  /** Only a verified address may claim the guest orders placed with it. */
  emailVerified: boolean;
}

export interface SessionRecord {
  readonly userId: string;
  readonly audience: "customer" | "staff";
}

export interface Db {
  products: AdminProduct[];
  orders: Map<string, StoredOrder>;
  promos: PromoRecord[];
  users: Map<string, UserRecord>;
  sessions: Map<string, SessionRecord>;
  resetTokens: Map<string, { userId: string; audience: "customer" | "staff"; expires: number }>;
  messages: InboxMessage[];
  settings: StoreSettings;
  activity: ActivityEntry[];
  /** Checkouts that failed after the receipt was uploaded. */
  checkoutFailures: OrphanReceipt[];
  reviews: AdminReview[];
  testimonials: AdminTestimonial[];
  /** Staff invitations by token (the development store keeps the token itself). */
  invites: Map<string, { email: string; role: "editor" | "super_admin"; used: boolean }>;
  bank: BankDetails | null;
  paymentMethods: PaymentMethodState[];
  paymentLog: PaymentChange[];
  sequence: number;
  id: number;
}

export { DEMO };

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  return `${salt.toString("hex")}:${scryptSync(password, salt, 32).toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, Buffer.from(salt, "hex"), 32);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function nextId(db: Db, prefix: string): string {
  db.id += 1;
  return `${prefix}-${String(db.id).padStart(4, "0")}`;
}

/** A small deterministic generator so the sample figures are the same on every start. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

const FIRST = [
  "Ada",
  "Tolu",
  "Ife",
  "Kemi",
  "Zainab",
  "Ngozi",
  "Bisi",
  "Chidi",
  "Sade",
  "Halima",
  "Uche",
  "Funmi",
];
const LAST = ["Demo", "Sample", "Test", "Example"];
const STATES = ["Lagos", "Ogun", "Oyo", "Osun", "Ondo", "Ekiti", "Abuja"];

function makeUser(
  db: Db,
  input: {
    email: string;
    first: string;
    last: string;
    password: string;
    role?: StaffRole;
    ageDays: number;
    status?: Profile["status"];
  },
): UserRecord {
  const id = nextId(db, "user");
  const user: UserRecord = {
    profile: {
      id,
      email: input.email,
      firstName: input.first,
      lastName: input.last,
      phone: "",
      dateOfBirth: "",
      gender: "",
      createdAt: new Date(Date.now() - input.ageDays * 86_400_000).toISOString(),
      status: input.status ?? "active",
      deletionRequestedAt: null,
    },
    passwordHash: hashPassword(input.password),
    role: input.role ?? null,
    addresses: [],
    returnPrivilege: true,
    emailVerified: true,
  };
  db.users.set(id, user);
  return user;
}

function seedOrders(db: Db): void {
  const rand = seededRandom(42);
  const customers = [...db.users.values()].filter((u) => u.role === null);
  const products = db.products.filter((p) => p.qty > 0 && p.variantStock.length > 0);
  let index = 0;
  const make = (customer: UserRecord, ageHours: number, status: OrderStatus): void => {
    index += 1;
    const created = new Date(Date.now() - ageHours * 3_600_000);
    const lineCount = 1 + Math.floor(rand() * 2);
    const lines = Array.from({ length: lineCount }, () => {
      const product = products[Math.floor(rand() * products.length)];
      if (!product) throw new Error("seed needs products");
      const variant = product.variantStock[Math.floor(rand() * product.variantStock.length)];
      return {
        productId: product.id,
        name: product.name,
        size: variant?.size ?? "",
        colour: variant?.color ?? "",
        qty: 1 + Math.floor(rand() * 2),
        unitPriceNgn: product.priceNgn,
      };
    });
    const state = STATES[Math.floor(rand() * STATES.length)] ?? "Lagos";
    const totals = computeTotals(
      lines.map((l) => ({ price_ngn: l.unitPriceNgn, qty: l.qty })),
      { stateId: state },
    );
    const number = formatOrderNumber(created, 9000 + index);
    db.orders.set(number, {
      orderNumber: number,
      userId: customer.profile.id,
      email: customer.profile.email,
      phone: "+2348012345678",
      customerName: `${customer.profile.firstName} ${customer.profile.lastName}`,
      address: `${10 + index} Sample Street`,
      city: state === "Abuja" ? "Garki" : "Ikeja",
      state,
      landmark: "",
      lines,
      ...totals,
      promoCode: null,
      status,
      paymentStatus:
        status === "pending"
          ? "awaiting_confirmation"
          : status === "cancelled"
            ? "rejected"
            : "confirmed",
      receiptPath:
        status === "cancelled" ? null : `seed-order-${index}-key00000/receipt-${index}.jpg`,
      receiptReuploadUntil: null,
      idempotencyKey: `seed-order-${index}-key00000`,
      notes: "",
      createdAt: created.toISOString(),
      updatedAt: created.toISOString(),
    });
  };

  const demo = [...db.users.values()].find((u) => u.profile.email === DEMO.customer.email);
  if (demo) {
    make(demo, 24 * 20, "delivered");
    make(demo, 24 * 12, "cancelled");
    make(demo, 24 * 6, "shipped");
    make(demo, 24 * 3, "processing");
  }
  const spread: OrderStatus[] = [
    "delivered",
    "delivered",
    "delivered",
    "shipped",
    "processing",
    "confirmed",
    "pending",
    "cancelled",
  ];
  // A handful of fresh orders awaiting a payment check, so the admin always has work to show.
  customers.slice(0, 8).forEach((customer, i) => make(customer, 2 + i * 5, "pending"));
  for (let i = 0; i < 44; i += 1) {
    const customer = customers[Math.floor(rand() * customers.length)];
    if (!customer) continue;
    const age = 6 + Math.floor(rand() * 24 * 88);
    const status: OrderStatus =
      age < 24 * 2 ? "pending" : (spread[Math.floor(rand() * spread.length)] ?? "delivered");
    make(customer, age, status);
  }
}

function seedMessages(db: Db): void {
  const now = Date.now();
  const entries: Array<[string, string, string, string, InboxMessage["status"], number]> = [
    [
      "Ada Demo",
      "ada.demo@example.test",
      "Sizing help",
      "Please help me choose between 34B and 34C in the lace balconette. I usually wear a 34B in other brands.",
      "unread",
      2,
    ],
    [
      "Tolu Sample",
      "tolu.sample@example.test",
      "Order enquiry",
      "Has my order left the warehouse? I would like it before Friday.",
      "unread",
      9,
    ],
    [
      "Ife Test",
      "ife.test@example.test",
      "Returns and exchanges",
      "The size was too small. May I exchange it for a larger one?",
      "read",
      30,
    ],
    [
      "Kemi Example",
      "kemi.example@example.test",
      "Wholesale enquiry",
      "Do you supply boutiques outside Lagos, and what is the minimum order?",
      "replied",
      70,
    ],
  ];
  entries.forEach(([name, email, subject, body, status, hours], i) => {
    const receivedAt = new Date(now - hours * 3_600_000).toISOString();
    db.messages.push({
      id: nextId(db, "msg"),
      name,
      email,
      phone: "",
      subject,
      orderNumber: "",
      body,
      status,
      receivedAt,
      replies:
        status === "replied"
          ? [
              {
                id: `reply-${i}`,
                from: "staff",
                author: "Owner",
                body: "Thank you for writing. We do supply boutiques; please send us your location and we will share the terms.",
                sentAt: new Date(now - (hours - 4) * 3_600_000).toISOString(),
              },
            ]
          : [],
    });
  });
}

export function buildDb(): Db {
  const now = new Date().toISOString();
  const db: Db = {
    products: FIXTURE_PRODUCTS.map((p) => ({ ...p, active: true, deletedAt: null })),
    orders: new Map(),
    promos: [
      {
        id: "promo-1",
        code: "WELCOME10",
        percent: 10,
        active: true,
        expiresAt: null,
        usageLimit: null,
        usedCount: 0,
        createdAt: now,
      },
      {
        id: "promo-2",
        code: "ONEUSE",
        percent: 20,
        active: true,
        expiresAt: null,
        usageLimit: 1,
        usedCount: 0,
        createdAt: now,
      },
      {
        id: "promo-3",
        code: "EXPIRED",
        percent: 15,
        active: true,
        expiresAt: "2020-01-01T00:00:00.000Z",
        usageLimit: null,
        usedCount: 0,
        createdAt: now,
      },
    ],
    users: new Map(),
    sessions: new Map(),
    resetTokens: new Map(),
    messages: [],
    settings: {
      announcement: "Delivery to Lagos, Ogun, Oyo, Osun, Ondo, Ekiti and Abuja",
      whatsappNumber: "2349033344860",
      supportEmail: "support@lingeriebysisioyin.store",
      lowStockThreshold: 5,
      notifyNewOrders: true,
    },
    activity: [],
    // Demonstration details only (the development store). A live shop shows what its owner saved.
    bank: {
      bankName: "Moniepoint Microfinance Bank",
      accountNumber: "6327082294",
      accountName: "Oyindamola Adelugba (LingeriesBySisioyin)",
      note: "",
    },
    paymentMethods: [
      { method: "bank_transfer", enabled: true, connected: true },
      { method: "paystack", enabled: false, connected: false },
      { method: "flutterwave", enabled: false, connected: false },
    ],
    paymentLog: [],
    checkoutFailures: [],
    reviews: [
      {
        id: "rev-1",
        productId: FIXTURE_PRODUCTS[0]?.id ?? "",
        productName: FIXTURE_PRODUCTS[0]?.name ?? "A product",
        name: "Ada Demo",
        email: "ada.demo@example.test",
        rating: 5,
        title: "Lovely fit",
        comment: "Soft, supportive and true to size.",
        approved: false,
        createdAt: now,
      },
      {
        id: "rev-2",
        productId: FIXTURE_PRODUCTS[1]?.id ?? "",
        productName: FIXTURE_PRODUCTS[1]?.name ?? "A product",
        name: "Tolu Sample",
        email: "tolu.sample@example.test",
        rating: 4,
        title: "",
        comment: "Arrived quickly and well packed.",
        approved: true,
        createdAt: now,
      },
    ],
    testimonials: [
      {
        id: "tes-1",
        name: "Ife Test",
        location: "Lagos",
        rating: 5,
        comment: "My go-to shop for comfortable lingerie.",
        approved: false,
        featured: false,
        createdAt: now,
      },
    ],
    invites: new Map(),
    sequence: 0,
    id: 0,
  };
  makeUser(db, {
    email: DEMO.customer.email,
    first: "Demo",
    last: "Customer",
    password: DEMO.customer.password,
    ageDays: 40,
  });
  makeUser(db, {
    email: DEMO.owner.email,
    first: "Demo",
    last: "Owner",
    password: DEMO.owner.password,
    role: "owner",
    ageDays: 200,
  });
  makeUser(db, {
    email: DEMO.editor.email,
    first: "Demo",
    last: "Editor",
    password: DEMO.editor.password,
    role: "editor",
    ageDays: 60,
  });
  FIRST.forEach((first, i) => {
    const last = LAST[i % LAST.length] ?? "Demo";
    makeUser(db, {
      email: `${first.toLowerCase()}.${last.toLowerCase()}@example.test`,
      first,
      last,
      password: "Sample-Pass1!",
      ageDays: 5 + i * 7,
      status: i === 10 ? "suspended" : "active",
    });
  });
  seedOrders(db);
  seedMessages(db);
  return db;
}

declare global {
  var __lbsMockDb: Db | undefined;
}

/** One instance per server process, shared by pages and server actions. */
export function getDb(): Db {
  globalThis.__lbsMockDb ??= buildDb();
  return globalThis.__lbsMockDb;
}

export function resetDb(): Db {
  globalThis.__lbsMockDb = buildDb();
  return globalThis.__lbsMockDb;
}
