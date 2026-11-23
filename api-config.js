/* Use the current Pages deployment as its own API proxy.
   GitHub Pages uses the production Cloudflare Pages API as a fallback. */
(() => {
  const host = window.location.hostname;
  const isCloudflarePages = host === "roster-bps.pages.dev" || host.endsWith(".roster-bps.pages.dev");
  window.ROSTER_API_BASE = isCloudflarePages ? window.location.origin : "https://roster-bps.pages.dev";
})();
