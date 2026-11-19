// A local stand-in for the parts of the Supabase HTTP API the shop uses, over a local PostgreSQL.
// Test use only. It is NOT Supabase: it implements the PostgREST query subset, the GoTrue password,
// PKCE, refresh and admin calls, and the Storage signed-upload calls that src/server/supabase uses,
// and nothing else. It never talks to anything but the local database named by LBS_DATABASE_URL.
//
//   LBS_DATABASE_URL  postgres://postgres@127.0.0.1:54329/lbs   (required)
//   LBS_STACK_PORT    default 54321
//   LBS_JWT_SECRET    default a fixed test secret
//   LBS_AUTOCONFIRM   "0" to require e-mail confirmation (default: confirmed on sign-up)
import {
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
  randomUUID,
} from "node:crypto";
import { createServer } from "node:http";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";

const PORT = Number(process.env.LBS_STACK_PORT ?? 54321);
const SECRET = process.env.LBS_JWT_SECRET ?? "local-test-secret-not-for-production-use-0123456789";
const AUTOCONFIRM = process.env.LBS_AUTOCONFIRM !== "0";
const BASE = process.env.LBS_STACK_URL ?? `http://127.0.0.1:${PORT}`;
const FILES = join(process.env.LBS_STORAGE_DIR ?? tmpdir(), `lbs-storage-${PORT}`);
mkdirSync(FILES, { recursive: true });

// Like PostgREST, numbers come back as JSON numbers and dates as plain dates.
pg.types.setTypeParser(1700, (v) => Number(v));
pg.types.setTypeParser(20, (v) => Number(v));
pg.types.setTypeParser(1082, (v) => v);

const pool = new pg.Pool({ connectionString: process.env.LBS_DATABASE_URL, max: 8 });
pool.on("error", () => {});

// ---------- JWT ----------
const b64 = (b) => Buffer.from(b).toString("base64url");
export function signJwt(payload) {
  const head = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64(JSON.stringify(payload));
  const sig = createHmac("sha256", SECRET).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}
function verifyJwt(token) {
  const [h, p, s] = (token ?? "").split(".");
  if (!h || !p || !s) return null;
  const expect = createHmac("sha256", SECRET).update(`${h}.${p}`).digest("base64url");
  const a = Buffer.from(s);
  const b = Buffer.from(expect);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const claims = JSON.parse(Buffer.from(p, "base64url").toString());
    if (claims.exp && claims.exp < Date.now() / 1000) return null;
    return claims;
  } catch {
    return null;
  }
}
const ANON_KEY = signJwt({ role: "anon", iss: "local-stack", exp: 4102444800 });
const SERVICE_KEY = signJwt({ role: "service_role", iss: "local-stack", exp: 4102444800 });

// ---------- helpers ----------
function hashPassword(pw) {
  const salt = randomBytes(16);
  return `${salt.toString("hex")}:${scryptSync(pw, salt, 32).toString("hex")}`;
}
function checkPassword(pw, stored) {
  const [salt, hash] = (stored ?? "").split(":");
  if (!salt || !hash) return false;
  const a = Buffer.from(hash, "hex");
  const b = scryptSync(pw, Buffer.from(salt, "hex"), 32);
  return a.length === b.length && timingSafeEqual(a, b);
}
const send = (res, status, body, headers = {}) => {
  const text = body === undefined ? "" : typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json", ...cors(), ...headers });
  res.end(text);
};
const cors = () => ({
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS",
  "access-control-expose-headers": "Content-Range",
});
async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}
const json = (buf) => {
  try {
    return buf.length ? JSON.parse(buf.toString()) : {};
  } catch {
    return {};
  }
};

// ---------- auth (GoTrue subset) ----------
const authErr = (res, status, code, msg) =>
  send(res, status, { code: status, error_code: code, msg, message: msg });

function userObject(u) {
  return {
    id: u.id,
    aud: "authenticated",
    role: "authenticated",
    email: u.email,
    email_confirmed_at: u.email_confirmed_at,
    phone: "",
    confirmed_at: u.email_confirmed_at,
    last_sign_in_at: u.last_sign_in_at,
    app_metadata: u.raw_app_meta_data ?? { provider: "email", providers: ["email"] },
    user_metadata: u.raw_user_meta_data ?? {},
    identities: [
      {
        id: u.id,
        user_id: u.id,
        provider: (u.raw_app_meta_data ?? {}).provider ?? "email",
        identity_data: { email: u.email },
      },
    ],
    created_at: u.created_at,
    updated_at: u.updated_at,
  };
}

