import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { webcrypto } from "node:crypto";

globalThis.crypto ??= webcrypto;

const source = await readFile(new URL("./worker.js", import.meta.url), "utf8");
const { default: worker } = await import(
  "data:text/javascript;base64," + Buffer.from(source).toString("base64")
);

const PRODUCTION_ORIGIN = "https://roster-bps.pages.dev";
const GITHUB_ORIGIN = "https://toxinhub.github.io";
const PREVIEW_ORIGIN = "https://audit-fix-production-roster.roster-bps.pages.dev";

class MemoryKV {
  constructor(seed = {}) { this.values = new Map(Object.entries(seed)); }
  async get(key) { return this.values.get(key) ?? null; }
  async put(key, value) { this.values.set(key, String(value)); }
  async delete(key) { this.values.delete(key); }
}

function makeRoster() {
  return {
    month: "সেপ্টেম্বর ২০২৬",
    updatedAt: "2026-09-30T12:00:00.000Z",
    shiftTypes: {
      A: { label: "শিফট A", note: "সকাল", color: "#F6B6AD" },
      B: { label: "শিফট B", note: "বিকাল", color: "#F8DE7E" },
      C: { label: "শিফট C", note: "রাত", color: "#A9D8E9" },
      OFF: { label: "ছুটি", note: "সাপ্তাহিক", color: "#B7E4C7" },
      L: { label: "Leave", note: "", color: "#A4243B" },
    },
    days: [
      { date: "৩০", weekday: "বুধবার", isoDate: "2026-09-30" },
      { date: "১", weekday: "বৃহস্পতিবার", isoDate: "2026-10-01" },
    ],
    employees: [
      { name: "Operator One", shifts: ["C", "A"] },
      { name: "Operator Two", shifts: ["OFF", "L"] },
    ],
  };
}

function makeEnv() {
  return {
    SITE_PASSWORD: "site-test-password",
    ADMIN_PASSWORD: "admin-test-password",
    SESSION_SECRET: "test-session-secret-with-more-than-thirty-two-characters",
    ALLOWED_ORIGINS: [PRODUCTION_ORIGIN, GITHUB_ORIGIN, PREVIEW_ORIGIN].join(","),
    ROSTER_DATA: new MemoryKV({ schedule: JSON.stringify(makeRoster()) }),
  };
}

async function call(env, path, { method = "GET", origin = PRODUCTION_ORIGIN, token, body } = {}) {
  const headers = new Headers({ Origin: origin });
  if (token) headers.set("Authorization", "Bearer " + token);
  if (body !== undefined) headers.set("Content-Type", "application/json");
  const request = new Request("https://worker.test" + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return worker.fetch(request, env);
}

async function login(env, password, origin = PRODUCTION_ORIGIN) {
  const response = await call(env, "/api/login", { method: "POST", origin, body: { password } });
  const payload = await response.json();
  assert.equal(response.status, 200);
  return payload.token;
}

test("status exposes configuration checks without exposing secrets", async () => {
  const env = makeEnv();
  const response = await call(env, "/api/status", { origin: "" });
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.configured, true);
  assert.equal(payload.checks.dataBindingPresent, true);
  assert.equal("SITE_PASSWORD" in payload, false);
});

test("malformed login JSON object is rejected without a 500", async () => {
  const env = makeEnv();
  const response = await call(env, "/api/login", { method: "POST", body: null });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "INVALID_JSON");
});

