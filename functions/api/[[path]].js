// Pages Functions catch-all API proxy. The upstream Worker remains the
// authority for authentication and Admin write-origin restrictions.
const UPSTREAM_ORIGIN = "https://empty-block-84d1.toxinmoy.workers.dev";
const PREVIEW_HOST = "fix-roster-data-integrity.roster-bps.pages.dev";
// This legacy preview origin is already allowlisted by the deployed Worker,
// but is intentionally absent from ADMIN_WRITE_ORIGINS.
const READ_ONLY_PREVIEW_ORIGIN = "https://dc30fdd7.roster-bps.pages.dev";
const ALLOWED_METHODS = new Set(["GET", "HEAD", "POST", "OPTIONS"]);

export async function onRequest({ request }) {
  if (!ALLOWED_METHODS.has(request.method)) {
    return Response.json({ error: "METHOD_NOT_ALLOWED" }, { status: 405 });
  }

  const incoming = new URL(request.url);
  const isReadOnlyPreview = incoming.hostname === PREVIEW_HOST;
  const headers = new Headers(request.headers);
  const browserOrigin = headers.get("Origin") || "";

  // Do not turn this proxy into an open CORS relay.
  if (isReadOnlyPreview && browserOrigin && browserOrigin !== incoming.origin) {
    return Response.json({ error: "ORIGIN_NOT_ALLOWED" }, { status: 403 });
  }

  const target = new URL(incoming.pathname + incoming.search, UPSTREAM_ORIGIN);
  headers.delete("host");
  headers.delete("content-length");

  // Map only this preview host to an already-allowlisted read-only identity.
  // The upstream Worker still rejects all writes from this origin.
  if (isReadOnlyPreview) {
    headers.set("Origin", READ_ONLY_PREVIEW_ORIGIN);
  } else if (!headers.has("Origin")) {
    headers.set("Origin", incoming.origin);
  }

  const init = { method: request.method, headers, redirect: "manual" };
  if (request.method !== "GET" && request.method !== "HEAD") init.body = request.body;

  try {
    const upstream = await fetch(target.toString(), init);
    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.set("Cache-Control", "no-store, private");
    if (isReadOnlyPreview) {
      responseHeaders.set("Access-Control-Allow-Origin", incoming.origin);
      responseHeaders.set("Vary", "Origin");
    }
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders
    });
  } catch {
    return Response.json(
      { error: "UPSTREAM_CONNECTION_FAILED" },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}
