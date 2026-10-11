const { sendJson, createSession, setSessionCookie, originIsSame, verifyPassword } = require("../lib/security");

const attempts = new Map();
function allowedAttempt(req) {
  const key = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
  const now = Date.now();
  const item = attempts.get(key) || { count: 0, start: now };
  if (now - item.start > 15 * 60 * 1000) { item.count = 0; item.start = now; }
  item.count += 1;
  attempts.set(key, item);
  if (attempts.size > 2000) {
    for (const [k, v] of attempts) if (now - v.start > 15 * 60 * 1000) attempts.delete(k);
  }
  return item.count <= 8;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "METHOD_NOT_ALLOWED" }, { Allow: "POST" });
  if (!originIsSame(req)) return sendJson(res, 403, { error: "BAD_ORIGIN" });
  if (!allowedAttempt(req)) return sendJson(res, 429, { error: "TOO_MANY_ATTEMPTS" }, { "Retry-After": "900" });
  const siteHash = process.env.SITE_PASSWORD_HASH;
  const adminHash = process.env.ADMIN_PASSWORD_HASH;
  if (!siteHash || !adminHash || !process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) return sendJson(res, 503, { error: "AUTH_NOT_CONFIGURED" });
  const password = req.body?.password;
  if (typeof password !== "string" || password.length < 1 || password.length > 256) return sendJson(res, 400, { error: "INVALID_PASSWORD" });

  const [isAdmin, isSite] = await Promise.all([
    verifyPassword(password, adminHash),
    verifyPassword(password, siteHash)
  ]);
  if (isAdmin && isSite) return sendJson(res, 503, { error: "PASSWORDS_MUST_DIFFER" });
  if (!isAdmin && !isSite) return sendJson(res, 401, { error: "INVALID_CREDENTIALS" });
  const role = isAdmin ? "admin" : "site";
  setSessionCookie(res, createSession(role));
  return sendJson(res, 200, { ok: true, role, expiresIn: 28800 });
};
