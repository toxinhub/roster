const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");

const source = fs.readFileSync(new URL("../cloudflare/worker.js", "file://" + __filename), "utf8");
const context = {
  BaseDurableObject: class {},
  TextEncoder,
  TextDecoder,
  Response,
  Request,
  Headers,
  URL,
  crypto: webcrypto,
  btoa,
  atob
};
const normalized = source
  .replace(/^import .*?;\s*/s, "")
  .replace("export class RosterCoordinator", "class RosterCoordinator")
  .replace("extends DurableObject", "extends BaseDurableObject")
  .replace("export default", "const workerDefault =");
vm.runInNewContext(
  normalized + "\nthis.__worker = workerDefault;\nthis.__Coordinator = RosterCoordinator;",
  context,
  { filename: "cloudflare/worker.js" }
);
const worker = context.__worker;
const Coordinator = context.__Coordinator;

const PROD = "https://roster-bps.pages.dev";
const PREVIEW = "https://dc30fdd7.roster-bps.pages.dev";

class MemoryKV {
  constructor() { this.values = new Map(); }
  async get(key) { return this.values.has(key) ? this.values.get(key) : null; }
  async put(key, value) { this.values.set(key, String(value)); }
  async delete(key) { this.values.delete(key); }
  async list(options = {}) {
    const keys = [...this.values.keys()]
      .filter(key => key.startsWith(options.prefix || ""))
      .sort()
      .map(name => ({ name }));
    return { keys, list_complete: true, cursor: undefined };
  }
}

function makeEnv() {
  const kv = new MemoryKV();
  const coordinator = new Coordinator({}, { ROSTER_DATA: kv });
  const stub = {
    getValue: coordinator.getValue.bind(coordinator),
    putValue: coordinator.putValue.bind(coordinator),
    deleteValue: coordinator.deleteValue.bind(coordinator),
    consumeLoginAttempt: coordinator.consumeLoginAttempt.bind(coordinator),
    saveSchedule: coordinator.saveSchedule.bind(coordinator),
    createArchive: coordinator.createArchive.bind(coordinator),
    listArchives: coordinator.listArchives.bind(coordinator)
  };
  return {
    kv,
    env: {
      SITE_PASSWORD: "site-test-password",
      ADMIN_PASSWORD: "admin-test-password",
      SESSION_SECRET: "test-session-secret-with-at-least-thirty-two-characters",
      ALLOWED_ORIGINS: PROD + "," + PREVIEW,
      ADMIN_WRITE_ORIGINS: PROD,
      REQUIRE_COORDINATOR: "true",
      ROSTER_DATA: kv,
      ROSTER_COORDINATOR: { getByName: () => stub }
    }
  };
}

function sampleRoster(overrides = {}) {
  return {
    month: "নভেম্বর ২০২৬",
    days: [{ date: "১", weekday: "রবিবার", isoDate: "2026-11-01" }],
    employees: [{ name: "কর্মী A", shifts: ["A"] }],
    shiftTypes: {
      A: { label: "সকাল", note: "06:00–14:00", color: "#123456" },
      B: { label: "বিকেল", note: "14:00–22:00", color: "#234567" },
      C: { label: "রাত", note: "22:00–06:00", color: "#345678" },
      OFF: { label: "ছুটি", note: "", color: "#456789" }
    },
    updatedAt: "2026-11-24T12:00:00.000Z",
    ...overrides
  };
}

async function call(env, path, options = {}) {
  const headers = new Headers({ Origin: options.origin || PROD });
  if (options.token) headers.set("Authorization", "Bearer " + options.token);
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  if (options.ip) headers.set("CF-Connecting-IP", options.ip);
  const request = new Request("https://worker.test" + path, {
    method: options.method || "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  return worker.fetch(request, env);
}

async function login(env, password, ip = "203.0.113.10") {
  const response = await call(env, "/api/login", {
    method: "POST",
    body: { password },
    ip
  });
  const payload = await response.json();
  assert.equal(response.status, 200, JSON.stringify(payload));
  assert.equal(payload.ok, true);
  return payload.token;
}

test("site role cannot write to the admin save endpoint", async () => {
  const { env } = makeEnv();
  const token = await login(env, "site-test-password");
  const response = await call(env, "/api/admin/save", {
    method: "POST",
    token,
    body: { data: sampleRoster(), expectedUpdatedAt: null }
  });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "ADMIN_AUTH_REQUIRED");
});

test("preview-origin admin writes are denied without touching production data", async () => {
  const { env, kv } = makeEnv();
  const token = await login(env, "admin-test-password");
  const response = await call(env, "/api/admin/save", {
    method: "POST",
    token,
    origin: PREVIEW,
    body: { data: sampleRoster(), expectedUpdatedAt: null }
  });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "PREVIEW_READ_ONLY");
  assert.equal(await kv.get("schedule"), null);
});

