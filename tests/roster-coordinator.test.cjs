const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const workerSource = fs.readFileSync(new URL("../cloudflare/worker.js", "file://" + __filename), "utf8");

function loadCoordinator() {
  const start = workerSource.indexOf("export class RosterCoordinator");
  const end = workerSource.indexOf("\nfunction json(", start);
  assert.ok(start >= 0 && end > start, "RosterCoordinator class must exist in Worker source");
  const classSource = workerSource.slice(start, end)
    .replace("export class RosterCoordinator", "class RosterCoordinator")
    .replace("extends DurableObject", "extends BaseDurableObject");
  const context = { BaseDurableObject: class { constructor(ctx, env) { this.ctx = ctx; this.env = env; } } };
  vm.runInNewContext(classSource + "\nthis.RosterCoordinator = RosterCoordinator;", context);
  return context.RosterCoordinator;
}

class FakeKV {
  constructor() { this.values = new Map(); }
  async get(key) { return this.values.has(key) ? this.values.get(key) : null; }
  async put(key, value, options) {
    this.values.set(key, value);
    if (options?.expirationTtl) this.lastTtl = options.expirationTtl;
  }
  async delete(key) { return this.values.delete(key); }
}

function makeCoordinator() {
  const RosterCoordinator = loadCoordinator();
  const kv = new FakeKV();
  const ctx = {};
  const env = { ROSTER_DATA: kv };
  return { coordinator: new RosterCoordinator(ctx, env), kv };
}

test("serializes concurrent schedule saves and rejects stale revisions", async () => {
  const { coordinator, kv } = makeCoordinator();
  kv.values.set("schedule", JSON.stringify({ updatedAt: "v0" }));
  const results = await Promise.all([
    coordinator.saveSchedule(JSON.stringify({ updatedAt: "v1" }), true, "v0"),
    coordinator.saveSchedule(JSON.stringify({ updatedAt: "v2" }), true, "v0")
  ]);
  assert.equal(results.filter(result => result.ok).length, 1);
  assert.equal(results.filter(result => result.error === "WRITE_CONFLICT").length, 1);
  const saved = JSON.parse(await kv.get("schedule"));
  assert.ok(["v1", "v2"].includes(saved.updatedAt));
});

test("serializes archive creation so the same month cannot be overwritten", async () => {
  const { coordinator, kv } = makeCoordinator();
  const results = await Promise.all([
    coordinator.createArchive("2026-11", '{"version":1}'),
    coordinator.createArchive("2026-11", '{"version":2}')
  ]);
  assert.equal(results.filter(result => result.ok).length, 1);
  assert.equal(results.filter(result => result.error === "ARCHIVE_EXISTS").length, 1);
  assert.ok(['{"version":1}', '{"version":2}'].includes(await kv.get("archive:2026-11")));
});

test("atomically enforces the eight-attempt login limit", async () => {
  const { coordinator, kv } = makeCoordinator();
  const results = await Promise.all(
    Array.from({ length: 20 }, (_, index) => coordinator.consumeLoginAttempt("login-attempts:test", 1000 + index))
  );
  assert.equal(results.filter(Boolean).length, 8);
  assert.equal(results.filter(value => !value).length, 12);
  assert.equal(kv.lastTtl, 900);
});

test("serializes revocation and other key updates through the same queue", async () => {
  const { coordinator, kv } = makeCoordinator();
  await Promise.all([
    coordinator.putValue("revoked:one", "1", 120),
    coordinator.putValue("revoked:two", "1", 120),
    coordinator.deleteValue("revoked:one")
  ]);
  assert.equal(await coordinator.getValue("revoked:one"), null);
  assert.equal(await coordinator.getValue("revoked:two"), "1");
  assert.equal(kv.lastTtl, 120);
});

test("serializes reads behind an in-flight write", async () => {
  const { coordinator } = makeCoordinator();
  const write = coordinator.putValue("schedule", "latest");
  const read = coordinator.getValue("schedule");
  await write;
  assert.equal(await read, "latest");
});
