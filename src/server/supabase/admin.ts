import { deriveStock } from "@/lib/variants";
import { BANK, CONTACT } from "@/config/site";
import {
  ORDER_STATUSES,
  type OrderStatus,
  type SessionUser,
  type StoreSettings,
} from "@/types/account";
import type {
  AdminProduct,
  AdminRepository,
  AnalyticsReport,
  ProductDraft,
  Tally,
} from "@/server/data/contracts";
import { receipts } from "@/server/storage/receipts";
import { serviceClient, sessionClient } from "./clients";
import {
  activityFromRow,
  messageFromRow,
  orderFromRow,
  productFromRow,
  promoFromRow,
} from "./mappers";
import {
  failResult,
  isUuid,
  likeTerm,
  must,
  num,
  okResult,
  str,
  TRY_AGAIN,
  valueResult,
} from "./util";

type Row = Record<string, unknown>;
type Staffable = "super_admin" | "editor";

/** Everything here runs as the signed-in member of staff; row level security and the SQL functions check the permission again. */
const staff = () => sessionClient("staff");

/** The wording of our own SQL exceptions is written for people; anything else is generic. */
function sqlMessage(error: { code?: string; message?: string }): string {
  return ["42501", "P0002", "22023"].includes(error.code ?? "") && error.message
    ? error.message
    : TRY_AGAIN;
}

async function log(
  actor: SessionUser,
  entity: string,
  action: string,
  subject: string,
  entityId?: string,
): Promise<void> {
  // The database fills in who did it; a failed log line must not undo the change that was made.
  await (await staff()).from("admin_activity_logs").insert({
    action,
    entity,
    subject,
    entity_id: entityId ?? null,
    metadata: { actor_email: actor.email },
  });
}

function slugify(name: string, taken: ReadonlySet<string>): string {
  const base =
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "product";
  let slug = base;
  let n = 2;
  while (taken.has(slug)) slug = `${base}-${n++}`;
  return slug;
}

function draftColumns(draft: ProductDraft) {
  const stock = deriveStock(draft.variants, draft.allowColourSelection);
  return {
    name: draft.name,
    category: draft.category,
    gender: draft.gender,
    price_ngn: draft.priceNgn,
    qty: stock.qty,
    sizes: stock.sizes,
    colors: stock.colours,
    variant_stock: stock.variantStock,
    description: draft.description,
    images: draft.images.map((i) => i.src),
    is_active: draft.active,
    is_new: draft.isNew,
    allow_color_selection: draft.allowColourSelection,
    delivery_type: draft.deliveryType,
    pack_type: draft.allowColourSelection ? "Single" : draft.packType,
  };
}

const defaultSettings = (): StoreSettings => ({
  announcement: "",
  whatsappNumber: CONTACT.whatsappNumber,
  supportEmail: CONTACT.email,
  bankName: BANK.bankName,
  accountNumber: BANK.accountNumber,
  accountName: BANK.accountName,
  lowStockThreshold: 5,
  notifyNewOrders: true,
});

const tallies = (value: unknown): Tally[] =>
  ((value as Row[] | null) ?? []).map((t) => ({ label: str(t.label), value: num(t.value) }));

async function repliesFor(ids: readonly string[]): Promise<Map<string, Row[]>> {
  const map = new Map<string, Row[]>();
  if (ids.length === 0) return map;
  const rows = must(
    await (
      await staff()
    )
      .from("contact_replies")
      .select("*")
      .in("message_id", [...ids])
      .order("created_at", { ascending: true }),
  );
  for (const r of rows) map.set(str(r.message_id), [...(map.get(str(r.message_id)) ?? []), r]);
  return map;
}

