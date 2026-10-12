(() => {
  document.documentElement.classList.add("auth-pending");
  const style = document.createElement("style");
  style.textContent = `
    html.auth-pending body > .app { visibility: hidden !important; }
    html.auth-pending body { overflow: hidden; }
    .roster-auth-layer {
      position: fixed; inset: 0; z-index: 2147483000; display: grid; place-items: center;
      padding: max(20px, env(safe-area-inset-top)) 18px max(20px, env(safe-area-inset-bottom));
      overflow: auto; isolation: isolate; box-sizing: border-box;
      color: #35291e; font-family: inherit;
      background:
        radial-gradient(ellipse at 12% 12%, rgba(225,190,129,.32), transparent 42%),
        radial-gradient(ellipse at 88% 82%, rgba(164,132,91,.18), transparent 40%),
        linear-gradient(145deg, #f7f1e7 0%, #eee4d5 52%, #f4ecdf 100%);
    }
    .roster-auth-layer::before, .roster-auth-layer::after {
      content: ""; position: absolute; z-index: 0; pointer-events: none; border-radius: 50%;
      filter: blur(1px); opacity: .7;
    }
    .roster-auth-layer::before {
      width: min(62vw, 390px); aspect-ratio: 1; top: -18%; right: -12%;
      background: radial-gradient(circle at 35% 35%, rgba(255,255,255,.72), rgba(218,187,139,.12) 58%, transparent 72%);
    }
    .roster-auth-layer::after {
      width: min(56vw, 340px); aspect-ratio: 1; bottom: -20%; left: -12%;
      background: radial-gradient(circle at 55% 45%, rgba(255,255,255,.62), rgba(191,159,116,.12) 60%, transparent 74%);
    }
    .roster-auth-card {
      position: relative; z-index: 1; box-sizing: border-box; width: min(100%, 390px);
      padding: 29px 27px 23px; border: 1px solid rgba(255,255,255,.82); border-radius: 21px;
      background: rgba(255,251,244,.72);
      box-shadow: 0 24px 70px rgba(73,53,31,.13), 0 3px 12px rgba(73,53,31,.06), inset 0 1px 0 rgba(255,255,255,.92);
      -webkit-backdrop-filter: blur(20px) saturate(112%); backdrop-filter: blur(20px) saturate(112%);
      animation: roster-auth-arrive .34s cubic-bezier(.2,.75,.25,1) both;
    }
    .roster-auth-card::before {
      content: "SECURE ACCESS"; display: block; margin: 0 0 15px;
      color: #8b765b; font-size: 10px; font-weight: 800; letter-spacing: .19em;
    }
    .roster-auth-card h1 {
      display: flex; align-items: center; gap: 11px; margin: 0 0 9px;
      color: #35291e; font-size: 23px; line-height: 1.25; font-weight: 800; letter-spacing: -.035em;
    }
    .roster-auth-card > p:not(.roster-auth-error):not(.roster-auth-help) {
      margin: 0 0 22px; color: #756657; font-size: 13px; line-height: 1.65;
    }
    .roster-auth-card .roster-auth-help {
      margin: 0 0 14px; color: #b0a493; font-size: 9px; font-weight: 400; line-height: 1.35;
    }
    .roster-auth-card label { display: block; color: #574637; font-size: 12px; font-weight: 750; }
    .roster-auth-card input {
      display: block; box-sizing: border-box; width: 100%; min-height: 47px; margin-top: 8px; padding: 12px 13px;
      border: 1px solid rgba(143,116,82,.31); border-radius: 11px;
      outline: none; background: rgba(255,255,255,.66); color: #35291e;
      font: inherit; font-size: 15px; box-shadow: inset 0 1px 2px rgba(67,48,29,.035);
      transition: border-color .16s ease, box-shadow .16s ease, background .16s ease;
    }
    .roster-auth-card input::placeholder { color: #9b8d7b; }
    .roster-auth-card input:focus {
      border-color: #9d7b4e; background: rgba(255,255,255,.92);
      box-shadow: 0 0 0 3px rgba(173,137,84,.15), inset 0 1px 2px rgba(67,48,29,.025);
    }
    .roster-auth-card button {
      display: flex; align-items: center; justify-content: center; box-sizing: border-box; width: 100%; min-height: 47px;
      margin-top: 14px; padding: 12px 15px; border: 1px solid rgba(255,255,255,.13); border-radius: 11px;
      color: #fff9ef; background: linear-gradient(135deg, #5e4832, #392a1e);
      box-shadow: 0 7px 16px rgba(64,45,27,.17), inset 0 1px 0 rgba(255,255,255,.14);
      font: inherit; font-size: 14px; font-weight: 800; cursor: pointer;
      transition: transform .16s ease, box-shadow .16s ease, opacity .16s ease;
    }
    .roster-auth-card button:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 10px 20px rgba(64,45,27,.21), inset 0 1px 0 rgba(255,255,255,.16); }
    .roster-auth-card button:active:not(:disabled) { transform: translateY(0); }
    .roster-auth-card button:focus-visible { outline: 3px solid rgba(157,123,78,.42); outline-offset: 3px; }
    .roster-auth-card button:disabled { cursor: wait; opacity: .72; }
    .roster-auth-error { min-height: 18px; margin: 12px 0 0 !important; color: #a13c31 !important; font-size: 12px !important; line-height: 1.5; overflow-wrap: anywhere; }
    .roster-auth-logout {
      border: 1px solid currentColor; border-radius: 8px; padding: 6px 9px; background: transparent;
      color: inherit; font: inherit; font-size: 11px; font-weight: 800; cursor: pointer;
    }
    @keyframes roster-auth-arrive { from { opacity: 0; transform: translateY(7px) scale(.99); } to { opacity: 1; transform: translateY(0) scale(1); } }
    @media (max-width: 420px) {
      .roster-auth-layer {
        padding: max(8px, env(safe-area-inset-top)) 12px max(8px, env(safe-area-inset-bottom));
        overflow-y: auto;
      }
      .roster-auth-card { padding: 18px 17px 15px; border-radius: 16px; }
      .roster-auth-card::before { margin-bottom: 9px; font-size: 9px; }
      .roster-auth-card h1 { gap: 8px; margin-bottom: 6px; font-size: 20px; }
      .roster-auth-card .roster-auth-help { margin-bottom: 12px; font-size: 9px; }
      .roster-auth-card label { font-size: 11px; }
      .roster-auth-card input { min-height: 43px; margin-top: 6px; padding: 10px 11px; font-size: 14px; }
      .roster-auth-card button { min-height: 43px; margin-top: 10px; padding: 10px 12px; }
      .roster-auth-error { margin-top: 8px !important; }
    }
    @media (max-width: 420px) and (max-height: 700px) {
      .roster-auth-card { padding-top: 14px; padding-bottom: 12px; }
      .roster-auth-card::before { margin-bottom: 7px; }
      .roster-auth-card .roster-auth-help { margin-bottom: 9px; }
      .roster-auth-card button { margin-top: 8px; }
    }
    @media (prefers-reduced-motion: reduce) {
      .roster-auth-card, .roster-auth-card input, .roster-auth-card button { animation: none !important; transition: none !important; }
    }
    @media (prefers-color-scheme: dark) {
      .roster-auth-layer {
        color: #f2e6d5;
        background:
          radial-gradient(ellipse at 12% 12%, rgba(151,112,64,.19), transparent 42%),
          radial-gradient(ellipse at 88% 82%, rgba(122,91,57,.18), transparent 40%),
          linear-gradient(145deg, #211b16 0%, #2a2119 52%, #211b16 100%);
      }
      .roster-auth-card { border-color: rgba(255,240,218,.13); background: rgba(53,42,31,.76); box-shadow: 0 24px 70px rgba(0,0,0,.28), 0 3px 12px rgba(0,0,0,.15), inset 0 1px 0 rgba(255,245,227,.08); }
      .roster-auth-card::before { color: #c6aa82; }
      .roster-auth-card h1 { color: #f2e6d5; }
      .roster-auth-card > p:not(.roster-auth-error) { color: #c8b8a3; }
      .roster-auth-card label { color: #e0cfb9; }
      .roster-auth-card .roster-auth-help { color: #a99a85; }
      .roster-auth-card input { border-color: rgba(218,190,151,.24); background: rgba(29,23,18,.56); color: #f5e9d8; }
      .roster-auth-card input:focus { border-color: #b99461; background: rgba(29,23,18,.8); }
      .roster-auth-card button { background: linear-gradient(135deg, #8b6a42, #60472d); color: #fff7e9; }
      .roster-auth-error { color: #ffb0a4 !important; }
    }
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
        <h1>📹 · PJL</h1>
        ${required === "admin" ? '<p>Admin panel-এ প্রবেশের জন্য আলাদা Admin password দিন।</p>' : ""}
        ${required === "site" ? '<p class="roster-auth-help">পাসওয়ার্ড না জানা থাকলে তন্ময়ের সাথে যোগাযোগ করুন...</p>' : ""}
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
          window.RosterAPI.clearToken();
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
