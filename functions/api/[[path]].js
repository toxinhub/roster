// Pages Functions catch-all API proxy. The upstream Worker remains the
// authority for authentication, CORS, and Admin write-origin restrictions.
const UPSTREAM_ORIGIN = "https://empty-block-84d1.toxinmoy.workers.dev";
const ALLOWED_METHODS = new Set(["GET", "HEAD", "POST", "OPTIONS"]);

export async function onRequest({ request }) {
  if (!ALLOWED_METHODS.has(request.method)) {
    return Response.json({ error: "METHOD_NOT_ALLOWED" }, { status: 405 });
  }

  const incoming = new URL(request.url);
  const target = new URL(incoming.pathname + incoming.search, UPSTREAM_ORIGIN);
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("content-length");

  // Same-origin GET requests may omit Origin. Supply the real Pages origin;
  // never substitute a production origin, or preview write restrictions break.
  if (!headers.has("Origin")) headers.set("Origin", incoming.origin);

  const init = { method: request.method, headers, redirect: "manual" };
  if (request.method !== "GET" && request.method !== "HEAD") init.body = request.body;

  try {
    const upstream = await fetch(target.toString(), init);
    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.set("Cache-Control", "no-store, private");
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
