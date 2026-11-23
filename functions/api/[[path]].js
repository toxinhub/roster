const UPSTREAM = "https://empty-block-84d1.toxinmoy.workers.dev";
const ALLOWED_ORIGINS = new Set([
  "https://toxinhub.github.io",
  "https://roster-bps.pages.dev",
  "https://dc30fdd7.roster-bps.pages.dev",
  "https://audit-fix-production-roster.roster-bps.pages.dev",
]);

function cors(origin) {
  if (!ALLOWED_ORIGINS.has(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin",
  };
}

function fail(code, status, origin) {
  return new Response(JSON.stringify({ error: code }), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store, private", ...cors(origin) },
  });
}

export async function onRequest({ request }) {
  const origin = request.headers.get("Origin") || "";
  const incoming = new URL(request.url);

  if (origin && !ALLOWED_ORIGINS.has(origin)) return fail("ORIGIN_NOT_ALLOWED", 403, "");
  if (request.method === "OPTIONS") {
    if (!origin || !ALLOWED_ORIGINS.has(origin)) return fail("ORIGIN_NOT_ALLOWED", 403, "");
    return new Response(null, { status: 204, headers: cors(origin) });
  }
  if (!["GET", "HEAD", "POST"].includes(request.method)) return fail("METHOD_NOT_ALLOWED", 405, origin);

  const target = new URL(incoming.pathname + incoming.search, UPSTREAM);
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("content-length");
  // The upstream Worker trusts only the production Pages origin. The Pages
  // proxy separately validates the browser origin and applies preview write locks.
  headers.set("Origin", "https://roster-bps.pages.dev");

  const init = { method: request.method, headers, redirect: "manual" };
  if (request.method !== "GET" && request.method !== "HEAD") init.body = request.body;

  try {
    const response = await fetch(target.toString(), init);
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set("Cache-Control", "no-store, private");
    responseHeaders.delete("Access-Control-Allow-Origin");
    for (const [key, value] of Object.entries(cors(origin))) responseHeaders.set(key, value);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch {
    return fail("UPSTREAM_CONNECTION_FAILED", 502, origin);
  }
}
