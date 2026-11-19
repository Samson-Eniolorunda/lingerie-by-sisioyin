// Seeds the local test database with the same invented data the development store uses: the
// fixture products, three promo codes, demonstration accounts (example.test addresses), a few
// orders and messages. Talks to the local stand-in and the local database only.
import { createHash } from "node:crypto";
import pg from "pg";
import { FIXTURE_PRODUCTS } from "../../../src/data/fixtures.ts";

const API = `http://127.0.0.1:${process.env.LBS_STACK_PORT ?? 54321}`;
const pool = new pg.Pool({ connectionString: process.env.LBS_DATABASE_URL });
const keys = await (await fetch(`${API}/keys`)).json();
const service = {
  apikey: keys.service,
  authorization: `Bearer ${keys.service}`,
  "content-type": "application/json",
};

/** Deterministic UUIDs so a fixture keeps the same id on every start. */
export function uuidFor(text) {
  const h = createHash("sha1").update(`lbs:${text}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

for (const [i, p] of FIXTURE_PRODUCTS.entries()) {
  await pool.query(
    `INSERT INTO products (id, slug, name, category, gender, price_ngn, qty, sizes, colors, variant_stock, description,
       images, is_active, is_new, allow_color_selection, delivery_type, pack_type, avg_rating, review_count, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11,$12,true,$13,$14,$15,$16,$17,$18, now() - ($19 || ' hours')::interval)`,
    [
      uuidFor(p.id),
      p.slug,
      p.name,
      p.category,
      p.gender,
      p.priceNgn,
      p.qty,
      JSON.stringify(p.sizes),
      JSON.stringify(p.colours),
      JSON.stringify(p.variantStock),
      p.description,
      p.images.map((x) => x.src),
      p.isNew,
      p.allowColourSelection,
      p.deliveryType,
      p.packType,
      p.avgRating,
      p.reviewCount,
      String(i * 3),
    ],
  );
}
await pool.query(`
  INSERT INTO promo_codes (code, discount_percent) VALUES ('WELCOME10', 10);
  INSERT INTO promo_codes (code, discount_percent, max_uses) VALUES ('ONEUSE', 20, 1);
  INSERT INTO promo_codes (code, discount_percent, expires_at) VALUES ('EXPIRED', 15, '2020-01-01T00:00:00Z');
`);

async function makeUser(email, password, first, last, role) {
  const res = await fetch(`${API}/auth/v1/admin/users`, {
    method: "POST",
    headers: service,
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name: first, last_name: last },
    }),
  });
  const user = await res.json();
  if (!user.id) throw new Error(`seed user ${email}: ${JSON.stringify(user)}`);
  if (role) {
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      await c.query("SELECT set_config('lbs.allow_protected_roles','on',true)");
      await c.query("UPDATE profiles SET role = $2 WHERE id = $1", [user.id, role]);
      await c.query("COMMIT");
    } finally {
      c.release();
    }
  }
  return user.id;
}
const demo = await makeUser("demo.customer@example.test", "Demo-Pass1!", "Demo", "Customer");
await makeUser("owner@example.test", "Owner-Pass1!", "Demo", "Owner", "owner");
await makeUser("editor@example.test", "Editor-Pass1!", "Demo", "Editor", "editor");
const names = [
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
const customers = [];
for (const [i, first] of names.entries()) {
  const last = ["Demo", "Sample", "Test", "Example"][i % 4];
  const id = await makeUser(
    `${first.toLowerCase()}.${last.toLowerCase()}@example.test`,
    "Sample-Pass1!",
    first,
    last,
  );
  customers.push(id);
  await pool.query(
    "UPDATE profiles SET created_at = now() - ($2 || ' days')::interval WHERE id = $1",
    [id, String(5 + i * 7)],
  );
}
await pool.query("UPDATE profiles SET account_status = 'suspended' WHERE id = $1", [customers[10]]);

// A few orders through the real place_order function, then spread over time and statuses.
const stateByIndex = ["Lagos", "Ogun", "Oyo", "Osun", "Ondo", "Ekiti", "Abuja"];
const { rows: variants } = await pool.query(
  `SELECT id, name, price_ngn, variant_stock FROM products WHERE qty > 20 AND jsonb_array_length(variant_stock) > 0 ORDER BY created_at LIMIT 6`,
);
let n = 0;

/** A one-pixel JPEG in the private bucket, so an admin can open the seeded receipts. */
async function seedReceipt(path) {
  const sign = await fetch(`${API}/storage/v1/object/upload/sign/payment-receipts/${path}`, {
    method: "POST",
    headers: service,
  });
  const { url } = await sign.json();
  const put = await fetch(`${API}/storage/v1${url}`, {
    method: "PUT",
    headers: { "content-type": "image/jpeg" },
    body: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
  });
  if (!put.ok) throw new Error(`seed receipt ${path}: ${put.status}`);
}
async function order(userId, status, hoursAgo) {
  n += 1;
  const v = variants[n % variants.length];
  const variant = v.variant_stock.find((x) => x.qty > 3);
  const state = stateByIndex[n % stateByIndex.length];
  const fee = { Lagos: 0, Ogun: 2000, Oyo: 2500, Osun: 2500, Ondo: 2500, Ekiti: 3000, Abuja: 3500 }[
    state
  ];
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("SET LOCAL ROLE service_role");
    const key = `seed-order-${n}-key-0000000000`;
    const r = await c.query(
      "SELECT place_order($1, $2::jsonb, $3::jsonb, $4::jsonb, NULL, $5, $6) AS r",
      [
        key,
        JSON.stringify({
          name: "Sample Customer",
          email: `sample${n}@example.test`,
          phone: "+2348012345678",
        }),
        JSON.stringify({ address: `${10 + n} Sample Street`, city: "Ikeja", state }),
        JSON.stringify([{ product_id: v.id, size: variant.size, colour: variant.color, qty: 1 }]),
        v.price_ngn + fee,
        `${key}/receipt.jpg`,
      ],
    );
    if (!r.rows[0].r.ok) throw new Error(JSON.stringify(r.rows[0].r));
    await seedReceipt(`${key}/receipt.jpg`);
    const num = r.rows[0].r.order_number;
    await c.query("RESET ROLE");
    await c.query(
      `UPDATE orders SET user_id = $2, status = $3,
         payment_status = CASE WHEN $3 = 'pending' THEN 'awaiting_confirmation' WHEN $3 = 'cancelled' THEN 'rejected' ELSE 'confirmed' END,
         created_at = now() - ($4 || ' hours')::interval WHERE order_number = $1`,
      [num, userId, status, String(hoursAgo)],
    );
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}
await order(demo, "delivered", 24 * 20);
await order(demo, "cancelled", 24 * 12);
await order(demo, "shipped", 24 * 6);
await order(demo, "processing", 24 * 3);
for (const [i, id] of customers.slice(0, 8).entries()) await order(id, "pending", 2 + i * 5);
for (const [i, id] of customers.slice(2, 8).entries())
  await order(id, "delivered", 24 * (10 + i * 9));

await pool.query(`
  INSERT INTO contact_messages (name, email, subject, body, status, created_at) VALUES
   ('Ada Demo','ada.demo@example.test','Sizing help','Please help me choose between 34B and 34C in the lace balconette.','unread', now() - interval '2 hours'),
   ('Tolu Sample','tolu.sample@example.test','Order enquiry','Has my order left the warehouse? I would like it before Friday.','unread', now() - interval '9 hours'),
   ('Ife Test','ife.test@example.test','Returns and exchanges','The size was too small. May I exchange it for a larger one?','read', now() - interval '30 hours'),
   ('Kemi Example','kemi.example@example.test','Wholesale enquiry','Do you supply boutiques outside Lagos?','replied', now() - interval '70 hours');
`);
await pool.query(`INSERT INTO contact_replies (message_id, author_name, body)
  SELECT id, 'Owner', 'Thank you for writing. We do supply boutiques; please send us your location.' FROM contact_messages WHERE status = 'replied'`);
await pool.query(`INSERT INTO site_settings (key, value) VALUES ('store', $1::jsonb)`, [
  JSON.stringify({
    announcement: "Delivery to Lagos, Ogun, Oyo, Osun, Ondo, Ekiti and Abuja",
    whatsappNumber: "2349033344860",
    supportEmail: "support@lingeriebysisioyin.store",
    bankName: "Moniepoint MFB",
    accountNumber: "6327082294",
    accountName: "Oyindamola Adelugba (LingeriesBySisioyin)",
    lowStockThreshold: 5,
    notifyNewOrders: true,
  }),
]);
await pool.end();
process.stderr.write(`${`seeded ${FIXTURE_PRODUCTS.length} products, ${n} orders`}\n`);
