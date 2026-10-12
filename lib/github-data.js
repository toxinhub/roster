const OWNER = process.env.GITHUB_OWNER || "toxinhub";
const REPO = process.env.GITHUB_REPO || "roster";

function branch() {
  const configured = process.env.GITHUB_BRANCH;
  const runtime = process.env.VERCEL_ENV || "development";
  if (runtime === "preview" && (!configured || configured === "main")) {
    throw new Error("Preview deployments must explicitly target a non-main GITHUB_BRANCH");
  }
  if (runtime === "development" && !configured) {
    throw new Error("Set GITHUB_BRANCH explicitly for local development");
  }
  const value = configured || "main";
  if (!/^[A-Za-z0-9._/-]{1,200}$/.test(value) || value.includes("..")) throw new Error("Invalid GITHUB_BRANCH");
  if (runtime === "production" && value !== "main") throw new Error("Production must target main");
  return value;
}

function config() {
  if (!process.env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN is not configured");
  return { owner: OWNER, repo: REPO, branch: branch() };
}

async function githubRequest(path, options = {}) {
  const c = config();
  const url = "https://api.github.com/repos/" + encodeURIComponent(c.owner) + "/" +
    encodeURIComponent(c.repo) + "/contents/" + path.split("/").map(encodeURIComponent).join("/") +
    "?ref=" + encodeURIComponent(c.branch);
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: "Bearer " + process.env.GITHUB_TOKEN,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      "User-Agent": "CCTV-PJL-Roster-Security"
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store"
  });
  let data = null;
  try { data = await response.json(); } catch {}
  return { response, data };
}

async function readJson(path) {
  const { response, data } = await githubRequest(path);
  if (response.status === 404) {
    const error = new Error("NOT_FOUND");
    error.status = 404;
    throw error;
  }
  if (!response.ok || data?.type !== "file" || typeof data.content !== "string") {
    const error = new Error("GitHub read failed");
    error.status = response.status;
    throw error;
  }
  return { data: JSON.parse(Buffer.from(data.content, "base64").toString("utf8")), sha: data.sha };
}

async function writeJson(path, value, message, { createOnly = false } = {}) {
  let current = null;
  const existing = await githubRequest(path);
  if (existing.response.ok) {
    current = existing.data;
    if (createOnly) return { created: false, sha: current.sha };
  } else if (existing.response.status !== 404) {
    const error = new Error("GitHub preflight failed");
    error.status = existing.response.status;
    throw error;
  }

  const c = config();
  const url = "https://api.github.com/repos/" + encodeURIComponent(c.owner) + "/" +
    encodeURIComponent(c.repo) + "/contents/" + path.split("/").map(encodeURIComponent).join("/");
  const body = {
    message,
    content: Buffer.from(JSON.stringify(value, null, 2), "utf8").toString("base64"),
    branch: c.branch
  };
  if (current?.sha) body.sha = current.sha;
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: "Bearer " + process.env.GITHUB_TOKEN,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      "User-Agent": "CCTV-PJL-Roster-Security"
    },
    body: JSON.stringify(body),
    cache: "no-store"
  });
  let data = null;
  try { data = await response.json(); } catch {}
  if (!response.ok) {
    const error = new Error(response.status === 409 || response.status === 422 ? "WRITE_CONFLICT" : "GitHub write failed");
    error.status = response.status;
    throw error;
  }
  return { created: true, sha: data.content?.sha || null };
}

module.exports = { githubRequest, readJson, writeJson, branch };
