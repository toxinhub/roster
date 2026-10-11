const { sendJson, requireRole, originIsSame } = require("../../lib/security");
const { writeJson } = require("../../lib/github-data");

function validRoster(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (typeof value.month !== "string" || value.month.length > 80) return false;
  if (!Array.isArray(value.days) || value.days.length > 40) return false;
  if (!Array.isArray(value.employees) || value.employees.length > 100) return false;
  if (!value.days.every(d => d && typeof d === "object" && String(d.isoDate || "").length <= 10 && String(d.date || "").length <= 8 && String(d.weekday || "").length <= 32)) return false;
  const codes = new Set(["A", "B", "C", "OFF", "L"]);
  return value.employees.every(emp => emp && typeof emp.name === "string" && emp.name.length <= 100 &&
    Array.isArray(emp.shifts) && emp.shifts.length === value.days.length && emp.shifts.every(code => codes.has(code)));
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "METHOD_NOT_ALLOWED" }, { Allow: "POST" });
  if (!originIsSame(req)) return sendJson(res, 403, { error: "BAD_ORIGIN" });
  if (!requireRole(req, res, "admin")) return;
  const data = req.body?.data;
  if (!validRoster(data)) return sendJson(res, 400, { error: "INVALID_ROSTER" });
  if (JSON.stringify(data).length > 200000) return sendJson(res, 413, { error: "ROSTER_TOO_LARGE" });
  data.updatedAt = new Date().toISOString();
  try {
    const result = await writeJson("schedule.json", data, "Update duty roster via secure admin");
    return sendJson(res, 200, { ok: true, sha: result.sha });
  } catch (error) {
    return sendJson(res, error.status === 409 || error.status === 422 ? 409 : 503, {
      error: error.message === "WRITE_CONFLICT" ? "WRITE_CONFLICT" : "SAVE_FAILED"
    });
  }
};
