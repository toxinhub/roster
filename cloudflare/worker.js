import { DurableObject } from "cloudflare:workers";

const SESSION_SECONDS = 8 * 60 * 60;
const encoder = new TextEncoder();

// One coordinator represents the single shared CCTV roster. All compound
// writes are serialized here; Workers KV remains the durable data store.
export class RosterCoordinator extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.rosterData = env.ROSTER_DATA;
    this.queue = Promise.resolve();
  }

  runExclusive(operation) {
    const current = this.queue.then(operation, operation);
    this.queue = current.then(() => undefined, () => undefined);
    return current;
  }

  getValue(key) {
    return this.runExclusive(() => this.rosterData.get(key));
  }

  putValue(key, value, expirationTtl) {
    return this.runExclusive(async () => {
      const options = Number.isInteger(expirationTtl) && expirationTtl > 0
        ? { expirationTtl }
        : undefined;
      await this.rosterData.put(key, value, options);
      return true;
    });
  }

  deleteValue(key) {
    return this.runExclusive(() => this.rosterData.delete(key));
  }

  consumeLoginAttempt(key, now) {
    return this.runExclusive(async () => {
      let item;
      try { item = JSON.parse(await this.rosterData.get(key) || "null"); } catch {}
      if (!item || !Number.isFinite(item.start) || now - item.start > 15 * 60 * 1000) {
        item = { count: 0, start: now };
      }
      if (item.count >= 8) return false;
      item.count++;
      await this.rosterData.put(key, JSON.stringify(item), { expirationTtl: 900 });
      return true;
    });
  }

  saveSchedule(dataJson, enforceVersion, expectedUpdatedAt, targetMonth) {
    return this.runExclusive(async () => {
      if (targetMonth && await this.rosterData.get("archive:" + targetMonth)) {
        return { ok: false, error: "MONTH_ARCHIVED" };
      }
      if (enforceVersion) {
        const currentRaw = await this.rosterData.get("schedule");
        let currentUpdatedAt = null;
        try { currentUpdatedAt = currentRaw ? (JSON.parse(currentRaw).updatedAt ?? null) : null; }
        catch { return { ok: false, error: "ROSTER_INVALID" }; }
        if (expectedUpdatedAt !== currentUpdatedAt) return { ok: false, error: "WRITE_CONFLICT" };
      }
      await this.rosterData.put("schedule", dataJson);
      return { ok: true };
    });
  }

  async updateArchiveIndex(month) {
    const storage = this.ctx?.storage;
    if (!storage) return;
    let indexed = await storage.get("archive-month-index");
    if (!Array.isArray(indexed)) indexed = await listArchiveMonths(this.rosterData);
    const months = [...new Set([...indexed, month])].sort((a, b) => b.localeCompare(a));
    await storage.put("archive-month-index", months);
  }

  createArchive(month, dataJson) {
    return this.runExclusive(async () => {
      const key = "archive:" + month;
      if (await this.rosterData.get(key)) {
        await this.updateArchiveIndex(month);
        return { ok: false, error: "ARCHIVE_EXISTS" };
      }
      await this.rosterData.put(key, dataJson);
      await this.updateArchiveIndex(month);
      return { ok: true };
    });
  }

  listArchives() {
    return this.runExclusive(async () => {
      const storage = this.ctx?.storage;
      const indexed = storage ? await storage.get("archive-month-index") : [];
      const discovered = await listArchiveMonths(this.rosterData);
      const months = [...new Set([...(Array.isArray(indexed) ? indexed : []), ...discovered])]
        .filter(month => /^\d{4}-(0[1-9]|1[0-2])$/.test(month))
        .sort((a, b) => b.localeCompare(a));
      if (storage && (!Array.isArray(indexed) || months.length !== indexed.length)) {
        await storage.put("archive-month-index", months);
      }
      return months;
    });
  }
}

async function listArchiveMonths(kv) {
  const months = new Set();
  let cursor;
  do {
    const options = { prefix: "archive:", limit: 1000 };
    if (cursor) options.cursor = cursor;
    const page = await kv.list(options);
    for (const item of page.keys || []) {
      const match = /^archive:(\d{4}-(?:0[1-9]|1[0-2]))$/.exec(item.name || "");
      if (match) months.add(match[1]);
    }
    cursor = page.list_complete ? null : page.cursor;
    if (!page.list_complete && !cursor) throw new Error("ARCHIVE_LIST_INCOMPLETE");
  } while (cursor);
  return [...months].sort((a, b) => b.localeCompare(a));
}