test("invalid ISO dates and shift arrays are rejected", async () => {
  const env = makeEnv();
  const token = await login(env, env.ADMIN_PASSWORD);
  const invalidDate = makeRoster();
  invalidDate.days[0].isoDate = "2026-02-30";
  let response = await call(env, "/api/admin/save", {
    method: "POST", token, body: { data: invalidDate, expectedUpdatedAt: makeRoster().updatedAt },
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "INVALID_ROSTER");

  const invalidShifts = makeRoster();
  invalidShifts.employees[0].shifts.pop();
  response = await call(env, "/api/admin/save", {
    method: "POST", token, body: { data: invalidShifts, expectedUpdatedAt: makeRoster().updatedAt },
  });
  assert.equal(response.status, 400);
});

test("displayed date and weekday must match the ISO date", async () => {
  const env = makeEnv();
  const token = await login(env, env.ADMIN_PASSWORD);

  const wrongDate = makeRoster();
  wrongDate.days[0].date = "২৯";
  let response = await call(env, "/api/admin/save", {
    method: "POST", token,
    body: { data: wrongDate, expectedUpdatedAt: makeRoster().updatedAt },
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "INVALID_ROSTER");

  const wrongWeekday = makeRoster();
  wrongWeekday.days[1].weekday = "বুধবার";
  response = await call(env, "/api/admin/save", {
    method: "POST", token,
    body: { data: wrongWeekday, expectedUpdatedAt: makeRoster().updatedAt },
  });
  assert.equal(response.status, 400);
});

test("stale Admin edits are rejected after a newer save", async () => {
  const env = makeEnv();
  const token = await login(env, env.ADMIN_PASSWORD);
  const first = makeRoster();
  first.updatedAt = "2026-09-30T13:00:00.000Z";
  let response = await call(env, "/api/admin/save", {
    method: "POST", token, body: { data: first, expectedUpdatedAt: makeRoster().updatedAt },
  });
  assert.equal(response.status, 200);

  const stale = makeRoster();
  stale.updatedAt = "2026-09-30T13:01:00.000Z";
  response = await call(env, "/api/admin/save", {
    method: "POST", token, body: { data: stale, expectedUpdatedAt: makeRoster().updatedAt },
  });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, "WRITE_CONFLICT");
});

test("Preview Admin writes are denied even with a valid Admin session", async () => {
  const env = makeEnv();
  const token = await login(env, env.ADMIN_PASSWORD, PREVIEW_ORIGIN);
  const next = makeRoster();
  next.updatedAt = "2026-09-30T13:00:00.000Z";
  const response = await call(env, "/api/admin/save", {
    method: "POST", origin: PREVIEW_ORIGIN, token,
    body: { data: next, expectedUpdatedAt: makeRoster().updatedAt },
  });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "PREVIEW_READ_ONLY");
});

test("site-role sessions cannot save roster data", async () => {
  const env = makeEnv();
  const token = await login(env, env.SITE_PASSWORD);
  const response = await call(env, "/api/admin/save", {
    method: "POST", token,
    body: { data: makeRoster(), expectedUpdatedAt: makeRoster().updatedAt },
  });
  assert.equal(response.status, 401);
});

test("archive validation allows an adjacent-month boundary day", async () => {
  const env = makeEnv();
  const token = await login(env, env.ADMIN_PASSWORD);
  const response = await call(env, "/api/admin/archive", {
    method: "POST", token,
    body: { month: "2026-09", data: makeRoster() },
  });
  assert.equal(response.status, 200);
  const duplicate = await call(env, "/api/admin/archive", {
    method: "POST", token,
    body: { month: "2026-09", data: makeRoster() },
  });
  assert.equal(duplicate.status, 409);
});

test("archive key must match the first roster date", async () => {
  const env = makeEnv();
  const token = await login(env, env.ADMIN_PASSWORD);
  const wrongMonth = makeRoster();
  wrongMonth.days[0] = { date: "১", weekday: "বৃহস্পতিবার", isoDate: "2026-10-01" };
  wrongMonth.days[1] = { date: "২", weekday: "শুক্রবার", isoDate: "2026-10-02" };
  const response = await call(env, "/api/admin/archive", {
    method: "POST", token,
    body: { month: "2026-09", data: wrongMonth },
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "INVALID_ARCHIVE");
});

test("logout revokes the session token", async () => {
  const env = makeEnv();
  const token = await login(env, env.ADMIN_PASSWORD);
  const logout = await call(env, "/api/logout", { method: "POST", token });
  assert.equal(logout.status, 200);
  const session = await call(env, "/api/session", { token });
  assert.equal(session.status, 401);
});

test("unapproved origins are rejected", async () => {
  const env = makeEnv();
  const response = await call(env, "/api/login", {
    method: "POST", origin: "https://not-approved.example", body: { password: "anything" },
  });
  assert.equal(response.status, 403);
});