async function issueSession(client, user) {
  const { rows: s } = await client.query(
    "INSERT INTO auth.sessions (user_id) VALUES ($1) RETURNING id",
    [user.id],
  );
  const refresh = randomBytes(12).toString("hex");
  await client.query(
    "INSERT INTO auth.refresh_tokens (token, user_id, session_id) VALUES ($1,$2,$3)",
    [refresh, user.id, s[0].id],
  );
  await client.query("UPDATE auth.users SET last_sign_in_at = now() WHERE id = $1", [user.id]);
  return sessionBody(user, s[0].id, refresh);
}
function sessionBody(user, sessionId, refresh) {
  const now = Math.floor(Date.now() / 1000);
  const ttl = Number(process.env.LBS_TOKEN_TTL ?? 3600);
  const access = signJwt({
    aud: "authenticated",
    exp: now + ttl,
    iat: now,
    sub: user.id,
    email: user.email,
    role: "authenticated",
    session_id: sessionId,
    user_metadata: user.raw_user_meta_data ?? {},
    app_metadata: user.raw_app_meta_data ?? {},
  });
  return {
    access_token: access,
    token_type: "bearer",
    expires_in: ttl,
    expires_at: now + ttl,
    refresh_token: refresh,
    user: userObject(user),
  };
}
const isBanned = (u) => u.banned_until && new Date(u.banned_until) > new Date();

