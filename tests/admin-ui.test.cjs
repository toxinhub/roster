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

test("current admin editor controls are present and uniquely identified", () => {
  for (const id of ["monthPicker", "month", "addDay", "addEmp", "editor", "save", "download", "status", "changeStatus", "changeSummary"]) {
    const count = html.split(`id="${id}"`).length - 1;
    assert.equal(count, 1, id + " should exist exactly once");
  }
  assert.match(html, /id="weekView"/);
  assert.match(html, /id="monthView"/);
  assert.match(html, /id="weekNav"/);
});

test("admin layout uses the current responsive centered shell", () => {
  assert.doesNotMatch(html, /topbar\{margin-left:232px\}|page-shell\{max-width:none;margin-left:250px/);
  assert.match(html, /body\.admin-page main\.page-shell\{width:min\(1160px,calc\(100% - 32px\)\)!important/);
  assert.match(html, /@media\(max-width:700px\)[\s\S]*?main\.page-shell\{width:calc\(100% - 20px\)/);
  assert.match(html, /#editor\{width:max-content;min-width:100%/);
});

test("roster editor exposes date and employee controls with delegated rendering", () => {
  assert.match(html, /<button id="addDay" type="button">\+ তারিখ<\/button>/);
  assert.match(html, /<button id="addEmp" type="button">\+ কর্মী<\/button>/);
  assert.match(html, /function render\(\)/);
  assert.match(html, /S\.employees\.map\(/);
});
