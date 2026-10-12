(() => {
  const TOKEN_KEY = "roster-api-session";
  const base = () => String(window.ROSTER_API_BASE || "").trim().replace(/\/+$/, "");
  function token() {
    try { return sessionStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; }
  }
  function setToken(value) {
    try { if (value) sessionStorage.setItem(TOKEN_KEY, value); } catch {}
  }
  function clearToken() {
    try { sessionStorage.removeItem(TOKEN_KEY); } catch {}
  }
  async function request(path, options = {}) {
    const apiBase = base();
    if (!apiBase) throw new Error("API_URL_NOT_CONFIGURED");
    const headers = new Headers(options.headers || {});
    if (token() && !/\/api\/login(?:\?|$)/.test(path)) headers.set("Authorization", "Bearer " + token());
    const response = await fetch(apiBase + path, {
      ...options,
      headers,
      mode: "cors",
      credentials: "omit",
      cache: options.cache || "no-store"
    });
    return response;
  }
  window.RosterAPI = { request, setToken, clearToken, hasToken: () => Boolean(token()) };
})();