async function handleAuth(req, res, url, claims) {
  const route = url.pathname.replace("/auth/v1", "");
  const method = req.method;
  const body = method === "GET" || method === "DELETE" ? {} : json(await readBody(req));
  const client = await pool.connect();
  try {
    if (route === "/signup" && method === "POST") {
      const email = String(body.email ?? "")
        .trim()
        .toLowerCase();
      const password = String(body.password ?? "");
      if (!email || password.length < 6)
        return authErr(res, 422, "weak_password", "Password should be at least 6 characters.");
      const exists = await client.query("SELECT 1 FROM auth.users WHERE lower(email) = $1", [
        email,
      ]);
      if (exists.rowCount)
        return authErr(res, 422, "user_already_exists", "User already registered");
      const { rows } = await client.query(
        `INSERT INTO auth.users (email, encrypted_password, raw_user_meta_data, raw_app_meta_data, email_confirmed_at)
         VALUES ($1,$2,$3::jsonb,'{"provider":"email","providers":["email"]}'::jsonb, ${AUTOCONFIRM ? "now()" : "NULL"})
         RETURNING *`,
        [email, hashPassword(password), JSON.stringify(body.data ?? {})],
      );
      if (!AUTOCONFIRM) return send(res, 200, userObject(rows[0]));
      return send(res, 200, await issueSession(client, rows[0]));
    }

    if (route === "/token" && method === "POST") {
      const grant = url.searchParams.get("grant_type");
      if (grant === "password") {
        const email = String(body.email ?? "")
          .trim()
          .toLowerCase();
        const { rows } = await client.query("SELECT * FROM auth.users WHERE lower(email) = $1", [
          email,
        ]);
        const user = rows[0];
        if (!user || !checkPassword(String(body.password ?? ""), user.encrypted_password))
          return authErr(res, 400, "invalid_credentials", "Invalid login credentials");
        if (isBanned(user)) return authErr(res, 400, "user_banned", "User is banned");
        if (!user.email_confirmed_at)
          return authErr(res, 400, "email_not_confirmed", "Email not confirmed");
        return send(res, 200, await issueSession(client, user));
      }
      if (grant === "refresh_token") {
        const { rows } = await client.query(
          `SELECT t.*, u.* , t.token AS rtoken, t.session_id AS sid FROM auth.refresh_tokens t
             JOIN auth.users u ON u.id = t.user_id WHERE t.token = $1`,
          [String(body.refresh_token ?? "")],
        );
        const row = rows[0];
        if (!row || row.revoked)
          return authErr(
            res,
            400,
            "refresh_token_not_found",
            "Invalid Refresh Token: Refresh Token Not Found",
          );
        if (isBanned(row)) return authErr(res, 400, "user_banned", "User is banned");
        await client.query("UPDATE auth.refresh_tokens SET revoked = true WHERE token = $1", [
          row.rtoken,
        ]);
        const next = randomBytes(12).toString("hex");
        await client.query(
          "INSERT INTO auth.refresh_tokens (token, user_id, session_id) VALUES ($1,$2,$3)",
          [next, row.user_id, row.sid],
        );
        const { rows: u } = await client.query("SELECT * FROM auth.users WHERE id = $1", [
          row.user_id,
        ]);
        return send(res, 200, sessionBody(u[0], row.sid, next));
      }
      if (grant === "pkce") {
        const code = String(body.auth_code ?? "");
        const verifier = String(body.code_verifier ?? "");
        const { rows } = await client.query(
          "DELETE FROM auth.flow_state WHERE auth_code = $1 RETURNING *",
          [code],
        );
        const flow = rows[0];
        const challenge = createHash("sha256").update(verifier).digest("base64url");
        if (!flow || (flow.code_challenge !== challenge && flow.code_challenge !== verifier))
          return authErr(
            res,
            400,
            "flow_state_not_found",
            "invalid flow state, no valid flow state found",
          );
        const { rows: u } = await client.query("SELECT * FROM auth.users WHERE id = $1", [
          flow.user_id,
        ]);
        if (isBanned(u[0])) return authErr(res, 400, "user_banned", "User is banned");
        return send(res, 200, await issueSession(client, u[0]));
      }
      return authErr(res, 400, "unsupported_grant_type", "Unsupported grant type");
    }

    if (route === "/user" && (method === "GET" || method === "PUT")) {
      if (!claims || claims.role !== "authenticated" || !claims.sub)
        return authErr(res, 401, "no_authorization", "This endpoint requires a Bearer token");
      const { rows } = await client.query("SELECT * FROM auth.users WHERE id = $1", [claims.sub]);
      const user = rows[0];
      if (!user)
        return authErr(res, 403, "user_not_found", "User from sub claim in JWT does not exist");
      if (method === "GET") return send(res, 200, userObject(user));
      if (body.password !== undefined) {
        if (String(body.password).length < 6)
          return authErr(res, 422, "weak_password", "Password should be at least 6 characters.");
        await client.query(
          "UPDATE auth.users SET encrypted_password = $2, updated_at = now() WHERE id = $1",
          [user.id, hashPassword(String(body.password))],
        );
      }
      if (body.data)
        await client.query(
          "UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data || $2::jsonb, updated_at = now() WHERE id = $1",
          [user.id, JSON.stringify(body.data)],
        );
      const { rows: again } = await client.query("SELECT * FROM auth.users WHERE id = $1", [
        user.id,
      ]);
      return send(res, 200, userObject(again[0]));
    }

    if (route === "/logout" && method === "POST") {
      if (!claims?.sub) return send(res, 204);
      const scope = url.searchParams.get("scope") ?? "global";
      if (scope === "global")
        await client.query("DELETE FROM auth.sessions WHERE user_id = $1", [claims.sub]);
      else if (scope === "others")
        await client.query("DELETE FROM auth.sessions WHERE user_id = $1 AND id <> $2", [
          claims.sub,
          claims.session_id,
        ]);
      else await client.query("DELETE FROM auth.sessions WHERE id = $1", [claims.session_id]);
      return send(res, 204);
    }

    if (route === "/recover" && method === "POST") {
      const email = String(body.email ?? "")
        .trim()
        .toLowerCase();
      const { rows } = await client.query("SELECT * FROM auth.users WHERE lower(email) = $1", [
        email,
      ]);
      if (rows[0] && !isBanned(rows[0]) && body.code_challenge) {
        const code = randomBytes(16).toString("hex");
        await client.query(
          "INSERT INTO auth.flow_state (auth_code, user_id, code_challenge, kind) VALUES ($1,$2,$3,'recovery')",
          [code, rows[0].id, body.code_challenge],
        );
        const redirect = new URL(url.searchParams.get("redirect_to") ?? `${BASE}`);
        redirect.searchParams.set("code", code);
        await client.query(
          "INSERT INTO lbs_test.mail (to_email, kind, link) VALUES ($1,'recovery',$2)",
          [email, redirect.toString()],
        );
      }
      return send(res, 200, {});
    }

    // Google, emulated: no provider is contacted; the visitor comes straight back as a Google user.
    if (route === "/authorize" && method === "GET") {
      const redirect = url.searchParams.get("redirect_to");
      const challenge = url.searchParams.get("code_challenge");
      const email = (
        url.searchParams.get("login_hint") ?? "google.user@example.test"
      ).toLowerCase();
      if (url.searchParams.get("provider") !== "google" || !redirect || !challenge)
        return authErr(res, 400, "validation_failed", "Unsupported provider");
      let { rows } = await client.query("SELECT * FROM auth.users WHERE lower(email) = $1", [
        email,
      ]);
      if (!rows[0])
        ({ rows } = await client.query(
          `INSERT INTO auth.users (email, raw_user_meta_data, raw_app_meta_data, email_confirmed_at)
           VALUES ($1,'{"full_name":"Google User"}'::jsonb,'{"provider":"google","providers":["google"]}'::jsonb, now()) RETURNING *`,
          [email],
        ));
      const code = randomBytes(16).toString("hex");
      await client.query(
        "INSERT INTO auth.flow_state (auth_code, user_id, code_challenge, kind) VALUES ($1,$2,$3,'oauth')",
        [code, rows[0].id, challenge],
      );
      const back = new URL(redirect);
      back.searchParams.set("code", code);
      res.writeHead(302, { location: back.toString(), ...cors() });
      return res.end();
    }

    // Admin API (service role only).
    const admin = route.match(/^\/admin\/users(?:\/([0-9a-f-]{36}))?$/);
    if (admin) {
      if (claims?.role !== "service_role")
        return authErr(res, 403, "not_admin", "User not allowed");
      const id = admin[1];
      if (method === "POST" && !id) {
        const email = String(body.email ?? "")
          .trim()
          .toLowerCase();
        const { rows } = await client.query(
          `INSERT INTO auth.users (email, encrypted_password, raw_user_meta_data, raw_app_meta_data, email_confirmed_at)
           VALUES ($1,$2,$3::jsonb,'{"provider":"email","providers":["email"]}'::jsonb, ${body.email_confirm ? "now()" : "NULL"}) RETURNING *`,
          [
            email,
            hashPassword(String(body.password ?? randomUUID())),
            JSON.stringify(body.user_metadata ?? {}),
          ],
        );
        return send(res, 200, userObject(rows[0]));
      }
      if (id && method === "GET") {
        const { rows } = await client.query("SELECT * FROM auth.users WHERE id = $1", [id]);
        return rows[0]
          ? send(res, 200, userObject(rows[0]))
          : authErr(res, 404, "user_not_found", "User not found");
      }
      if (id && method === "PUT") {
        if (body.ban_duration !== undefined) {
          const none = body.ban_duration === "none";
          const hours = none ? 0 : Number(String(body.ban_duration).replace(/h$/, "")) || 0;
          await client.query("UPDATE auth.users SET banned_until = $2 WHERE id = $1", [
            id,
            none ? null : new Date(Date.now() + hours * 3_600_000).toISOString(),
          ]);
          if (!none) await client.query("DELETE FROM auth.sessions WHERE user_id = $1", [id]);
        }
        if (body.password)
          await client.query("UPDATE auth.users SET encrypted_password = $2 WHERE id = $1", [
            id,
            hashPassword(String(body.password)),
          ]);
        const { rows } = await client.query("SELECT * FROM auth.users WHERE id = $1", [id]);
        return rows[0]
          ? send(res, 200, userObject(rows[0]))
          : authErr(res, 404, "user_not_found", "User not found");
      }
      if (id && method === "DELETE") {
        const r = await client.query("DELETE FROM auth.users WHERE id = $1", [id]);
        return r.rowCount
          ? send(res, 200, {})
          : authErr(res, 404, "user_not_found", "User not found");
      }
    }
    return authErr(res, 404, "not_found", `No such route ${method} ${route}`);
  } catch (error) {
    return authErr(res, 500, "unexpected_failure", String(error?.message ?? error));
  } finally {
    client.release();
  }
}

