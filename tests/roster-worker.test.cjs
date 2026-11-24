const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const workerSource = fs.readFileSync(new URL("../cloudflare/worker.js", "file://" + __filename), "utf8");

function loadValidator() {
  const start = workerSource.indexOf("function validRoster");
  const end = workerSource.indexOf("async function handler", start);
  assert.ok(start >= 0 && end > start, "validRoster function must exist in Worker source");
  const context = {};
  vm.runInNewContext(workerSource.slice(start, end) + "\nthis.validRoster = validRoster;", context);
  return context.validRoster;
}

function loadJsonReader() {
  const start = workerSource.indexOf("async function readJson");
  const end = workerSource.indexOf("function jsonBodyError", start);
  assert.ok(start >= 0 && end > start, "readJson helper must exist in Worker source");
  const context = { encoder: new TextEncoder() };
  vm.runInNewContext(workerSource.slice(start, end) + "\nthis.readJson = readJson;", context);
  return context.readJson;
}

function roster(overrides = {}) {
  return {
    month: "নভেম্বর ২০২৬",
    days: [{ date: "১", weekday: "রবিবার", isoDate: "2026-11-01" }],
    employees: [{ name: "কর্মী A", shifts: ["A"] }],
    shiftTypes: {
      A: { label: "সকাল", note: "", color: "#123456" },
      B: { label: "বিকেল", note: "", color: "#234567" },
      C: { label: "রাত", note: "", color: "#345678" },
      OFF: { label: "ছুটি", note: "", color: "#456789" },
      L: { label: "ছুটি", note: "", color: "#567890" }
    },
    ...overrides
  };
}

const validRoster = loadValidator();

test("accepts a valid roster", () => {
  assert.equal(validRoster(roster()), true);
});

test("rejects impossible calendar dates", () => {
  assert.equal(validRoster(roster({ days: [{ date: "৩০", weekday: "সোমবার", isoDate: "2026-02-30" }] })), false);
});

test("rejects a weekday that does not match the ISO date", () => {
  assert.equal(validRoster(roster({ days: [{ date: "১", weekday: "সোমবার", isoDate: "2026-11-01" }] })), false);
});

test("rejects duplicate or unsorted dates", () => {
  const days = [
    { date: "২", weekday: "সোমবার", isoDate: "2026-11-02" },
    { date: "১", weekday: "রবিবার", isoDate: "2026-11-01" }
  ];
  assert.equal(validRoster(roster({ days, employees: [{ name: "কর্মী A", shifts: ["A", "B"] }] })), false);
});

test("rejects duplicate employee names ignoring case and whitespace", () => {
  const employees = [
    { name: "কর্মী A", shifts: ["A"] },
    { name: " কর্মী A ", shifts: ["B"] }
  ];
  assert.equal(validRoster(roster({ employees })), false);
});

test("rejects mismatched shift-array lengths", () => {
  assert.equal(validRoster(roster({ employees: [{ name: "কর্মী A", shifts: [] }] })), false);
});

test("rejects a roster that crosses into a second calendar month", () => {
  const days = [
    { date: "৩০", weekday: "সোমবার", isoDate: "2026-11-30" },
    { date: "১", weekday: "মঙ্গলবার", isoDate: "2026-12-01" }
  ];
  assert.equal(validRoster(roster({ days, employees: [{ name: "কর্মী A", shifts: ["A", "B"] }] })), false);
});

test("rejects unsupported shift codes and malformed colors", () => {
  assert.equal(validRoster(roster({ employees: [{ name: "কর্মী A", shifts: ["X"] }] })), false);
  const shiftTypes = { ...roster().shiftTypes, A: { label: "সকাল", note: "", color: "red" } };
  assert.equal(validRoster(roster({ shiftTypes })), false);
});

test("rejects rosters with more than 31 days", () => {
  const days = Array.from({ length: 32 }, (_, index) => {
    const date = new Date(Date.UTC(2026, 10, index + 1));
    const numeric = String(date.getUTCDate()).replace(/[0-9]/g, d => "০১২৩৪৫৬৭৮৯"[Number(d)]);
    const weekday = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"][date.getUTCDay()];
    return { date: numeric, weekday, isoDate: date.toISOString().slice(0, 10) };
  });
  assert.equal(validRoster(roster({ days, employees: [{ name: "কর্মী A", shifts: Array(32).fill("OFF") }] })), false);
});

test("rejects a visible date label that differs from the ISO date", () => {
  assert.equal(validRoster(roster({ days: [{ date: "২", weekday: "রবিবার", isoDate: "2026-11-01" }] })), false);
});

const readJson = loadJsonReader();
function request(body, declaredLength = Buffer.byteLength(body)) {
  return {
    headers: { get: name => name === "Content-Length" ? String(declaredLength) : null },
    text: async () => body
  };
}

test("parses valid JSON request bodies", async () => {
  const parsed = await readJson(request('{"ok":true}'));
  assert.equal(parsed.ok, true);
});

test("rejects malformed JSON request bodies", async () => {
  await assert.rejects(readJson(request("{")), /INVALID_JSON/);
});

test("rejects oversized declared and actual request bodies", async () => {
  await assert.rejects(readJson(request("{}", 999), 100), /BODY_TOO_LARGE/);
  await assert.rejects(readJson(request("x".repeat(300), 0), 100), /BODY_TOO_LARGE/);
});

test("enforces the smaller login request limit", async () => {
  await assert.rejects(readJson(request("x".repeat(4097)), 4096), /BODY_TOO_LARGE/);
});

