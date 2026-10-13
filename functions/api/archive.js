const UPSTREAM = "https://empty-block-84d1.toxinmoy.workers.dev";
const ALLOWED_ORIGINS = new Set([
  "https://toxinhub.github.io",
  "https://roster-bps.pages.dev",
  "https://dc30fdd7.roster-bps.pages.dev",
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
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...cors(origin) },
  });
}
export async function onRequest({ request }) {
  const origin = request.headers.get("Origin") || "";
  if (origin && !ALLOWED_ORIGINS.has(origin)) return fail("ORIGIN_NOT_ALLOWED", 403, "");
  if (request.method === "OPTIONS") {
    if (!origin || !ALLOWED_ORIGINS.has(origin)) return fail("ORIGIN_NOT_ALLOWED", 403, "");
    return new Response(null, { status: 204, headers: cors(origin) });
  }
  if (!["GET", "HEAD", "POST"].includes(request.method)) return fail("METHOD_NOT_ALLOWED", 405, origin);
  const incoming = new URL(request.url);
  const target = new URL(incoming.pathname + incoming.search, UPSTREAM);
  try {
    const upstreamResponse = await fetch(new Request(target.toString(), request));
    const headers = new Headers(upstreamResponse.headers);
    headers.set("Cache-Control", "no-store, private");
    for (const [key, value] of Object.entries(cors(origin))) headers.set(key, value);
    return new Response(upstreamResponse.body, { status: upstreamResponse.status, statusText: upstreamResponse.statusText, headers });
  } catch {
    return fail("UPSTREAM_CONNECTION_FAILED", 502, origin);
  }
}