// ---------- PostgREST subset ----------
const IDENT = /^[a-z_][a-z0-9_]*$/;
const columnTypes = new Map();
async function typesOf(client, table) {
  if (!columnTypes.has(table)) {
    const { rows } = await pool.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1",
      [table],
    );
    columnTypes.set(table, new Map(rows.map((r) => [r.column_name, r.data_type])));
  }
  return columnTypes.get(table);
}
/** A column, or a JSON key of one (`metadata->>admin_name`) as PostgREST allows in filters. */
const colSql = (name) => {
  const m = name.match(/^([a-z_][a-z0-9_]*)->>([a-z_][a-z0-9_]*)$/);
  return m ? `"${m[1]}"->>'${m[2]}'` : quoteId(name);
};
const quoteId = (name) => {
  if (!IDENT.test(name)) throw Object.assign(new Error(`bad identifier ${name}`), { status: 400 });
  return `"${name}"`;
};

function filterSql(params, filters, add) {
  const parts = [];
  const one = (col, spec) => {
    let negate = false;
    let [op, ...rest] = spec.split(".");
    if (op === "not") {
      negate = true;
      [op, ...rest] = rest;
    }
    const value = rest.join(".");
    const c = colSql(col);
    let sql;
    switch (op) {
      case "eq":
        sql = `${c} = ${add(value)}`;
        break;
      case "neq":
        sql = `${c} <> ${add(value)}`;
        break;
      case "gt":
        sql = `${c} > ${add(value)}`;
        break;
      case "gte":
        sql = `${c} >= ${add(value)}`;
        break;
      case "lt":
        sql = `${c} < ${add(value)}`;
        break;
      case "lte":
        sql = `${c} <= ${add(value)}`;
        break;
      case "like":
        sql = `${c} LIKE ${add(value.replaceAll("*", "%"))}`;
        break;
      case "ilike":
        sql = `${c}::text ILIKE ${add(value.replaceAll("*", "%"))}`;
        break;
      case "is":
        sql = `${c} IS ${["null", "true", "false"].includes(value) ? value.toUpperCase() : "NULL"}`;
        break;
      case "in": {
        const items = value
          .replace(/^\(|\)$/g, "")
          .split(",")
          .map((v) => v.replace(/^"|"$/g, ""));
        sql = `${c} = ANY(${add(items)})`;
        break;
      }
      default:
        throw Object.assign(new Error(`unsupported operator ${op}`), { status: 400 });
    }
    return negate ? `NOT (${sql})` : sql;
  };
  for (const [key, value] of filters) {
    if (key === "or") {
      const inner = value.replace(/^\(|\)$/g, "");
      const terms = inner.split(/,(?![^()]*\))/).map((t) => {
        const [col, ...rest] = t.split(".");
        return one(col, rest.join("."));
      });
      parts.push(`(${terms.join(" OR ")})`);
    } else parts.push(one(key, value));
  }
  return parts;
}

