const crypto = require("node:crypto");

const COOKIE_NAME = "roster_session";
const SESSION_SECONDS = 8 * 60 * 60;

function sendJson(res, status, body, extraHeaders = {}) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, private");
  for (const [key, value] of Object.entries(extraHeaders)) res.setHeader(key, value);
  res.end(JSON.stringify(body));
}

function parseCookies(req) {
  const raw = req.headers.cookie || "";
  const result = {};
  for (const part of raw.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    result[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return result;
}

function signature(value) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters");
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function createSession(role) {
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ role, iat: now, exp: now + SESSION_SECONDS })).toString("base64url");
  const value = payload + "." + signature(payload);
  return value;
}

function readSession(req) {
  try {
    const value = parseCookies(req)[COOKIE_NAME];
    if (!value) return null;
    const [payload, sig, extra] = value.split(".");
    if (!payload || !sig || extra || !safeEqual(sig, signature(payload))) return null;
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const now = Math.floor(Date.now() / 1000);
    if (!["site", "admin"].includes(session.role) || !Number.isInteger(session.exp) || session.exp <= now || session.iat > now + 60) return null;
    return session;
  } catch {
    return null;
  }
}

function setSessionCookie(res, value) {
  res.setHeader("Set-Cookie", COOKIE_NAME + "=" + encodeURIComponent(value) +
    "; Path=/; Max-Age=" + SESSION_SECONDS + "; HttpOnly; Secure; SameSite=Strict");
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", COOKIE_NAME + "=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict");
}

function originIsSame(req) {
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (!origin || !host) return false;
  try {
    const parsed = new URL(origin);
    return parsed.host.toLowerCase() === String(host).toLowerCase() && parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function requireRole(req, res, required = "site") {
  const session = readSession(req);
  const allowed = session && (required === "site" ? ["site", "admin"].includes(session.role) : session.role === "admin");
  if (!allowed) {
    sendJson(res, 401, { error: required === "admin" ? "ADMIN_AUTH_REQUIRED" : "AUTH_REQUIRED" });
    return null;
  }
  return session;
}

function verifyPassword(password, encoded) {
  return new Promise((resolve) => {
    try {
      if (typeof password !== "string" || !encoded || password.length > 256) return resolve(false);
      const parts = encoded.split("$");
      if (parts.length !== 3 || parts[0] !== "scrypt") return resolve(false);
      const salt = Buffer.from(parts[1], "base64url");
      const expected = Buffer.from(parts[2], "base64url");
      if (salt.length < 16 || expected.length !== 64) return resolve(false);
      crypto.scrypt(password, salt, expected.length, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (err, actual) => {
        resolve(!err && safeEqual(actual, expected));
      });
    } catch {
      resolve(false);
    }
  });
}

module.exports = {
  COOKIE_NAME, SESSION_SECONDS, sendJson, createSession, readSession,
  setSessionCookie, clearSessionCookie, originIsSame, requireRole, verifyPassword
};