function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store, private", ...headers }
  });
}
async function readJson(request, maxBytes = 262144) {
  const declaredLength = Number(request.headers.get("Content-Length") || 0);
  if (declaredLength > maxBytes) throw new Error("BODY_TOO_LARGE");
  const raw = await request.text();
  if (encoder.encode(raw).byteLength > maxBytes) throw new Error("BODY_TOO_LARGE");
  try { return JSON.parse(raw); } catch { throw new Error("INVALID_JSON"); }
}
function jsonBodyError(error) {
  const tooLarge = error?.message === "BODY_TOO_LARGE";
  return json({ error: tooLarge ? "BODY_TOO_LARGE" : "INVALID_JSON" }, tooLarge ? 413 : 400);
}
function b64url(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function unb64url(value) {
  const raw = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(raw + "=".repeat((4 - raw.length % 4) % 4));
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}
async function hmac(value, secret) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}
async function digest(value) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}
function constantEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || "https://toxinhub.github.io")
    .split(",").map(s => s.trim()).filter(Boolean);
}

function adminWriteOrigins(env) {
  // Preview deployments share the upstream Worker in this project. Only the
  // two production frontend origins may write to the live KV namespace.
  return String(env.ADMIN_WRITE_ORIGINS || "https://toxinhub.github.io,https://roster-bps.pages.dev")
    .split(",").map(s => s.trim()).filter(Boolean);
}
function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = allowedOrigins(env);
  if (!allowed.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin"
  };
}
function withCors(response, cors) {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(cors)) headers.set(k, v);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
function requireConfig(env) {
  const coordinatorRequired = String(env.REQUIRE_COORDINATOR || "").toLowerCase() === "true";
  return Boolean(env.SITE_PASSWORD && env.ADMIN_PASSWORD && env.SITE_PASSWORD !== env.ADMIN_PASSWORD &&
    env.SESSION_SECRET && env.SESSION_SECRET.length >= 32 && env.ROSTER_DATA &&
    (!coordinatorRequired || env.ROSTER_COORDINATOR));
}

