const SESSION_SECONDS = 8 * 60 * 60;
const encoder = new TextEncoder();
const memoryAttempts = new Map();

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store, private", ...headers }
  });
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
  return Boolean(env.SITE_PASSWORD && env.ADMIN_PASSWORD && env.SITE_PASSWORD !== env.ADMIN_PASSWORD &&
    env.SESSION_SECRET && env.SESSION_SECRET.length >= 32 && env.ROSTER_DATA);
}
async function makeToken(role, env) {
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(encoder.encode(JSON.stringify({ role, iat: now, exp: now + SESSION_SECONDS })));
  return payload + "." + b64url(await hmac(payload, env.SESSION_SECRET));
}
async function getSession(request, env) {
  try {
    const header = request.headers.get("Authorization") || "";
    if (!header.startsWith("Bearer ")) return null;
    const [payload, signature, extra] = header.slice(7).trim().split(".");
    if (!payload || !signature || extra) return null;
    const expected = await hmac(payload, env.SESSION_SECRET);
    if (!constantEqual(unb64url(signature), expected)) return null;
    const session = JSON.parse(new TextDecoder().decode(unb64url(payload)));
    const now = Math.floor(Date.now() / 1000);
    if (!["site", "admin"].includes(session.role) || !Number.isInteger(session.exp) || session.exp <= now || session.iat > now + 60) return null;
    return session;
  } catch { return null; }
}
async function requireRole(request, env, role = "site") {
  const session = await getSession(request, env);
  if (!session || (role === "admin" && session.role !== "admin")) return null;
  return session;
}
function attemptKey(request) {
  return request.headers.get("CF-Connecting-IP") || "unknown";
}
function attemptRecord(request) {
  const key = attemptKey(request);
  const now = Date.now();
  let item = memoryAttempts.get(key);
  if (!item || now - item.start > 15 * 60 * 1000) item = { count: 0, start: now };
  memoryAttempts.set(key, item);
  if (memoryAttempts.size > 2000) {
    for (const [k, v] of memoryAttempts) if (now - v.start > 15 * 60 * 1000) memoryAttempts.delete(k);
  }
  return item;
}
function canAttempt(request) {
  return attemptRecord(request).count < 8;
}
function recordFailedAttempt(request) {
  attemptRecord(request).count++;
}
function clearFailedAttempts(request) {
  memoryAttempts.delete(attemptKey(request));
}
function validRoster(data) {
  return data && typeof data === "object" && !Array.isArray(data) &&
    typeof data.month === "string" && Array.isArray(data.days) && Array.isArray(data.employees) &&
    data.employees.every(e => e && typeof e.name === "string" && Array.isArray(e.shifts));
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
        originAllowed: true
      }
    });
  }
  if (!requireConfig(env)) return json({ error: "AUTH_NOT_CONFIGURED" }, 503);

  if (path === "/api/login" && request.method === "POST") {
    if (!canAttempt(request)) return json({ error: "TOO_MANY_ATTEMPTS" }, 429, { "Retry-After": "900" });
    let body;
    try { body = await request.json(); } catch { return json({ error: "INVALID_JSON" }, 400); }
    if (typeof body.password !== "string" || body.password.length < 1 || body.password.length > 256) return json({ error: "INVALID_PASSWORD" }, 400);
    if (env.SITE_PASSWORD === env.ADMIN_PASSWORD) return json({ error: "PASSWORDS_MUST_DIFFER" }, 503);
    const supplied = await digest(body.password);
    const isAdmin = constantEqual(supplied, await digest(env.ADMIN_PASSWORD));
    const isSite = constantEqual(supplied, await digest(env.SITE_PASSWORD));
    if (!isAdmin && !isSite) {
      recordFailedAttempt(request);
      return json({ error: "INVALID_CREDENTIALS" }, 401);
    }
    clearFailedAttempts(request);
    return json({ ok: true, role: isAdmin ? "admin" : "site", token: await makeToken(isAdmin ? "admin" : "site", env), expiresIn: SESSION_SECONDS });
  }
  if (path === "/api/session" && request.method === "GET") {
    const session = await getSession(request, env);
    return session ? json({ authenticated: true, role: session.role, expiresAt: session.exp }) : json({ authenticated: false }, 401);
  }
  if (path === "/api/logout" && request.method === "POST") return json({ ok: true });
  if (path === "/api/roster" && request.method === "GET") {
    if (!await requireRole(request, env, "site")) return json({ error: "AUTH_REQUIRED" }, 401);
    const raw = await env.ROSTER_DATA.get("schedule");
    if (!raw) return json({ error: "ROSTER_NOT_SEEDED" }, 503);
    try { return json(JSON.parse(raw)); } catch { return json({ error: "ROSTER_INVALID" }, 503); }
  }
  if (path === "/api/archive" && request.method === "GET") {
    if (!await requireRole(request, env, "site")) return json({ error: "AUTH_REQUIRED" }, 401);
    const month = url.searchParams.get("month") || "";
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return json({ error: "INVALID_MONTH" }, 400);
    const raw = await env.ROSTER_DATA.get("archive:" + month);
    if (!raw) return json({ error: "NOT_FOUND" }, 404);
    try { return json(JSON.parse(raw)); } catch { return json({ error: "ARCHIVE_INVALID" }, 503); }
  }
  if (path === "/api/admin/save" && request.method === "POST") {
    if (!await requireRole(request, env, "admin")) return json({ error: "ADMIN_AUTH_REQUIRED" }, 401);
    let body;
    try { body = await request.json(); } catch { return json({ error: "INVALID_JSON" }, 400); }
    if (!validRoster(body.data)) return json({ error: "INVALID_ROSTER" }, 400);
    await env.ROSTER_DATA.put("schedule", JSON.stringify(body.data));
    return json({ ok: true, updatedAt: body.data.updatedAt || null });
  }
  if (path === "/api/admin/archive" && request.method === "POST") {
    if (!await requireRole(request, env, "admin")) return json({ error: "ADMIN_AUTH_REQUIRED" }, 401);
    let body;
    try { body = await request.json(); } catch { return json({ error: "INVALID_JSON" }, 400); }
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(body.month || "") || !validRoster(body.data)) return json({ error: "INVALID_ARCHIVE" }, 400);
    const key = "archive:" + body.month;
    if (await env.ROSTER_DATA.get(key)) return json({ error: "ARCHIVE_EXISTS" }, 409);
    await env.ROSTER_DATA.put(key, JSON.stringify(body.data));
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