test("Worker module source parses after adapting Cloudflare built-ins for Node syntax checks", () => {
  const normalized = workerSource
    .replace(/^import .*?;\s*/s, "")
    .replace("export class RosterCoordinator", "class RosterCoordinator")
    .replace("extends DurableObject", "extends BaseDurableObject")
    .replace("export default", "const workerDefault =");
  assert.doesNotThrow(() => new vm.Script(normalized, { filename: "cloudflare/worker.js" }));
});

test("frontend JavaScript files and inline scripts parse", () => {
  const authSource = fs.readFileSync(new URL("../auth.js", "file://" + __filename), "utf8");
  assert.doesNotThrow(() => new vm.Script(authSource, { filename: "auth.js" }));

  for (const file of ["index.html", "admin.html"]) {
    const html = fs.readFileSync(new URL("../" + file, "file://" + __filename), "utf8");
    const inlineScripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
      .map(match => match[1])
      .filter(source => source.trim());
    assert.ok(inlineScripts.length > 0, file + " should contain inline scripts");
    inlineScripts.forEach((source, index) => {
      assert.doesNotThrow(
        () => new vm.Script(source, { filename: file + ":inline-" + (index + 1) }),
        file + " inline script " + (index + 1) + " should parse"
      );
    });
  }
});

test("Admin prevents cross-month day additions and more than 100 employees", () => {
  const adminHtml = fs.readFileSync(new URL("../admin.html", "file://" + __filename), "utf8");
  assert.match(adminHtml, /নির্বাচিত মাসের বাইরে নতুন তারিখ যোগ করা যাবে না/);
  assert.match(adminHtml, /S\.employees\.length >= 100/);
  assert.match(adminHtml, /সব তারিখ একই মাসের হতে হবে/);
});

test("archive snapshot comparison ignores object key order but preserves array order", () => {
  const adminHtml = fs.readFileSync(new URL("../admin.html", "file://" + __filename), "utf8");
  const start = adminHtml.indexOf("function stableStringify");
  const end = adminHtml.indexOf("async function archiveIfNeeded", start);
  assert.ok(start >= 0 && end > start, "stableStringify helper must exist in admin editor");
  const context = {};
  vm.runInNewContext(adminHtml.slice(start, end) + "\nthis.stableStringify = stableStringify;", context);
  const stableStringify = context.stableStringify;
  assert.equal(
    stableStringify({ b: 1, a: { d: 2, c: 3 } }),
    stableStringify({ a: { c: 3, d: 2 }, b: 1 })
  );
  assert.notEqual(stableStringify([1, 2]), stableStringify([2, 1]));
});

test("Wrangler keeps preview origins read-only and requires the coordinator", () => {
  const config = fs.readFileSync(new URL("../cloudflare/wrangler.toml", "file://" + __filename), "utf8");
  const writeOrigins = config.match(/^ADMIN_WRITE_ORIGINS\s*=\s*"([^"]+)"/m)?.[1] || "";
  assert.ok(writeOrigins.includes("https://toxinhub.github.io"));
  assert.ok(writeOrigins.includes("https://roster-bps.pages.dev"));
  assert.doesNotMatch(writeOrigins, /preview|dc30fdd7|fix-roster-data-integrity/);
  assert.match(config, /^REQUIRE_COORDINATOR\s*=\s*"true"$/m);
  assert.match(config, /new_sqlite_classes\s*=\s*\["RosterCoordinator"\]/);
});

test("Pages API proxy preserves preview origin and restricts methods", () => {
  const proxy = fs.readFileSync(new URL("../functions/api/[[path]].js", "file://" + __filename), "utf8");
  assert.doesNotThrow(() => new vm.Script(proxy.replace("export async function", "async function")));
  assert.match(proxy, /headers\.set\("Origin", READ_ONLY_PREVIEW_ORIGIN\)/);
  assert.match(proxy, /browserOrigin !== incoming\.origin/);
  assert.match(proxy, /responseHeaders\.set\("Access-Control-Allow-Origin", incoming\.origin\)/);
  assert.match(proxy, /ALLOWED_METHODS/);
  assert.match(proxy, /PREVIEW_HOST/);
  assert.match(proxy, /ADMIN_WRITE_ORIGINS/);
});

test("malformed login requests are rejected before consuming a rate-limit attempt", () => {
  const start = workerSource.indexOf('if (path === "/api/login"');
  const end = workerSource.indexOf('if (path === "/api/session"', start);
  const login = workerSource.slice(start, end);
  assert.ok(login.indexOf("readJson") < login.indexOf("consumeLoginAttempt"));
  assert.ok(login.indexOf("INVALID_PASSWORD") < login.indexOf("consumeLoginAttempt"));
});

test("all authenticated API routes pass the coordinator-backed store", () => {
  assert.doesNotMatch(workerSource, /getSession\(request, env\);/);
  assert.doesNotMatch(workerSource, /requireRole\(request, env, ["'](?:site|admin)["']\)/);
  assert.match(workerSource, /store\.saveSchedule\(/);
  assert.match(workerSource, /store\.createArchive\(/);
  assert.match(workerSource, /store\.consumeLoginAttempt\(/);
  assert.match(workerSource, /REQUIRE_COORDINATOR/);
});


test("Admin month switching maps each employee's shifts by the matching row index", () => {
  const adminHtml = fs.readFileSync(new URL("../admin.html", "file://" + __filename), "utf8");
  const start = adminHtml.indexOf("function syncMonth()");
  const end = adminHtml.indexOf("function setPicker()", start);
  assert.ok(start >= 0 && end > start, "syncMonth function must exist");
  const syncMonth = adminHtml.slice(start, end);
  assert.match(syncMonth, /oldEmployees\.forEach\(\(emp,\s*ei\)\s*=>/);
  assert.match(syncMonth, /oldShiftByDate\[ei\]/);
});
