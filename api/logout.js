const { sendJson, clearSessionCookie, originIsSame } = require("../lib/security");
module.exports = function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "METHOD_NOT_ALLOWED" }, { Allow: "POST" });
  if (!originIsSame(req)) return sendJson(res, 403, { error: "BAD_ORIGIN" });
  clearSessionCookie(res);
  return sendJson(res, 200, { ok: true });
};
