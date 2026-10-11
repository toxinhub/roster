const { sendJson, requireRole } = require("../lib/security");
const { readJson } = require("../lib/github-data");
module.exports = async function handler(req, res) {
  if (req.method !== "GET") return sendJson(res, 405, { error: "METHOD_NOT_ALLOWED" }, { Allow: "GET" });
  if (!requireRole(req, res, "site")) return;
  try {
    const { data } = await readJson("schedule.json");
    return sendJson(res, 200, data, { "Cache-Control": "no-store, private" });
  } catch (error) {
    return sendJson(res, error.status === 404 ? 404 : 503, { error: error.status === 404 ? "NOT_FOUND" : "ROSTER_UNAVAILABLE" });
  }
};