function dataStore(env) {
  if (env.ROSTER_COORDINATOR) {
    const stub = env.ROSTER_COORDINATOR.getByName("cctv-roster-primary");
    return {
      get: key => stub.getValue(key),
      put: (key, value, options) => stub.putValue(key, value, options?.expirationTtl),
      delete: key => stub.deleteValue(key),
      consumeLoginAttempt: (key, now) => stub.consumeLoginAttempt(key, now),
      saveSchedule: (data, enforceVersion, expected, targetMonth) => stub.saveSchedule(data, enforceVersion, expected, targetMonth),
      createArchive: (month, data) => stub.createArchive(month, data),
      listArchives: () => stub.listArchives()
    };
  }
  return {
    get: key => env.ROSTER_DATA.get(key),
    put: (key, value, options) => env.ROSTER_DATA.put(key, value, options),
    delete: key => env.ROSTER_DATA.delete(key),
    consumeLoginAttempt: null,
    saveSchedule: null,
    createArchive: null,
    listArchives: () => listArchiveMonths(env.ROSTER_DATA)
  };
}
async function makeToken(role, env) {
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(encoder.encode(JSON.stringify({ role, iat: now, exp: now + SESSION_SECONDS, jti: crypto.randomUUID() })));
  return payload + "." + b64url(await hmac(payload, env.SESSION_SECRET));
}
async function getSession(request, env, store) {
  try {
    const header = request.headers.get("Authorization") || "";
    if (!header.startsWith("Bearer ")) return null;
    const [payload, signature, extra] = header.slice(7).trim().split(".");
    if (!payload || !signature || extra) return null;
    const expected = await hmac(payload, env.SESSION_SECRET);
    if (!constantEqual(unb64url(signature), expected)) return null;
    const session = JSON.parse(new TextDecoder().decode(unb64url(payload)));
    const now = Math.floor(Date.now() / 1000);
    if (!["site", "admin"].includes(session.role) || !Number.isInteger(session.exp) || session.exp <= now || session.iat > now + 60 || typeof session.jti !== "string") return null;
    if (await store.get("revoked:" + session.jti)) return null;
    return session;
  } catch { return null; }
}
async function requireRole(request, env, store, role = "site") {
  const session = await getSession(request, env, store);
  if (!session || (role === "admin" && session.role !== "admin")) return null;
  return session;
}
async function attemptKey(request) {
  // Hash the IP before storing the rate-limit key; never store the raw IP in KV.
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const hash = await digest(ip);
  return "login-attempts:" + Array.from(hash, b => b.toString(16).padStart(2, "0")).join("");
}
async function attemptRecord(request, env) {
  const key = await attemptKey(request);
  const now = Date.now();
  let item;
  try { item = JSON.parse(await env.ROSTER_DATA.get(key) || "null"); } catch {}
  if (!item || !Number.isFinite(item.start) || now - item.start > 15 * 60 * 1000) {
    item = { count: 0, start: now };
  }
  return { key, item };
}
async function canAttempt(request, env) {
  const { item } = await attemptRecord(request, env);
  return item.count < 8;
}
async function recordFailedAttempt(request, env) {
  const { key, item } = await attemptRecord(request, env);
  item.count++;
  await env.ROSTER_DATA.put(key, JSON.stringify(item), { expirationTtl: 900 });
}
async function clearFailedAttempts(request, env) {
  await env.ROSTER_DATA.delete(await attemptKey(request));
}
function validRoster(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  if (typeof data.month !== "string" || !data.month.trim() || data.month.length > 80) return false;
  if (!Array.isArray(data.days) || data.days.length < 1 || data.days.length > 31) return false;
  if (!Array.isArray(data.employees) || data.employees.length > 100) return false;
  if (!data.shiftTypes || typeof data.shiftTypes !== "object" || Array.isArray(data.shiftTypes)) return false;

  const allowedCodes = new Set(["A", "B", "C", "OFF", "L"]);
  for (const required of ["A", "B", "C", "OFF"]) {
    if (!Object.prototype.hasOwnProperty.call(data.shiftTypes, required)) return false;
  }
  for (const [code, type] of Object.entries(data.shiftTypes)) {
    if (!allowedCodes.has(code) || !type || typeof type !== "object" || Array.isArray(type)) return false;
    if (typeof type.label !== "string" || !type.label.trim() || type.label.length > 40) return false;
    if (type.note != null && (typeof type.note !== "string" || type.note.length > 120)) return false;
    if (typeof type.color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(type.color)) return false;
  }

  const dates = new Set();
  let previousDate = "";
  for (const day of data.days) {
    if (!day || typeof day !== "object" || Array.isArray(day)) return false;
    if (typeof day.date !== "string" || !day.date.trim() || day.date.length > 8) return false;
    if (typeof day.weekday !== "string" || !day.weekday.trim() || day.weekday.length > 24) return false;
    if (typeof day.isoDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day.isoDate)) return false;
    const parsed = new Date(day.isoDate + "T00:00:00.000Z");
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== day.isoDate) return false;
    const numericDate = Number(day.date.replace(/[০-৯]/g, digit => String("০১২৩৪৫৬৭৮৯".indexOf(digit))));
    const weekdays = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"];
    if (!Number.isInteger(numericDate) || numericDate !== parsed.getUTCDate()) return false;
    if (day.weekday !== weekdays[parsed.getUTCDay()]) return false;
    if (dates.size && day.isoDate.slice(0, 7) !== previousDate.slice(0, 7)) return false;
    if (dates.has(day.isoDate) || (previousDate && day.isoDate <= previousDate)) return false;
    dates.add(day.isoDate);
    previousDate = day.isoDate;
  }

  const names = new Set();
  for (const employee of data.employees) {
    if (!employee || typeof employee !== "object" || Array.isArray(employee)) return false;
    if (typeof employee.name !== "string" || !employee.name.trim() || employee.name.length > 80) return false;
    const normalizedName = employee.name.trim().toLocaleLowerCase();
    if (names.has(normalizedName)) return false;
    names.add(normalizedName);
    if (!Array.isArray(employee.shifts) || employee.shifts.length !== data.days.length) return false;
    if (!employee.shifts.every(code => typeof code === "string" && allowedCodes.has(code))) return false;
  }

  if (data.updatedAt != null && (typeof data.updatedAt !== "string" || data.updatedAt.length > 100)) return false;
  return true;
}
async function handler(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (!path.startsWith("/api/")) return json({ error: "NOT_FOUND" }, 404);
  const requestOrigin = request.headers.get("Origin") || "";
  // Status exposes only boolean configuration checks, so it can also be opened directly.
  if (!(path === "/api/status" && !requestOrigin) && !allowedOrigins(env).includes(requestOrigin)) {
    return json({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  }
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  }
  if (path === "/api/status" && request.method === "GET") {
    return json({
      configured: requireConfig(env),
      checks: {
        sitePasswordPresent: Boolean(env.SITE_PASSWORD),
        adminPasswordPresent: Boolean(env.ADMIN_PASSWORD),
        siteAndAdminPasswordsDiffer: Boolean(env.SITE_PASSWORD && env.ADMIN_PASSWORD && env.SITE_PASSWORD !== env.ADMIN_PASSWORD),
        sessionSecretLengthAtLeast32: Boolean(env.SESSION_SECRET && env.SESSION_SECRET.length >= 32),
        dataBindingPresent: Boolean(env.ROSTER_DATA),
        coordinatorBindingPresent: Boolean(env.ROSTER_COORDINATOR),
        strongCoordinationEnabled: Boolean(env.ROSTER_COORDINATOR),
        coordinatorRequired: String(env.REQUIRE_COORDINATOR || "").toLowerCase() === "true",
        originAllowed: true
      }
    });
  }
  if (!requireConfig(env)) return json({ error: "AUTH_NOT_CONFIGURED" }, 503);
  const store = dataStore(env);

  if (path === "/api/login" && request.method === "POST") {
    let body;
    try { body = await readJson(request, 4096); } catch (error) { return jsonBodyError(error); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "INVALID_JSON" }, 400);
    if (typeof body.password !== "string" || body.password.length < 1 || body.password.length > 256) return json({ error: "INVALID_PASSWORD" }, 400);
    const loginKey = await attemptKey(request);
    const allowed = store.consumeLoginAttempt
      ? await store.consumeLoginAttempt(loginKey, Date.now())
      : await canAttempt(request, env);
    if (!allowed) return json({ error: "TOO_MANY_ATTEMPTS" }, 429, { "Retry-After": "900" });
    if (env.SITE_PASSWORD === env.ADMIN_PASSWORD) return json({ error: "PASSWORDS_MUST_DIFFER" }, 503);
    const supplied = await digest(body.password);
    const isAdmin = constantEqual(supplied, await digest(env.ADMIN_PASSWORD));
    const isSite = constantEqual(supplied, await digest(env.SITE_PASSWORD));
    if (!isAdmin && !isSite) {
      if (!store.consumeLoginAttempt) await recordFailedAttempt(request, env);
      return json({ error: "INVALID_CREDENTIALS" }, 401);
    }
    if (store.consumeLoginAttempt) await store.delete(loginKey);
    else await clearFailedAttempts(request, env);
    return json({ ok: true, role: isAdmin ? "admin" : "site", token: await makeToken(isAdmin ? "admin" : "site", env), expiresIn: SESSION_SECONDS });
  }
  if (path === "/api/session" && request.method === "GET") {
    const session = await getSession(request, env, store);
    return session ? json({ authenticated: true, role: session.role, expiresAt: session.exp }) : json({ authenticated: false }, 401);
  }
  if (path === "/api/logout" && request.method === "POST") {
    const session = await getSession(request, env, store);
    if (!session) return json({ error: "AUTH_REQUIRED" }, 401);
    const remaining = Math.max(1, session.exp - Math.floor(Date.now() / 1000));
    await store.put("revoked:" + session.jti, "1", { expirationTtl: remaining });
    return json({ ok: true });
  }
  if (path === "/api/roster" && request.method === "GET") {
    if (!await requireRole(request, env, store, "site")) return json({ error: "AUTH_REQUIRED" }, 401);
    const raw = await store.get("schedule");
    if (!raw) return json({ error: "ROSTER_NOT_SEEDED" }, 503);
    try { return json(JSON.parse(raw)); } catch { return json({ error: "ROSTER_INVALID" }, 503); }
  }
  if (path === "/api/archives" && request.method === "GET") {
    if (!await requireRole(request, env, store, "site")) return json({ error: "AUTH_REQUIRED" }, 401);
    return json({ months: await store.listArchives() });
  }
  if (path === "/api/archive" && request.method === "GET") {
    if (!await requireRole(request, env, store, "site")) return json({ error: "AUTH_REQUIRED" }, 401);
    const month = url.searchParams.get("month") || "";
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return json({ error: "INVALID_MONTH" }, 400);
    const raw = await store.get("archive:" + month);
    if (!raw) return json({ error: "NOT_FOUND" }, 404);
    try { return json(JSON.parse(raw)); } catch { return json({ error: "ARCHIVE_INVALID" }, 503); }
  }
  if (path === "/api/admin/save" && request.method === "POST") {
    if (!await requireRole(request, env, store, "admin")) return json({ error: "ADMIN_AUTH_REQUIRED" }, 401);
    if (!adminWriteOrigins(env).includes(requestOrigin)) return json({ error: "PREVIEW_READ_ONLY" }, 403);
    let body;
    try { body = await readJson(request, 262144); } catch (error) { return jsonBodyError(error); }
    if (!body || typeof body !== "object" || Array.isArray(body) || !validRoster(body.data)) return json({ error: "INVALID_ROSTER" }, 400);
    const enforceVersion = Object.prototype.hasOwnProperty.call(body, "expectedUpdatedAt");
    if (enforceVersion && body.expectedUpdatedAt !== null && typeof body.expectedUpdatedAt !== "string") {
      return json({ error: "INVALID_VERSION" }, 400);
    }
    const targetMonth = body.data.days[0].isoDate.slice(0, 7);
    if (store.saveSchedule) {
      const saved = await store.saveSchedule(JSON.stringify(body.data), enforceVersion, body.expectedUpdatedAt, targetMonth);
      if (!saved.ok) return json({ error: saved.error }, saved.error === "WRITE_CONFLICT" || saved.error === "MONTH_ARCHIVED" ? 409 : 503);
    } else {
      if (await store.get("archive:" + targetMonth)) return json({ error: "MONTH_ARCHIVED" }, 409);
      if (enforceVersion) {
        const currentRaw = await store.get("schedule");
        let currentUpdatedAt = null;
        try { currentUpdatedAt = currentRaw ? (JSON.parse(currentRaw).updatedAt ?? null) : null; }
        catch { return json({ error: "ROSTER_INVALID" }, 503); }
        if (body.expectedUpdatedAt !== currentUpdatedAt) return json({ error: "WRITE_CONFLICT" }, 409);
      }
      await store.put("schedule", JSON.stringify(body.data));
    }
    return json({ ok: true, updatedAt: body.data.updatedAt || null });
  }
  if (path === "/api/admin/archive" && request.method === "POST") {
    if (!await requireRole(request, env, store, "admin")) return json({ error: "ADMIN_AUTH_REQUIRED" }, 401);
    if (!adminWriteOrigins(env).includes(requestOrigin)) return json({ error: "PREVIEW_READ_ONLY" }, 403);
    let body;
    try { body = await readJson(request, 262144); } catch (error) { return jsonBodyError(error); }
    if (!body || typeof body !== "object" || Array.isArray(body) ||
        !/^\d{4}-(0[1-9]|1[0-2])$/.test(body.month || "") ||
        !validRoster(body.data) ||
        body.data.days[0].isoDate.slice(0, 7) !== body.month) {
      return json({ error: "INVALID_ARCHIVE" }, 400);
    }
    if (store.createArchive) {
      const archived = await store.createArchive(body.month, JSON.stringify(body.data));
      if (!archived.ok) return json({ error: archived.error }, 409);
    } else {
      const key = "archive:" + body.month;
      if (await store.get(key)) return json({ error: "ARCHIVE_EXISTS" }, 409);
      await store.put(key, JSON.stringify(body.data));
    }
    return json({ ok: true, month: body.month });
  }
  return json({ error: "NOT_FOUND" }, 404);
}
export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    try {
      return withCors(await handler(request, env), cors);
    } catch {
      return withCors(json({ error: "INTERNAL_ERROR" }, 500), cors);
    }
  }
};