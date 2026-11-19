import { toCsv } from "@/lib/csv";
import type { Permission } from "@/lib/permissions";
import { staffFor } from "@/server/auth/session";
import { data } from "@/server/data";
import { collectAll } from "@/server/paging";

const PERMISSION: Record<string, Permission> = {
  products: "products.manage",
  orders: "orders.view",
  customers: "customers.view",
  activity: "roles.manage",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ kind: string }> },
): Promise<Response> {
  const { kind } = await params;
  const permission = PERMISSION[kind];
  if (!permission) return new Response("Not found", { status: 404 });
  if (!(await staffFor(permission))) return new Response("Not allowed", { status: 403 });

  let body = "";
  if (kind === "products") {
    const rows = await collectAll((page) => data.admin.products({}, page));
    body = toCsv(
      [
        "Name",
        "Category",
        "Price (NGN)",
        "Quantity",
        "For",
        "Sizes",
        "Colours",
        "Live",
        "New",
        "Created",
      ],
      rows.map((p) => [
        p.name,
        p.category,
        p.priceNgn,
        p.qty,
        p.gender,
        p.sizes.map((s) => s.name).join("; "),
        p.colours.map((c) => c.name).join("; "),
        p.active,
        p.isNew,
        p.createdAt,
      ]),
    );
  } else if (kind === "orders") {
    body = toCsv(
      [
        "Order number",
        "Customer",
        "Email",
        "Phone",
        "Status",
        "Total (NGN)",
        "Subtotal (NGN)",
        "Delivery (NGN)",
        "State",
        "Items",
        "Placed",
      ],
      (await collectAll((page) => data.admin.orders({}, page))).map((o) => [
        o.orderNumber,
        o.customerName,
        o.email,
        o.phone,
        o.status,
        o.total,
        o.subtotal,
        o.delivery,
        o.state,
        o.lines.reduce((n, l) => n + l.qty, 0),
        o.createdAt,
      ]),
    );
  } else if (kind === "customers") {
    body = toCsv(
      ["Name", "Email", "Phone", "Orders", "Spent, delivered (NGN)", "Joined", "Status"],
      (await collectAll((page) => data.admin.customers("", page))).map((c) => [
        c.name,
        c.email,
        c.phone,
        c.orderCount,
        c.totalSpentNgn,
        c.createdAt,
        c.status,
      ]),
    );
  } else {
    body = toCsv(
      ["When", "Who", "Role", "Action", "Subject"],
      (await collectAll((page) => data.admin.activity("", page))).map((a) => [
        a.at,
        a.actor,
        a.role,
        a.action,
        a.subject,
      ]),
    );
  }
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${kind}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
