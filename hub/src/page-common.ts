/** Pieces shared by the dashboard and the project tabs page. */

/** The Walkie-Talkie tab icon (an SVG data URI). */
export const FAVICON_HREF =
  "data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20viewBox%3D'0%200%2032%2032'%3E%3Cdefs%3E%3ClinearGradient%20id%3D'g'%20x1%3D'0'%20y1%3D'0'%20x2%3D'1'%20y2%3D'1'%3E%3Cstop%20offset%3D'0'%20stop-color%3D'%23818cf8'%2F%3E%3Cstop%20offset%3D'1'%20stop-color%3D'%23a78bfa'%2F%3E%3C%2FlinearGradient%3E%3C%2Fdefs%3E%3Crect%20width%3D'32'%20height%3D'32'%20rx%3D'7'%20fill%3D'url(%23g)'%2F%3E%3Crect%20x%3D'9.5'%20y%3D'2.5'%20width%3D'3'%20height%3D'9'%20rx%3D'1.5'%20fill%3D'%23fff'%2F%3E%3Crect%20x%3D'18.5'%20y%3D'6'%20width%3D'3'%20height%3D'4'%20rx%3D'1'%20fill%3D'%23fff'%2F%3E%3Crect%20x%3D'8'%20y%3D'9'%20width%3D'16'%20height%3D'20'%20rx%3D'3.5'%20fill%3D'%23fff'%2F%3E%3Crect%20x%3D'11'%20y%3D'12.5'%20width%3D'10'%20height%3D'2'%20rx%3D'1'%20fill%3D'%236d68f2'%2F%3E%3Crect%20x%3D'11'%20y%3D'16.5'%20width%3D'10'%20height%3D'2'%20rx%3D'1'%20fill%3D'%236d68f2'%2F%3E%3Crect%20x%3D'11'%20y%3D'20.5'%20width%3D'10'%20height%3D'2'%20rx%3D'1'%20fill%3D'%236d68f2'%2F%3E%3Ccircle%20cx%3D'16'%20cy%3D'25.5'%20r%3D'1.4'%20fill%3D'%236d68f2'%2F%3E%3C%2Fsvg%3E";

/** The tab icon with a green dot, shown while there are unread messages. */
export const FAVICON_DOT_HREF = FAVICON_HREF.replace(
  /%3C%2Fsvg%3E$/,
  encodeURIComponent("<circle cx='25' cy='7' r='6.5' fill='#22c55e' stroke='#fff' stroke-width='2'/></svg>"),
);

export const THEME_CSS = `  :root {
    --bg-base: #09090b;
    --bg-raised: #111114;
    --bg-surface: #18181b;
    --bg-hover: #1f1f23;
    --border: rgba(255,255,255,0.06);
    --border-subtle: rgba(255,255,255,0.04);
    --text-primary: #ececef;
    --text-secondary: #71717a;
    --text-tertiary: #52525b;
    --accent: #818cf8;
    --accent-soft: rgba(129,140,248,0.12);
    --green: #34d399;
    --green-soft: rgba(52,211,153,0.12);
    --green-border: rgba(52,211,153,0.2);
    --red: #f87171;
    --red-soft: rgba(248,113,113,0.1);
    --red-border: rgba(248,113,113,0.2);
    --yellow: #fbbf24;
    --yellow-soft: rgba(251,191,36,0.12);
    --radius: 10px;
    --font: 'DM Sans', -apple-system, sans-serif;
    --mono: 'Geist Mono', ui-monospace, monospace;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }`;

export const DIALOG_CSS = `  .dialog-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }
  .dialog {
    background: var(--bg-raised);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 24px;
    width: 420px;
    max-width: 90vw;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .dialog h2 {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }
  .dialog label {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .dialog input, .dialog textarea {
    font-family: var(--mono);
    font-size: 13px;
    padding: 8px 10px;
    background: var(--bg-surface);
    color: var(--text-primary);
    border: 1px solid var(--border);
    border-radius: 8px;
    outline: none;
    transition: border-color 0.15s ease;
  }
  .dialog input:focus, .dialog textarea:focus {
    border-color: var(--accent);
  }
  .dialog input::placeholder, .dialog textarea::placeholder {
    color: var(--text-tertiary);
  }
  .dialog textarea {
    resize: vertical;
    min-height: 60px;
  }
  .dialog .checkbox-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--text-secondary);
  }
  .dialog .checkbox-row input[type="checkbox"] {
    width: 16px;
    height: 16px;
    accent-color: var(--accent);
  }
  .dialog .dialog-buttons {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
  .dialog .dialog-buttons button {
    font-family: var(--font);
    font-size: 13px;
    font-weight: 500;
    padding: 8px 16px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .dialog .btn-cancel {
    background: transparent;
    color: var(--text-secondary);
    border: 1px solid var(--border);
  }
  .dialog .btn-cancel:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
  .dialog .btn-save {
    background: var(--accent);
    color: #fff;
    border: 1px solid var(--accent);
  }
  .dialog .btn-save:hover {
    opacity: 0.9;
  }
  .dialog .error { color: var(--red); font-size: 11px; }`;

