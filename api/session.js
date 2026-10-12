const { sendJson, readSession } = require("../lib/security");
module.exports = function handler(req, res) {
  if (req.method !== "GET") return sendJson(res, 405, { error: "METHOD_NOT_ALLOWED" }, { Allow: "GET" });
  const session = readSession(req);
  if (!session) return sendJson(res, 401, { authenticated: false });
  return sendJson(res, 200, { authenticated: true, role: session.role, expiresAt: session.exp });
};
