const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const html = fs.readFileSync(new URL("../admin.html", "file://" + __filename), "utf8");

test("admin inline scripts parse without syntax errors", () => {
  const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
  assert.ok(scripts.length >= 2, "expected admin app and recovery inline scripts");
  scripts.forEach((match, index) => {
    assert.doesNotThrow(() => new vm.Script(match[1], { filename: "admin-inline-" + index + ".js" }));
  });
});

test("every literal admin DOM lookup has a matching element id", () => {
  const ids = new Set([...html.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]));
  const lookups = [...html.matchAll(/\$\(["']([^"']+)["']\)/g)].map(match => match[1]);
  const missing = [...new Set(lookups.filter(id => !ids.has(id)))];
  assert.deepEqual(missing, [], "missing DOM ids: " + missing.join(", "));
});

test("roster management controls are present and uniquely identified", () => {
  for (const id of ["employeeSearch", "shiftFilter", "bulkDate", "bulkShift", "bulkApply", "rosterResultCount", "kpiEmployees", "kpiDays", "kpiA", "kpiBC"]) {
    const count = [...html.matchAll(new RegExp(`\\\\bid=[\"']${id}[\"']`, "g"))].length;
    assert.equal(count, 1, id + " should exist exactly once");
  }
  assert.match(html, /id="roster-editor"/);
  assert.match(html, /id="overview"/);
});