async function handleRest(req, res, url, claims) {
  const path = url.pathname.replace("/rest/v1/", "");
  const role =
    claims?.role === "service_role"
      ? "service_role"
      : claims?.role === "authenticated"
        ? "authenticated"
        : "anon";
  const client = await pool.connect();
  let began = false;
  try {
    const claimsJson = JSON.stringify(claims ?? { role: "anon" });
    await client.query("BEGIN");
    began = true;
    await client.query(`SET LOCAL ROLE ${role}`);
    await client.query("SELECT set_config('request.jwt.claims', $1, true)", [claimsJson]);
    await client.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [claims?.sub ?? ""]);

    const prefer = String(req.headers.prefer ?? "");
    const wantsObject = String(req.headers.accept ?? "").includes("vnd.pgrst.object");
    const bodyBuf =
      req.method === "GET" || req.method === "HEAD" || req.method === "DELETE"
        ? Buffer.alloc(0)
        : await readBody(req);
    const body = json(bodyBuf);
    const values = [];
    const add = (v) => {
      values.push(v);
      return `$${values.length}`;
    };

    if (path.startsWith("rpc/")) {
      const fn = path.slice(4);
      quoteId(fn);
      const meta = await client.query(
        `SELECT p.proretset, t.typtype, t.typname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           JOIN pg_type t ON t.oid = p.prorettype WHERE n.nspname = 'public' AND p.proname = $1 LIMIT 1`,
        [fn],
      );
      if (!meta.rowCount) {
        await client.query("ROLLBACK");
        began = false;
        return send(res, 404, {
          code: "PGRST202",
          message: `Could not find the function public.${fn}`,
          details: null,
          hint: null,
        });
      }
      const args = Object.entries(body).map(([k, v]) => {
        const val = v !== null && typeof v === "object" ? JSON.stringify(v) : v;
        return `${quoteId(k)} => ${add(val)}`;
      });
      const call = `public.${quoteId(fn)}(${args.join(", ")})`;
      const { proretset, typtype, typname } = meta.rows[0];
      let result;
      if (typname === "void") {
        await client.query(`SELECT ${call}`, values);
        result = null;
      } else if (proretset || typtype === "c") {
        const r = await client.query(`SELECT to_jsonb(r) AS j FROM ${call} r`, values);
        result = proretset ? r.rows.map((x) => x.j) : (r.rows[0]?.j ?? null);
      } else {
        const r = await client.query(`SELECT ${call} AS j`, values);
        result = r.rows[0]?.j ?? null;
      }
      await client.query("COMMIT");
      began = false;
      return result === null && typname === "void"
        ? send(res, 204)
        : send(res, 200, JSON.stringify(result));
    }

    const table = path.split("?")[0];
    const types = await typesOf(client, table);
    if (!types.size) {
      await client.query("ROLLBACK");
      began = false;
      return send(res, 404, {
        code: "42P01",
        message: `relation "public.${table}" does not exist`,
        details: null,
        hint: null,
      });
    }
    const reserved = new Set(["select", "order", "limit", "offset", "on_conflict", "columns"]);
    const filters = [...url.searchParams.entries()].filter(([k]) => !reserved.has(k));
    const where = filterSql(url.searchParams, filters, add);
    const whereSql = where.length ? ` WHERE ${where.join(" AND ")}` : "";
    const selectParam = url.searchParams.get("select") ?? "*";
    const selectCols = selectParam === "*" ? null : selectParam.split(",").map((c) => c.trim());
    const project = (rows) =>
      selectCols ? rows.map((r) => Object.fromEntries(selectCols.map((c) => [c, r[c]]))) : rows;
    const prep = (row) => {
      const cols = Object.keys(row);
      const vals = cols.map((c) => {
        const t = types.get(c);
        if (!t)
          throw Object.assign(new Error(`column ${c} does not exist`), {
            status: 400,
            code: "42703",
          });
        const v = row[c];
        return t === "jsonb" || t === "json" ? (v === null ? null : JSON.stringify(v)) : v;
      });
      return { cols, vals };
    };

    // Like PostgREST: rows come back only when the caller asked (Prefer: return=representation),
    // so a write needs no SELECT privilege on the table unless it reads its own result.
    const ret = prefer.includes("return=representation") ? " RETURNING *" : "";
    let rows;
    let total = null;
    let status = 200;
    const t = quoteId(table);
    if (req.method === "GET" || req.method === "HEAD") {
      const order = url.searchParams.get("order");
      const orderSql = order
        ? ` ORDER BY ${order
            .split(",")
            .map((o) => {
              const [col, ...mods] = o.split(".");
              return `${quoteId(col)} ${mods.includes("desc") ? "DESC" : "ASC"}${mods.includes("nullsfirst") ? " NULLS FIRST" : mods.includes("nullslast") ? " NULLS LAST" : ""}`;
            })
            .join(", ")}`
        : "";
      const limit = url.searchParams.get("limit");
      const offset = url.searchParams.get("offset");
      if (prefer.includes("count=")) {
        const c = await client.query(`SELECT count(*)::int AS n FROM ${t}${whereSql}`, values);
        total = c.rows[0].n;
      }
      const colList = selectCols ? selectCols.map(quoteId).join(", ") : "*";
      const limSql = `${limit ? ` LIMIT ${Number(limit) | 0}` : ""}${offset ? ` OFFSET ${Number(offset) | 0}` : ""}`;
      const r = await client.query(
        `SELECT ${colList} FROM ${t}${whereSql}${orderSql}${limSql}`,
        values,
      );
      rows = r.rows;
    } else if (req.method === "POST") {
      const list = Array.isArray(body) ? body : [body];
      if (!list.length) {
        await client.query("COMMIT");
        began = false;
        return send(res, 201, "[]");
      }
      const cols = [...new Set(list.flatMap((r) => Object.keys(r)))];
      const tuples = list.map((row) => {
        const { vals } = prep(Object.fromEntries(cols.map((c) => [c, row[c] ?? null])));
        return `(${vals.map((v) => add(v)).join(", ")})`;
      });
      const conflict = url.searchParams.get("on_conflict");
      const merge = prefer.includes("resolution=merge-duplicates");
      const ignore = prefer.includes("resolution=ignore-duplicates");
      let tail = "";
      if (conflict && (merge || ignore))
        tail = merge
          ? ` ON CONFLICT (${conflict.split(",").map(quoteId).join(",")}) DO UPDATE SET ${cols.map((c) => `${quoteId(c)} = EXCLUDED.${quoteId(c)}`).join(", ")}`
          : ` ON CONFLICT (${conflict.split(",").map(quoteId).join(",")}) DO NOTHING`;
      const r = await client.query(
        `INSERT INTO ${t} (${cols.map(quoteId).join(", ")}) VALUES ${tuples.join(", ")}${tail}${ret}`,
        values,
      );
      rows = r.rows;
      status = 201;
    } else if (req.method === "PATCH") {
      const { cols, vals } = prep(body);
      if (!cols.length) throw Object.assign(new Error("empty update"), { status: 400 });
      const sets = cols.map((c, i) => `${quoteId(c)} = $${values.length + i + 1}`);
      const r = await client.query(`UPDATE ${t} SET ${sets.join(", ")}${whereSql}${ret}`, [
        ...values,
        ...vals,
      ]);
      rows = r.rows;
    } else if (req.method === "DELETE") {
      const r = await client.query(`DELETE FROM ${t}${whereSql}${ret}`, values);
      rows = r.rows;
    } else {
      throw Object.assign(new Error("method not allowed"), { status: 405 });
    }
    await client.query("COMMIT");
    began = false;

    const headers = {};
    if (total !== null) headers["content-range"] = `0-${Math.max(rows.length - 1, 0)}/${total}`;
    const returnMin =
      req.method !== "GET" && req.method !== "HEAD" && !prefer.includes("return=representation");
    if (req.method === "HEAD") return send(res, 200, undefined, headers);
    if (returnMin) return send(res, status === 201 ? 201 : 204, undefined, headers);
    const out = project(rows);
    if (wantsObject) {
      if (out.length !== 1)
        return send(res, 406, {
          code: "PGRST116",
          message: "JSON object requested, multiple (or no) rows returned",
          details: `The result contains ${out.length} rows`,
          hint: null,
        });
      return send(res, status, out[0], headers);
    }
    return send(res, status, out, headers);
  } catch (error) {
    if (began) await client.query("ROLLBACK").catch(() => {});
    const code = error.code ?? "XX000";
    const http =
      error.status ??
      (code === "42501"
        ? claims?.role === "authenticated"
          ? 403
          : 401
        : code === "23505"
          ? 409
          : code.startsWith("23")
            ? 400
            : code === "P0002"
              ? 404
              : code.startsWith("22") || code.startsWith("P0") || code.startsWith("42")
                ? 400
                : 500);
    return send(res, http, {
      code,
      message: error.message,
      details: error.detail ?? null,
      hint: error.hint ?? null,
    });
  } finally {
    client.release();
  }
}

