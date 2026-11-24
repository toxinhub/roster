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
  for (const id of ["employeeSearch", "shiftFilter", "bulkDate", "bulkShift", "bulkApply", "rosterResultCount", "archiveMonth", "loadArchive", "downloadArchive", "archivePreview"]) {
    const count = html.split(`id="${id}"`).length - 1;
    assert.equal(count, 1, id + " should exist exactly once");
  }
  assert.match(html, /id="roster-editor"/);
  assert.match(html, /id="archive-history"/);
  assert.doesNotMatch(html, /class="admin-sidebar"|class="admin-overview"|id="security"/);
  assert.match(html, /id="status"/);
});

test("desktop roster toolbar allocates one column per editor control", () => {
  assert.match(
    html,
    /\.roster-tools\{display:grid;grid-template-columns:minmax\(150px,1\.4fr\) minmax\(120px,\.8fr\) minmax\(105px,\.7fr\) minmax\(130px,\.9fr\) auto;/
  );
});