test("admin save accepts the current version and rejects a stale second writer", async () => {
  const { env, kv } = makeEnv();
  const token = await login(env, "admin-test-password");
  const first = sampleRoster();
  const saved = await call(env, "/api/admin/save", {
    method: "POST",
    token,
    body: { data: first, expectedUpdatedAt: null }
  });
  assert.equal(saved.status, 200);

  const stale = sampleRoster({
    month: "নভেম্বর ২০২৬ — stale edit",
    updatedAt: "2026-11-24T12:05:00.000Z"
  });
  const conflict = await call(env, "/api/admin/save", {
    method: "POST",
    token,
    body: { data: stale, expectedUpdatedAt: null }
  });
  assert.equal(conflict.status, 409);
  assert.equal((await conflict.json()).error, "WRITE_CONFLICT");
  assert.deepEqual(JSON.parse(await kv.get("schedule")), first);
});

test("admin cannot overwrite a month after it has been archived", async () => {
  const { env, kv } = makeEnv();
  const token = await login(env, "admin-test-password");
  const archived = sampleRoster();
  await kv.put("archive:2026-11", JSON.stringify(archived));

  const attempted = sampleRoster({
    month: "নভেম্বর ২০২৬ — edited",
    updatedAt: "2026-11-24T13:00:00.000Z"
  });
  const response = await call(env, "/api/admin/save", {
    method: "POST",
    token,
    body: { data: attempted, expectedUpdatedAt: null }
  });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, "MONTH_ARCHIVED");
  assert.equal(await kv.get("schedule"), null);
});

test("archive index lists only saved month keys in newest-first order and requires a session", async () => {
  const { env, kv } = makeEnv();
  const denied = await call(env, "/api/archives");
  assert.equal(denied.status, 401);

  await kv.put("archive:2026-09", JSON.stringify(sampleRoster()));
  await kv.put("archive:2026-11", JSON.stringify(sampleRoster()));
  await kv.put("archive:invalid", "{}");
  await kv.put("schedule", JSON.stringify(sampleRoster()));

  const token = await login(env, "site-test-password");
  const response = await call(env, "/api/archives", { token });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).months, ["2026-11", "2026-09"]);
});

test("archive creation is idempotently protected and the saved archive is readable", async () => {
  const { env } = makeEnv();
  const token = await login(env, "admin-test-password");
  const data = sampleRoster();
  const body = { month: "2026-11", data };

  const created = await call(env, "/api/admin/archive", { method: "POST", token, body });
  assert.equal(created.status, 200);
  const duplicate = await call(env, "/api/admin/archive", { method: "POST", token, body });
  assert.equal(duplicate.status, 409);
  assert.equal((await duplicate.json()).error, "ARCHIVE_EXISTS");

  const read = await call(env, "/api/archive?month=2026-11", { token });
  assert.equal(read.status, 200);
  assert.deepEqual(await read.json(), data);
});

test("logout revokes the issued session token immediately", async () => {
  const { env } = makeEnv();
  const token = await login(env, "site-test-password");

  const before = await call(env, "/api/session", { token });
  assert.equal(before.status, 200);
  assert.equal((await before.json()).authenticated, true);

  const loggedOut = await call(env, "/api/logout", { method: "POST", token });
  assert.equal(loggedOut.status, 200);
  assert.equal((await loggedOut.json()).ok, true);

  const after = await call(env, "/api/session", { token });
  assert.equal(after.status, 401);
  assert.equal((await after.json()).authenticated, false);

  const roster = await call(env, "/api/roster", { token });
  assert.equal(roster.status, 401);
  assert.equal((await roster.json()).error, "AUTH_REQUIRED");
});

test("login rate limiting stops the ninth attempt in the same 15-minute window", async () => {
  const { env } = makeEnv();
  const ip = "198.51.100.42";
  for (let attempt = 0; attempt < 8; attempt++) {
    const response = await call(env, "/api/login", {
      method: "POST",
      ip,
      body: { password: "incorrect-password" }
    });
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error, "INVALID_CREDENTIALS");
  }
  const limited = await call(env, "/api/login", {
    method: "POST",
    ip,
    body: { password: "incorrect-password" }
  });
  assert.equal(limited.status, 429);
  assert.equal((await limited.json()).error, "TOO_MANY_ATTEMPTS");
});

test("concurrent schedule writes with the same expected version produce one winner", async () => {
  const kv = new MemoryKV();
  const coordinator = new Coordinator({}, { ROSTER_DATA: kv });
  const a = coordinator.saveSchedule(JSON.stringify(sampleRoster({ month: "Writer A" })), true, null);
  const b = coordinator.saveSchedule(JSON.stringify(sampleRoster({ month: "Writer B" })), true, null);
  const results = await Promise.all([a, b]);
  assert.equal(results.filter(result => result.ok).length, 1);
  assert.equal(results.filter(result => result.error === "WRITE_CONFLICT").length, 1);
});

test("concurrent archive creation for the same month produces one winner", async () => {
  const kv = new MemoryKV();
  const coordinator = new Coordinator({}, { ROSTER_DATA: kv });
  const a = coordinator.createArchive("2026-11", JSON.stringify(sampleRoster({ month: "Archive A" })));
  const b = coordinator.createArchive("2026-11", JSON.stringify(sampleRoster({ month: "Archive B" })));
  const results = await Promise.all([a, b]);
  assert.equal(results.filter(result => result.ok).length, 1);
  assert.equal(results.filter(result => result.error === "ARCHIVE_EXISTS").length, 1);
});
