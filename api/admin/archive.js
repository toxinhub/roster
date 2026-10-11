const { sendJson, requireRole, originIsSame } = require("../../lib/security");
const { writeJson } = require("../../lib/github-data");

function validArchive(data) {
  return data && typeof data === "object" && !Array.isArray(data) &&
    typeof data.month === "string" && Array.isArray(data.days) && Array.isArray(data.employees) &&
    data.days.length <= 40 && data.employees.length <= 100 &&
    data.employees.every(emp => emp && typeof emp.name === "string" && Array.isArray(emp.shifts) && emp.shifts.length === data.days.length);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "METHOD_NOT_ALLOWED" }, { Allow: "POST" });
  if (!originIsSame(req)) return sendJson(res, 403, { error: "BAD_ORIGIN" });
  if (!requireRole(req, res, "admin")) return;
  const month = String(req.body?.month || "");
  const data = req.body?.data;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !validArchive(data) || JSON.stringify(data).length > 200000) {
    return sendJson(res, 400, { error: "INVALID_ARCHIVE" });
  }
  try {
    const result = await writeJson("archive/" + month + ".json", data, "Archive " + month + " duty roster", { createOnly: true });
    return sendJson(res, 200, { ok: true, created: result.created });
  } catch (error) {
    return sendJson(res, 503, { error: "ARCHIVE_SAVE_FAILED" });
  }
};