// ---------- Storage subset ----------
const fileOf = (bucket, path) => join(FILES, `${bucket}__${Buffer.from(path).toString("hex")}`);
async function handleStorage(req, res, url, claims) {
  const route = url.pathname.replace("/storage/v1", "");
  const sub = (p) => p.split("/").map(decodeURIComponent);
  try {
    let m;
    if ((m = route.match(/^\/object\/upload\/sign\/([^/]+)\/(.+)$/)) && req.method === "POST") {
      if (claims?.role !== "service_role")
        return send(res, 403, {
          statusCode: "403",
          error: "Unauthorized",
          message: "new row violates row-level security policy",
        });
      const [bucket, ...rest] = sub(`${m[1]}/${m[2]}`);
      const path = rest.join("/");
      const token = signJwt({
        url: `${bucket}/${path}`,
        exp: Math.floor(Date.now() / 1000) + 7200,
      });
      return send(res, 200, {
        url: `/object/upload/sign/${bucket}/${encodeURI(path)}?token=${token}`,
      });
    }
    if (
      (m = route.match(/^\/object\/upload\/sign\/([^/]+)\/(.+)$/)) &&
      (req.method === "PUT" || req.method === "OPTIONS")
    ) {
      if (req.method === "OPTIONS") return send(res, 204);
      const [bucket, ...rest] = sub(`${m[1]}/${m[2]}`);
      const path = rest.join("/");
      const grant = verifyJwt(url.searchParams.get("token"));
      if (!grant || grant.url !== `${bucket}/${path}`)
        return send(res, 403, {
          statusCode: "403",
          error: "Unauthorized",
          message: "invalid token",
        });
      const buf = await readBody(req);
      const type = String(req.headers["content-type"] ?? "");
      const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
      if (!allowed.includes(type.split(";")[0]))
        return send(res, 415, {
          statusCode: "415",
          error: "invalid_mime_type",
          message: "mime type not supported",
        });
      if (buf.length > 4194304)
        return send(res, 413, {
          statusCode: "413",
          error: "Payload too large",
          message: "The object exceeded the maximum allowed size",
        });
      if (existsSync(fileOf(bucket, path)))
        return send(res, 409, {
          statusCode: "409",
          error: "Duplicate",
          message: "The resource already exists",
        });
      writeFileSync(fileOf(bucket, path), buf);
      writeFileSync(`${fileOf(bucket, path)}.type`, type);
      // Supabase lists every stored object in storage.objects; the SQL functions read it.
      await pool.query("INSERT INTO storage.objects (bucket_id, name) VALUES ($1, $2)", [
        bucket,
        path,
      ]);
      return send(res, 200, { Key: `${bucket}/${path}` });
    }
    if ((m = route.match(/^\/object\/sign\/([^/]+)\/(.+)$/)) && req.method === "POST") {
      const [bucket, ...rest] = sub(`${m[1]}/${m[2]}`);
      const path = rest.join("/");
      const allowed = claims?.role === "service_role";
      if (!allowed)
        return send(res, 404, {
          statusCode: "404",
          error: "not_found",
          message: "Object not found",
        });
      if (!existsSync(fileOf(bucket, path)))
        return send(res, 404, {
          statusCode: "404",
          error: "not_found",
          message: "Object not found",
        });
      const token = signJwt({
        url: `${bucket}/${path}`,
        exp: Math.floor(Date.now() / 1000) + Number(json(await readBody(req)).expiresIn ?? 300),
      });
      return send(res, 200, {
        signedURL: `/object/sign/${bucket}/${encodeURI(path)}?token=${token}`,
      });
    }
    if ((m = route.match(/^\/object\/sign\/([^/]+)\/(.+)$/)) && req.method === "GET") {
      const [bucket, ...rest] = sub(`${m[1]}/${m[2]}`);
      const path = rest.join("/");
      const grant = verifyJwt(url.searchParams.get("token"));
      if (!grant || grant.url !== `${bucket}/${path}` || !existsSync(fileOf(bucket, path)))
        return send(res, 400, {
          statusCode: "400",
          error: "InvalidJWT",
          message: "exp claim timestamp check failed",
        });
      res.writeHead(200, {
        "content-type": readFileSync(`${fileOf(bucket, path)}.type`, "utf8"),
        ...cors(),
      });
      return res.end(readFileSync(fileOf(bucket, path)));
    }
    if (
      (m = route.match(/^\/object\/(?:authenticated\/|info\/)?([^/]+)\/(.+)$/)) &&
      (req.method === "HEAD" || req.method === "GET")
    ) {
      const [bucket, ...rest] = sub(`${m[1]}/${m[2]}`);
      const path = rest.join("/");
      const ok = claims?.role === "service_role" && existsSync(fileOf(bucket, path));
      if (!ok)
        return send(res, 404, {
          statusCode: "404",
          error: "not_found",
          message: "Object not found",
        });
      return send(res, 200, req.method === "HEAD" ? undefined : { name: path }, {
        "content-type": "application/json",
      });
    }
    return send(res, 404, { statusCode: "404", error: "not_found", message: "Not found" });
  } catch (error) {
    return send(res, 500, {
      statusCode: "500",
      error: "internal",
      message: String(error?.message ?? error),
    });
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", BASE);
  if (req.method === "OPTIONS") return send(res, 204);
  if (url.pathname === "/health") return send(res, 200, { ok: true });
  if (url.pathname === "/keys")
    return send(res, 200, { anon: ANON_KEY, service: SERVICE_KEY, url: BASE });
  // The inbox of the stand-in: the latest recovery link for an address.
  if (url.pathname === "/test/mail") {
    const r = await pool.query(
      "SELECT link FROM lbs_test.mail WHERE to_email = $1 ORDER BY id DESC LIMIT 1",
      [String(url.searchParams.get("to") ?? "").toLowerCase()],
    );
    return send(res, 200, { link: r.rows[0]?.link ?? null });
  }
  const bearer = String(req.headers.authorization ?? "").replace(/^Bearer /i, "");
  const claims = verifyJwt(bearer) ?? verifyJwt(String(req.headers.apikey ?? ""));
  const apikey = verifyJwt(String(req.headers.apikey ?? ""));
  // A signed storage address carries its own token in the URL and needs no key, as on Supabase.
  const signed =
    url.searchParams.has("token") &&
    /^\/storage\/v1\/object\/(upload\/)?sign\//.test(url.pathname) &&
    (req.method === "PUT" || req.method === "GET");
  if (!apikey && !signed && url.pathname !== "/auth/v1/authorize")
    return send(res, 401, {
      message: "No API key found in request",
      hint: "No `apikey` request header or url param was found.",
    });
  if (url.pathname.startsWith("/auth/v1/")) return handleAuth(req, res, url, verifyJwt(bearer));
  if (url.pathname.startsWith("/rest/v1/"))
    return handleRest(req, res, url, verifyJwt(bearer) ?? claims);
  if (url.pathname.startsWith("/storage/v1/"))
    return handleStorage(req, res, url, verifyJwt(bearer) ?? claims);
  return send(res, 404, { message: "Not found" });
});

server.listen(PORT, "127.0.0.1", () =>
  process.stdout.write(`local stack listening on ${BASE}` + "\n"),
);
