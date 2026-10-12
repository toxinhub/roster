(() => {
  document.documentElement.classList.add("auth-pending");
  const style = document.createElement("style");
  style.textContent = `
    html.auth-pending body > .app { visibility: hidden !important; }
    .roster-auth-layer { position: fixed; inset: 0; z-index: 2147483000; display: grid; place-items: center; padding: 18px; background: #f3eee3; color: #34291f; font-family: inherit; }
    .roster-auth-card { width: min(100%, 360px); padding: 24px; border: 1px solid #d5c8b5; border-radius: 16px; background: #fffaf1; box-shadow: 0 18px 60px rgba(45,31,18,.14); }
    .roster-auth-card h1 { margin: 0 0 6px; font-size: 22px; }
    .roster-auth-card p { margin: 0 0 16px; color: #75685b; font-size: 13px; line-height: 1.55; }
    .roster-auth-card label { display:block; font-size: 12px; font-weight: 700; }
    .roster-auth-card input { display:block; box-sizing:border-box; width:100%; margin-top:7px; padding:12px; border:1px solid #cfc1ad; border-radius:9px; background:#fff; color:#34291f; font:inherit; }
    .roster-auth-card button { width:100%; margin-top:12px; padding:12px; border:0; border-radius:9px; background:#4a392a; color:#fff8ed; font:inherit; font-weight:800; cursor:pointer; }
    .roster-auth-error { min-height:18px; margin-top:10px !important; color:#a32929 !important; font-size:12px !important; }
    .roster-auth-logout { border:1px solid currentColor; border-radius:8px; padding:6px 9px; background:transparent; color:inherit; font:inherit; font-size:11px; font-weight:800; cursor:pointer; }
    @media(prefers-color-scheme:dark) { .roster-auth-layer { background:#201a15; color:#f1e5d4; } .roster-auth-card { background:#2d251e; border-color:#514335; } .roster-auth-card p { color:#c3b4a1; } .roster-auth-card input { background:#201a15; border-color:#65533f; color:#f1e5d4; } }
  `;
  document.head.appendChild(style);

  function showLogin(message) {
    document.documentElement.classList.add("auth-pending");
    document.querySelector(".roster-auth-layer")?.remove();
    const layer = document.createElement("div");
    layer.className = "roster-auth-layer";
    const required = document.body?.dataset.requiredRole || "site";
    layer.innerHTML = `
      <form class="roster-auth-card" autocomplete="on">
        <h1>CCTV · PJL</h1>
        <p>${required === "admin" ? "Admin panel-এ প্রবেশের জন্য আলাদা Admin password দিন।" : "রোস্টার দেখতে shared site password দিন।"}</p>
        <label>পাসওয়ার্ড
          <input name="password" type="password" autocomplete="current-password" required maxlength="256" autofocus>
        </label>
        <button type="submit">প্রবেশ করুন</button>
        <p class="roster-auth-error" role="status" aria-live="polite">${message || ""}</p>
      </form>`;
    document.body.appendChild(layer);
    const form = layer.querySelector("form");
    const errorEl = form.querySelector(".roster-auth-error");
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const button = form.querySelector("button");
      button.disabled = true;
      button.textContent = "যাচাই হচ্ছে…";
      errorEl.textContent = "";
      try {
        const response = await window.RosterAPI.request("/api/login", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: form.elements.password.value })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          const messages = {
            INVALID_CREDENTIALS: "পাসওয়ার্ড সঠিক নয়।",
            AUTH_NOT_CONFIGURED: "নিরাপত্তা configuration এখনো সম্পূর্ণ হয়নি।",
            PASSWORDS_MUST_DIFFER: "Site ও Admin password আলাদা হতে হবে।",
            TOO_MANY_ATTEMPTS: "অনেকবার চেষ্টা হয়েছে। ১৫ মিনিট পরে আবার চেষ্টা করুন।",
            ORIGIN_NOT_ALLOWED: "এই পেজের উৎস অনুমোদিত নয়। Preview origin configuration পরীক্ষা করুন।"
          };
          throw new Error(messages[data.error] || "প্রবেশ করা যায়নি। আবার চেষ্টা করুন।");
        }
        window.RosterAPI.setToken(data.token);
        if (required === "admin" && data.role !== "admin") {
          form.elements.password.value = "";
          throw new Error("Admin panel-এর জন্য আলাদা Admin password প্রয়োজন।");
        }
        window.location.reload();
      } catch (error) {
        errorEl.textContent = error.message || "প্রবেশ করা যায়নি।";
      } finally {
        button.disabled = false;
        button.textContent = "প্রবেশ করুন";
      }
    });
    form.elements.password.focus();
  }

  async function init() {
    const required = document.body?.dataset.requiredRole || "site";
    try {
      const response = await window.RosterAPI.request("/api/session", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.authenticated && (required !== "admin" || data.role === "admin")) {
        document.documentElement.classList.remove("auth-pending");
        const actions = document.querySelector(".top-actions");
        if (actions && !actions.querySelector(".roster-auth-logout")) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "roster-auth-logout";
          button.textContent = "লগআউট";
          button.setAttribute("aria-label", "সাইট থেকে লগআউট");
          button.addEventListener("click", async () => {
            try {
              await window.RosterAPI.request("/api/logout", { method: "POST" });
            } finally {
              window.RosterAPI.clearToken();
              window.location.reload();
            }
          });
          actions.appendChild(button);
        }
        return;
      }
      showLogin(required === "admin" && data.role === "site" ? "Admin password প্রয়োজন।" : "");
    } catch {
      showLogin("Authentication server-এর সঙ্গে সংযোগ করা যায়নি। Preview deployment ও environment variables পরীক্ষা করুন।");
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