export const supabaseAdmin: AdminRepository = {
  async summary() {
    const client = await staff();
    const { data, error } = await client.rpc("admin_summary");
    if (error) throw new Error(`Database read failed: ${error.message}`);
    const s = data as Row;
    const recent = must(
      await client.from("orders").select("*").order("created_at", { ascending: false }).limit(5),
    );
    const low = must(
      await client
        .from("products")
        .select("*")
        .eq("is_deleted", false)
        .lt("qty", 10)
        .order("qty", { ascending: true })
        .limit(5),
    );
    return {
      productCount: num(s.product_count),
      orderCount: num(s.order_count),
      revenueNgn: num(s.revenue),
      pendingOrders: num(s.pending_orders),
      unreadMessages: num(s.unread_messages),
      recentOrders: recent.map(orderFromRow),
      lowStock: low.map(productFromRow),
    };
  },

  async products(query, page) {
    let request = (await staff())
      .from("products")
      .select("*", { count: "exact" })
      .eq("is_deleted", Boolean(query.trash))
      .order("created_at", { ascending: false })
      .range(page.offset, page.offset + page.limit - 1);
    if (query.category) request = request.eq("category", query.category);
    if (query.stock === "out") request = request.eq("qty", 0);
    if (query.stock === "in") request = request.gt("qty", 0);
    if (query.stock === "low") request = request.lt("qty", 10);
    const term = likeTerm(query.search ?? "");
    if (term)
      request = request.or(
        `name.ilike.%${term}%,category.ilike.%${term}%,description.ilike.%${term}%`,
      );
    const { data, error, count } = await request;
    if (error) throw new Error(`Database read failed: ${error.message}`);
    return { items: (data ?? []).map(productFromRow), total: count ?? 0 };
  },

  async productCounts() {
    const client = await staff();
    const count = async (trashed: boolean) => {
      const { count: n, error } = await client
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("is_deleted", trashed);
      if (error) throw new Error(`Database read failed: ${error.message}`);
      return n ?? 0;
    };
    const [live, trashed] = await Promise.all([count(false), count(true)]);
    return { live, trashed };
  },

  async product(id) {
    if (!isUuid(id)) return null;
    const rows = must(await (await staff()).from("products").select("*").eq("id", id).limit(1));
    return rows[0] ? productFromRow(rows[0]) : null;
  },

  async createProduct(draft, actor) {
    const client = await staff();
    const base = slugify(draft.name, new Set());
    const existing = must(await client.from("products").select("slug").like("slug", `${base}%`));
    const taken = new Set(existing.map((r) => str(r.slug)));
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const slug = slugify(draft.name, taken);
      const { data, error } = await client
        .from("products")
        .insert({ ...draftColumns(draft), slug })
        .select("*")
        .limit(1);
      if (error?.code === "23505") {
        taken.add(slug);
        continue;
      }
      const row = data?.[0];
      if (error || !row) return failResult(sqlMessage(error ?? {}));
      const product = productFromRow(row);
      await log(actor, "product", "create", product.name, product.id);
      return valueResult<AdminProduct>(product);
    }
    return failResult(TRY_AGAIN);
  },

  async updateProduct(id, draft, actor) {
    if (!isUuid(id)) return failResult("That product no longer exists.");
    const client = await staff();
    const { qty, sizes, colors, variant_stock, ...details } = draftColumns(draft);
    if (draft.stockVersion === undefined)
      return failResult("Please reload the product and try again.");
    // Stock moves while the form is open (every order takes some), so it is written only if the
    // version the form was loaded with is still current; the check and the write are one statement.
    const { data, error } = await client
      .from("products")
      .update({
        ...details,
        qty,
        sizes,
        colors,
        variant_stock,
        stock_version: draft.stockVersion + 1,
      })
      .eq("id", id)
      .eq("stock_version", draft.stockVersion)
      .select("*")
      .limit(1);
    if (error) return failResult(sqlMessage(error));
    let row = data?.[0];
    if (!row) {
      // Either the product is gone, or its stock changed meanwhile. Save the details alone.
      const saved = await client.from("products").update(details).eq("id", id).select("*").limit(1);
      if (saved.error) return failResult(sqlMessage(saved.error));
      if (!saved.data?.[0]) return failResult("That product no longer exists.");
      await log(actor, "product", "update", str(saved.data[0].name), id);
      return failResult(
        "Your other changes were saved, but the stock was not, because an order or another edit changed it while this page was open. Reload the product to see the current quantities, then enter yours again.",
      );
    }
    row = row as Row;
    const product = productFromRow(row);
    await log(actor, "product", "update", product.name, product.id);
    return valueResult<AdminProduct>(product);
  },

  async trashProduct(id, actor) {
    return setDeleted(id, true, actor, "delete");
  },

  async restoreProduct(id, actor) {
    return setDeleted(id, false, actor, "restore");
  },

  async deleteProductForever(id, actor) {
    if (!isUuid(id)) return failResult("That product no longer exists.");
    const client = await staff();
    const found = must(
      await client.from("products").select("name,is_deleted").eq("id", id).limit(1),
    );
    const row = found[0];
    if (!row) return failResult("That product no longer exists.");
    if (!row.is_deleted)
      return failResult("Move the product to the trash before deleting it for good.");
    const { error } = await client.from("products").delete().eq("id", id).eq("is_deleted", true);
    if (error) return failResult(sqlMessage(error));
    await log(actor, "product", "permanent delete", str(row.name), id);
    return okResult();
  },

  async emptyTrash(actor) {
    const { data, error } = await (
      await staff()
    )
      .from("products")
      .delete()
      .eq("is_deleted", true)
      .select("id");
    if (error) return failResult(sqlMessage(error));
    const removed = data?.length ?? 0;
    await log(actor, "product", "empty trash", `${removed} products`);
    return valueResult({ removed });
  },

  async orders(query, page) {
    let request = (await staff())
      .from("orders")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page.offset, page.offset + page.limit - 1);
    if (query.status) request = request.eq("status", query.status);
    const term = likeTerm(query.search ?? "");
    if (term)
      request = request.or(
        `order_number.ilike.%${term}%,customer_name.ilike.%${term}%,customer_email.ilike.%${term}%`,
      );
    const { data, error, count } = await request;
    if (error) throw new Error(`Database read failed: ${error.message}`);
    return { items: (data ?? []).map(orderFromRow), total: count ?? 0 };
  },

  async orderCounts() {
    const { data, error } = await (await staff()).rpc("admin_order_counts");
    if (error) throw new Error(`Database read failed: ${error.message}`);
    const counts = data as Row;
    return Object.fromEntries(ORDER_STATUSES.map((s) => [s, num(counts[s])])) as Record<
      OrderStatus,
      number
    >;
  },

  async order(orderNumber) {
    const rows = must(
      await (await staff()).from("orders").select("*").eq("order_number", orderNumber).limit(1),
    );
    return rows[0] ? orderFromRow(rows[0]) : null;
  },

  async setOrderStatus(orderNumber, status, actor) {
    const { data, error } = await (
      await staff()
    ).rpc("set_order_status", {
      p_order_number: orderNumber,
      p_status: status,
    });
    if (error) return failResult(sqlMessage(error));
    const result = data as { ok: boolean; code?: string; message?: string };
    if (!result.ok)
      return failResult(
        result.code === "not_found"
          ? "That order no longer exists."
          : (result.message ?? TRY_AGAIN),
      );
    await log(actor, "order", "order status", `${orderNumber} to ${status}`, orderNumber);
    return okResult();
  },

  async setPaymentDecision(orderNumber, decision, actor) {
    const { data, error } = await (
      await staff()
    ).rpc("decide_payment", {
      p_order_number: orderNumber,
      p_decision: decision,
    });
    if (error) return failResult(sqlMessage(error));
    const result = data as { ok: boolean; message?: string };
    if (!result.ok)
      return failResult(
        "Payment can only be checked on a pending order that has a receipt waiting.",
      );
    await log(
      actor,
      "order",
      decision === "confirmed" ? "payment confirmed" : "receipt rejected",
      orderNumber,
      orderNumber,
    );
    return okResult();
  },

  async resolveRefundCheck(orderNumber, receivedNgn, actor) {
    const { data, error } = await (
      await staff()
    ).rpc("resolve_refund_check", { p_order_number: orderNumber, p_received: receivedNgn });
    if (error) return failResult(sqlMessage(error));
    const result = data as { ok: boolean; message?: string };
    if (!result.ok) return failResult(result.message ?? TRY_AGAIN);
    await log(
      actor,
      "order",
      "refund check",
      `${orderNumber}: received ${receivedNgn}`,
      orderNumber,
    );
    return okResult();
  },

  async markRefunded(orderNumber, actor) {
    const { data, error } = await (
      await staff()
    ).rpc("mark_refunded", { p_order_number: orderNumber });
    if (error) return failResult(sqlMessage(error));
    const result = data as { ok: boolean; message?: string };
    if (!result.ok) return failResult(result.message ?? TRY_AGAIN);
    await log(actor, "order", "refund paid", orderNumber, orderNumber);
    return okResult();
  },

  async orphanReceipts() {
    const { data, error } = await (await staff()).rpc("admin_orphan_receipts");
    if (error) throw new Error(`Database read failed: ${error.message}`);
    return ((data as Row[] | null) ?? []).map((r) => ({
      path: str(r.path),
      uploadedAt: str(r.uploaded_at),
      failureId: r.failure_id ? str(r.failure_id) : null,
      customerName: str(r.customer_name),
      email: str(r.customer_email),
      phone: str(r.customer_phone),
      quotedTotal:
        r.quoted_total === null || r.quoted_total === undefined ? null : num(r.quoted_total),
      reason: str(r.reason),
      resolved: r.resolved === true,
    }));
  },

  async resolveCheckoutFailure(id, resolution, actor) {
    if (!isUuid(id)) return failResult("That failed checkout no longer exists.");
    const { data, error } = await (
      await staff()
    ).rpc("resolve_checkout_failure", { p_id: id, p_resolution: resolution });
    if (error) return failResult(sqlMessage(error));
    if (data !== true) return failResult("That failed checkout was already closed.");
    await log(actor, "order", "checkout failure closed", resolution || id, id);
    return okResult();
  },

  async deleteOrphanReceipt(path, actor) {
    // Re-read the list on the server: only a receipt that is still an orphan, and either abandoned
    // or settled, can be deleted, whatever the browser asked for.
    const rows = await this.orphanReceipts();
    const row = rows.find((r) => r.path === path);
    if (!row) return failResult("That receipt is no longer an orphan, or does not exist.");
    if (row.failureId && !row.resolved)
      return failResult("Close the failed checkout before deleting its receipt.");
    if (!row.failureId && Date.now() - new Date(row.uploadedAt).getTime() < 24 * 3_600_000)
      return failResult("That upload is less than a day old; a checkout may still be using it.");
    await receipts.remove(path);
    await log(actor, "order", "receipt deleted", path);
    return okResult();
  },

  async customers(search, page) {
    const { data, error } = await (
      await staff()
    ).rpc("admin_customers", {
      p_search: search,
      p_limit: page.limit,
      p_offset: page.offset,
    });
    if (error) throw new Error(`Database read failed: ${error.message}`);
    const result = data as { total: number; items: Row[] };
    return {
      total: num(result.total),
      items: result.items.map((c) => ({
        id: str(c.id),
        name: str(c.name),
        email: str(c.email),
        phone: str(c.phone),
        createdAt: str(c.created_at),
        status: str(c.status) as "active",
        orderCount: num(c.order_count),
        totalSpentNgn: num(c.total_spent),
        returnPrivilege: Boolean(c.return_privilege),
      })),
    };
  },

  async customerStats(since) {
    const { data, error } = await (
      await staff()
    ).rpc("admin_customer_stats", {
      p_since: since.toISOString(),
    });
    if (error) throw new Error(`Database read failed: ${error.message}`);
    const s = data as Row;
    return { total: num(s.total), newSince: num(s.new_since), withOrders: num(s.with_orders) };
  },

  async setCustomerStatus(id, status, actor) {
    if (!isUuid(id)) return failResult("That customer was not found.");
    const client = await staff();
    const { error } = await client.rpc("set_account_status", { p_user: id, p_status: status });
    if (error)
      return failResult(
        error.code === "P0002" ? "That customer was not found." : sqlMessage(error),
      );
    // The status stops the account at the database; the ban ends sessions that are already open.
    await serviceClient().auth.admin.updateUserById(id, {
      ban_duration: status === "active" ? "none" : "876000h",
    });
    const email = await emailOf(id);
    await log(
      actor,
      "customer",
      status === "active" ? "customer reactivated" : `customer ${status}`,
      email,
      id,
    );
    return okResult();
  },

  async setReturnPrivilege(id, allowed, actor) {
    if (!isUuid(id)) return failResult("That customer was not found.");
    const { error } = await (
      await staff()
    ).rpc("set_return_privilege", {
      p_user: id,
      p_allowed: allowed,
    });
    if (error) return failResult(sqlMessage(error));
    await log(
      actor,
      "customer",
      allowed ? "return privilege restored" : "return privilege revoked",
      await emailOf(id),
      id,
    );
    return okResult();
  },

  async deleteCustomer(id, actor) {
    if (!isUuid(id)) return failResult("That customer was not found.");
    const { data: allowed } = await (
      await staff()
    ).rpc("has_permission", {
      p_permission: "customers.manage",
    });
    if (allowed !== true) return failResult("You do not have permission to do that.");
    const rows = must(
      await serviceClient().from("profiles").select("email,role").eq("id", id).limit(1),
    );
    const row = rows[0];
    if (!row || row.role !== "customer") return failResult("That customer was not found.");
    // Orders are kept and de-linked (their user id is cleared); the profile and sessions go.
    const { error } = await serviceClient().auth.admin.deleteUser(id);
    if (error) return failResult(TRY_AGAIN);
    await log(actor, "customer", "customer deleted", str(row.email), id);
    return okResult();
  },

  async promos(page) {
    const { data, error, count } = await (
      await staff()
    )
      .from("promo_codes")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page.offset, page.offset + page.limit - 1);
    if (error) throw new Error(`Database read failed: ${error.message}`);
    return { items: (data ?? []).map(promoFromRow), total: count ?? 0 };
  },

  async savePromo(input, actor) {
    const { data, error } = await (
      await staff()
    )
      .from("promo_codes")
      .insert({
        code: input.code.trim().toUpperCase(),
        discount_percent: input.percent,
        expires_at: input.expiresAt,
        max_uses: input.usageLimit,
      })
      .select("*")
      .limit(1);
    if (error?.code === "23505") return failResult("A promo code with that name already exists.");
    const row = data?.[0];
    if (error || !row) return failResult(sqlMessage(error ?? {}));
    const promo = promoFromRow(row);
    await log(actor, "promo", "promo created", promo.code, promo.id);
    return valueResult(promo);
  },

  async setPromoActive(id, active, actor) {
    if (!isUuid(id)) return failResult("That promo code no longer exists.");
    const { data, error } = await (
      await staff()
    )
      .from("promo_codes")
      .update({ is_active: active })
      .eq("id", id)
      .select("code");
    if (error) return failResult(sqlMessage(error));
    const row = data?.[0];
    if (!row) return failResult("That promo code no longer exists.");
    await log(
      actor,
      "promo",
      active ? "promo switched on" : "promo switched off",
      str(row.code),
      id,
    );
    return okResult();
  },

  async deletePromo(id, actor) {
    if (!isUuid(id)) return failResult("That promo code no longer exists.");
    const { data, error } = await (
      await staff()
    )
      .from("promo_codes")
      .delete()
      .eq("id", id)
      .select("code");
    if (error) return failResult(sqlMessage(error));
    const row = data?.[0];
    if (!row) return failResult("That promo code no longer exists.");
    await log(actor, "promo", "promo deleted", str(row.code), id);
    return okResult();
  },

  async messages(query, page) {
    let request = (await staff())
      .from("contact_messages")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page.offset, page.offset + page.limit - 1);
    if (query.status) request = request.eq("status", query.status);
    const term = likeTerm(query.search ?? "");
    if (term)
      request = request.or(
        ["name", "email", "body", "order_number", "subject"]
          .map((f) => `${f}.ilike.%${term}%`)
          .join(","),
      );
    const { data, error, count } = await request;
    if (error) throw new Error(`Database read failed: ${error.message}`);
    const rows = data ?? [];
    const replies = await repliesFor(rows.map((r) => str(r.id)));
    return {
      items: rows.map((r) => messageFromRow(r, replies.get(str(r.id)) ?? [])),
      total: count ?? 0,
    };
  },

  async messageCounts() {
    const client = await staff();
    const count = async (status?: string) => {
      let request = client.from("contact_messages").select("id", { count: "exact", head: true });
      if (status) request = request.eq("status", status);
      const { count: n, error } = await request;
      if (error) throw new Error(`Database read failed: ${error.message}`);
      return n ?? 0;
    };
    const [all, unread, read, replied] = await Promise.all([
      count(),
      count("unread"),
      count("read"),
      count("replied"),
    ]);
    return { all, unread, read, replied };
  },

  async message(id) {
    if (!isUuid(id)) return null;
    const rows = must(
      await (await staff()).from("contact_messages").select("*").eq("id", id).limit(1),
    );
    const row = rows[0];
    if (!row) return null;
    const replies = await repliesFor([id]);
    return messageFromRow(row, replies.get(id) ?? []);
  },

  async markMessage(id, status, actor) {
    if (!isUuid(id)) return failResult("That message no longer exists.");
    const client = await staff();
    const rows = must(
      await client.from("contact_messages").select("status,email").eq("id", id).limit(1),
    );
    const row = rows[0];
    if (!row) return failResult("That message no longer exists.");
    const next = row.status === "replied" && status === "read" ? "replied" : status;
    const { error } = await client.from("contact_messages").update({ status: next }).eq("id", id);
    if (error) return failResult(sqlMessage(error));
    await log(
      actor,
      "message",
      status === "read" ? "message marked read" : "message marked unread",
      str(row.email),
      id,
    );
    return okResult();
  },

  async replyToMessage(id, body, actor) {
    if (!isUuid(id)) return failResult("That message no longer exists.");
    const client = await staff();
    const { data, error } = await client.rpc("reply_to_message", { p_id: id, p_body: body });
    if (error) return failResult(sqlMessage(error));
    const result = data as { ok: boolean; message?: string };
    if (!result.ok) return failResult(result.message ?? TRY_AGAIN);
    const rows = must(await client.from("contact_messages").select("email").eq("id", id).limit(1));
    await log(actor, "message", "message reply", str(rows[0]?.email), id);
    return okResult();
  },

  async deleteMessage(id, actor) {
    if (!isUuid(id)) return failResult("That message no longer exists.");
    const { data, error } = await (
      await staff()
    )
      .from("contact_messages")
      .delete()
      .eq("id", id)
      .select("email");
    if (error) return failResult(sqlMessage(error));
    const row = data?.[0];
    if (!row) return failResult("That message no longer exists.");
    await log(actor, "message", "message deleted", str(row.email), id);
    return okResult();
  },

  async analytics(days) {
    const { data, error } = await (await staff()).rpc("admin_analytics", { p_days: days });
    if (error) throw new Error(`Database read failed: ${error.message}`);
    const a = data as Row;
    const customers = num(a.customers);
    const orders = num(a.orders);
    const report: AnalyticsReport = {
      days,
      sample: false,
      pageViews: num(a.page_views),
      customers,
      orders,
      revenueNgn: num(a.revenue),
      conversionPercent: customers === 0 ? 0 : Math.round((orders / customers) * 1000) / 10,
      series: ((a.series as Row[]) ?? []).map((d) => ({
        date: str(d.date),
        views: num(d.views),
        orders: num(d.orders),
        revenueNgn: num(d.revenue),
      })),
      statusBreakdown: tallies(a.status_breakdown),
      topPages: tallies(a.top_pages),
      topProducts: tallies(a.top_products),
      devices: tallies(a.devices),
      browsers: tallies(a.browsers),
      states: tallies(a.states),
    };
    return report;
  },

  async settings() {
    const rows = must(
      await (await staff()).from("site_settings").select("value").eq("key", "store").limit(1),
    );
    return {
      ...defaultSettings(),
      ...((rows[0]?.value as Partial<StoreSettings> | undefined) ?? {}),
    };
  },

  async saveSettings(next, actor) {
    const { error } = await (
      await staff()
    )
      .from("site_settings")
      .upsert({ key: "store", value: next }, { onConflict: "key" });
    if (error) return failResult(sqlMessage(error));
    await log(actor, "settings", "settings saved", "store settings");
    return okResult();
  },

  async staff() {
    const rows = must(await (await staff()).from("profiles").select("*").neq("role", "customer"));
    const rank: Record<string, number> = { owner: 0, developer: 1, super_admin: 2, editor: 3 };
    return rows
      .map((u) => ({
        id: str(u.id),
        name: `${str(u.first_name)} ${str(u.last_name)}`.trim(),
        email: str(u.email),
        role: str(u.role) as "editor",
        createdAt: str(u.created_at),
      }))
      .sort(
        (a, b) =>
          (rank[a.role] ?? 9) - (rank[b.role] ?? 9) || a.createdAt.localeCompare(b.createdAt),
      );
  },

  async setStaffRole(id, role: Staffable, actor) {
    if (!isUuid(id)) return failResult("That member of staff was not found.");
    const email = await emailOf(id);
    const { error } = await (await staff()).rpc("set_staff_role", { p_user: id, p_role: role });
    if (error)
      return failResult(
        error.code === "P0002" ? "That member of staff was not found." : sqlMessage(error),
      );
    await log(actor, "staff", role === "editor" ? "staff demoted" : "staff promoted", email, id);
    return okResult();
  },

  async removeStaff(id, actor) {
    if (!isUuid(id)) return failResult("That member of staff was not found.");
    const email = await emailOf(id);
    const { error } = await (
      await staff()
    ).rpc("set_staff_role", { p_user: id, p_role: "customer" });
    if (error)
      return failResult(
        error.code === "P0002" ? "That member of staff was not found." : sqlMessage(error),
      );
    await log(actor, "staff", "staff removed", email, id);
    return okResult();
  },

  async inviteStaff(email, role: Staffable, actor) {
    const { data, error } = await (
      await staff()
    ).rpc("create_admin_invite", {
      p_email: email,
      p_role: role,
    });
    if (error || typeof data !== "string") return failResult(error ? sqlMessage(error) : TRY_AGAIN);
    await log(actor, "staff", "invitation", `${email} as ${role}`);
    return valueResult({ link: `/admin/sign-in?invite=${data}` });
  },

  async activity(search, page) {
    let request = (await staff())
      .from("admin_activity_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page.offset, page.offset + page.limit - 1);
    const term = likeTerm(search);
    if (term)
      request = request.or(
        `action.ilike.%${term}%,subject.ilike.%${term}%,metadata->>admin_name.ilike.%${term}%`,
      );
    const { data, error, count } = await request;
    if (error) throw new Error(`Database read failed: ${error.message}`);
    return { items: (data ?? []).map(activityFromRow), total: count ?? 0 };
  },
};

async function setDeleted(id: string, deleted: boolean, actor: SessionUser, action: string) {
  if (!isUuid(id)) return failResult("That product no longer exists.");
  const { data, error } = await (
    await staff()
  )
    .from("products")
    .update({ is_deleted: deleted })
    .eq("id", id)
    .select("name");
  if (error) return failResult(sqlMessage(error));
  const row = data?.[0];
  if (!row) return failResult("That product no longer exists.");
  await log(actor, "product", action, str(row.name), id);
  return okResult();
}

async function emailOf(id: string): Promise<string> {
  const rows = must(await serviceClient().from("profiles").select("email").eq("id", id).limit(1));
  return str(rows[0]?.email);
}