export const LOGIN_DIALOG_HTML = `  <div class="dialog-overlay" id="login-dialog" style="display:none">
    <div class="dialog">
      <h2>Log in</h2>
      <label id="login-token-row">Admin token
        <input type="password" id="login-token" placeholder="WALKIE_TALKIE_ADMIN_TOKEN" autocomplete="current-password">
      </label>
      <label id="login-name-row">Your name
        <input type="text" id="login-name" placeholder="e.g. alice" maxlength="32" autocomplete="nickname">
      </label>
      <span id="login-error" class="error" style="display:none"></span>
      <div class="dialog-buttons">
        <button class="btn-cancel" id="login-as-operator">Continue as operator</button>
        <button class="btn-save" id="login-submit">Log in</button>
      </div>
    </div>
  </div>`;

/**
 * Login with the admin token and a name, both remembered in browser storage. The page declares
 * `ADMIN_TOKEN`, `MY_NAME`, `adminHeaders`, an `onLoggedIn()` function, `#whoami` and
 * `#switch-user-btn`, includes LOGIN_DIALOG_HTML, and calls `beginLogin()` once it is ready.
 */
export const LOGIN_SCRIPT = `    // Login: the admin token is never embedded in the page, and each person picks a name.
    // Both are remembered, so the dialog only asks for what is missing. The name is kept per tab
    // (sessionStorage) so different tabs can be different people; the last name used
    // (localStorage) is the default for new tabs.
    const TOKEN_STORAGE_KEY = "walkie-talkie-admin-token";
    const USER_STORAGE_KEY = "walkie-talkie-user-name";
    const SWITCH_USER_KEY = "walkie-talkie-switch-user";
    const loginDialogEl = document.getElementById("login-dialog");
    const loginTokenEl = document.getElementById("login-token");
    const loginNameEl = document.getElementById("login-name");
    const loginErrorEl = document.getElementById("login-error");
    const loginOperatorBtnEl = document.getElementById("login-as-operator");
    let loginNeedsToken = false;
    let loginNeedsName = false;

    function readStored(key, perTab) {
      try { return (perTab ? sessionStorage : localStorage).getItem(key) || ""; } catch { return ""; }
    }

    function store(key, value, perTab) {
      try {
        const area = perTab ? sessionStorage : localStorage;
        if (value) area.setItem(key, value);
        else area.removeItem(key);
      } catch {}
    }

    function escapeHtml(text) {
      return String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
    }

    function rememberedName() {
      if (readStored(SWITCH_USER_KEY, true)) return "";
      return readStored(USER_STORAGE_KEY, true) || readStored(USER_STORAGE_KEY);
    }

    // Resolves to null on success, or { field, error } describing what to ask for again
    function tryLogin(token, name) {
      return fetch("admin-login", { method: "POST", headers: { "Authorization": "Bearer " + token, "X-Walkie-User": name } })
        .then(r => r.json().catch(() => ({})).then(data => {
          if (r.status === 401) return { field: "token", error: "Invalid admin token" };
          if (!r.ok) return { field: "name", error: data.error || "That name can't be used" };
          ADMIN_TOKEN = token;
          MY_NAME = name;
          adminHeaders = { "Content-Type": "application/json", "Authorization": "Bearer " + token, "X-Walkie-User": name };
          store(TOKEN_STORAGE_KEY, token);
          store(USER_STORAGE_KEY, name);
          store(USER_STORAGE_KEY, name, true);
          store(SWITCH_USER_KEY, "", true);
          document.getElementById("whoami").innerHTML = "Signed in as <strong>" + escapeHtml(name) + "</strong>";
          loginDialogEl.style.display = "none";
          onLoggedIn();
          return null;
        }));
    }

    function showLogin(error) {
      document.getElementById("login-token-row").style.display = loginNeedsToken ? "" : "none";
      document.getElementById("login-name-row").style.display = loginNeedsName ? "" : "none";
      loginOperatorBtnEl.style.display = loginNeedsName ? "" : "none";
      loginErrorEl.textContent = error || "";
      loginErrorEl.style.display = error ? "" : "none";
      loginDialogEl.style.display = "flex";
      (loginNeedsToken ? loginTokenEl : loginNameEl).focus();
    }

    function submitLogin(asName) {
      const token = loginNeedsToken ? loginTokenEl.value.trim() : readStored(TOKEN_STORAGE_KEY);
      const name = asName || (loginNeedsName ? loginNameEl.value.trim() : rememberedName());
      if (!token || !name) return;
      tryLogin(token, name)
        .then(failure => {
          if (!failure) return;
          if (failure.field === "token") { store(TOKEN_STORAGE_KEY, ""); loginNeedsToken = true; }
          else {
            store(USER_STORAGE_KEY, "", true);
            if (readStored(USER_STORAGE_KEY) === name) store(USER_STORAGE_KEY, "");
            loginNeedsName = true;
          }
          showLogin(failure.error);
        })
        .catch(() => showLogin("Could not reach the Hub"));
    }

    document.getElementById("login-submit").onclick = () => submitLogin();
    loginOperatorBtnEl.onclick = () => submitLogin("operator");
    loginTokenEl.addEventListener("keydown", (e) => { if (e.key === "Enter") submitLogin(); });
    loginNameEl.addEventListener("keydown", (e) => { if (e.key === "Enter") submitLogin(); });

    // Only this browser tab switches; other tabs keep their names
    document.getElementById("switch-user-btn").onclick = () => {
      store(SWITCH_USER_KEY, "1", true);
      store(USER_STORAGE_KEY, "", true);
      location.reload();
    };

    function beginLogin() {
      loginNeedsToken = !readStored(TOKEN_STORAGE_KEY);
      loginNeedsName = !rememberedName();
      if (loginNeedsToken || loginNeedsName) showLogin();
      else submitLogin();
    }`;
