import {
  DIALOG_CSS,
  FAVICON_DOT_HREF,
  FAVICON_HREF,
  LOGIN_DIALOG_HTML,
  LOGIN_SCRIPT,
  THEME_CSS,
} from "./page-common.js";
import { DEFAULT_PROJECT } from "./projects.js";

/**
 * The page at "/": one tab per project, each showing that project's dashboard (/p/<name>/) in
 * an iframe. It handles the login for all tabs, keeps unread badges for every project, and
 * creates and archives projects.
 */
export function getShellHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Walkie-Talkie</title>
<link rel="icon" type="image/svg+xml" href="${FAVICON_HREF}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
${THEME_CSS}
  html, body { height: 100%; }
  body {
    font-family: var(--font);
    background: var(--bg-base);
    color: var(--text-primary);
    display: flex;
    flex-direction: column;
    -webkit-font-smoothing: antialiased;
  }
  header {
    height: 44px;
    padding: 0 16px;
    background: var(--bg-raised);
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 14px;
    flex-shrink: 0;
  }
  .logo { display: flex; align-items: center; gap: 9px; flex-shrink: 0; }
  .logo-icon {
    width: 22px; height: 22px; border-radius: 6px;
    background: linear-gradient(135deg, var(--accent), #a78bfa);
    display: grid; place-items: center;
  }
  .logo-icon svg { width: 13px; height: 13px; fill: none; stroke: #fff; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  header h1 { font-size: 14px; font-weight: 600; letter-spacing: -0.01em; }
  .header-sep { width: 1px; height: 18px; background: var(--border); flex-shrink: 0; }
  #tabs {
    display: flex;
    align-items: stretch;
    gap: 2px;
    height: 100%;
    overflow-x: auto;
    scrollbar-width: none;
    min-width: 0;
  }
  .tab {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 0 12px;
    font-size: 13px;
    color: var(--text-secondary);
    border-bottom: 2px solid transparent;
    cursor: pointer;
    white-space: nowrap;
    user-select: none;
    transition: color 0.15s ease, background 0.15s ease;
  }
  .tab:hover { color: var(--text-primary); background: var(--bg-hover); }
  .tab.active { color: var(--text-primary); border-bottom-color: var(--accent); }
  .tab .badge {
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 500;
    min-width: 18px;
    padding: 1px 6px;
    border-radius: 100px;
    background: var(--accent);
    color: #fff;
    text-align: center;
  }
  .tab .archive-btn {
    font-size: 14px;
    line-height: 1;
    color: var(--text-tertiary);
    background: none;
    border: none;
    cursor: pointer;
    padding: 2px 3px;
    border-radius: 4px;
    visibility: hidden;
  }
  .tab:hover .archive-btn, .tab.active .archive-btn { visibility: visible; }
  .tab .archive-btn:hover { color: var(--red); background: rgba(248,113,113,0.1); }
  #new-project-btn, .header-btn {
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 500;
    padding: 4px 10px;
    background: transparent;
    color: var(--text-tertiary);
    border: 1px solid var(--border);
    border-radius: 6px;
    cursor: pointer;
    flex-shrink: 0;
    transition: all 0.15s ease;
  }
  #new-project-btn:hover, .header-btn:hover { color: var(--text-primary); background: var(--bg-hover); }
  .spacer { flex: 1; }
  .whoami { font-size: 12px; color: var(--text-secondary); white-space: nowrap; }
  .whoami strong { color: var(--text-primary); font-weight: 500; }
  #frames { flex: 1; position: relative; min-height: 0; }
  #frames iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; display: none; background: var(--bg-base); }
  #frames iframe.active { display: block; }
${DIALOG_CSS}
  .dialog p { font-size: 13px; color: var(--text-secondary); line-height: 1.5; }
  .dialog p code { font-family: var(--mono); font-size: 12px; color: var(--text-primary); word-break: break-all; }
  .dialog .btn-danger { background: var(--red); color: #fff; border: 1px solid var(--red); }
</style>
</head>
<body>
  <header>
    <div class="logo">
      <div class="logo-icon">
        <svg viewBox="0 0 24 24"><path d="M12 10v10"/><path d="M8 20h8"/><circle cx="12" cy="6" r="2"/><path d="M5 3c2.8 2.8 4 5 4 7" opacity=".6"/><path d="M19 3c-2.8 2.8-4 5-4 7" opacity=".6"/></svg>
      </div>
      <h1>Walkie-Talkie</h1>
    </div>
    <div class="header-sep"></div>
    <nav id="tabs"></nav>
    <button id="new-project-btn" title="Create a new project with its own channels, agents and history">+ Project</button>
    <div class="spacer"></div>
    <span class="whoami" id="whoami"></span>
    <button class="header-btn" id="switch-user-btn">Switch user</button>
  </header>
  <div id="frames"></div>

${LOGIN_DIALOG_HTML}

  <div class="dialog-overlay" id="project-dialog" style="display:none">
    <div class="dialog">
      <h2>New project</h2>
      <p>A project has its own channels, agents and history. Agents join it by setting
        <code>HUB_URL</code> to <code id="project-hub-url"></code></p>
      <label>Name
        <input type="text" id="project-name" placeholder="my-project" maxlength="32">
      </label>
      <span id="project-error" class="error" style="display:none"></span>
      <div class="dialog-buttons">
        <button class="btn-cancel" id="project-cancel">Cancel</button>
        <button class="btn-save" id="project-create">Create</button>
      </div>
    </div>
  </div>

  <div class="dialog-overlay" id="archive-dialog" style="display:none">
    <div class="dialog">
      <h2 id="archive-title">Archive project</h2>
      <p>Its agents are disconnected and the project disappears for everyone. Its database is moved
        to the hub's <code>projects/archive/</code> folder, so nothing is deleted.</p>
      <span id="archive-error" class="error" style="display:none"></span>
      <div class="dialog-buttons">
        <button class="btn-cancel" id="archive-cancel">Cancel</button>
        <button class="btn-danger" id="archive-confirm">Archive</button>
      </div>
    </div>
  </div>

  <script>
    // The dashboards in the tabs read the login from the same storage, so they don't ask again
${LOGIN_SCRIPT}

    const DEFAULT_PROJECT = "${DEFAULT_PROJECT}";
    const ACTIVE_PROJECT_KEY = "walkie-talkie-active-project";
    // Browsers allow 6 connections per server and each open dashboard keeps one for its live
    // stream, so only this many project dashboards stay loaded (most recently used first)
    const MAX_LOADED = 3;

    let ADMIN_TOKEN = "";
    let MY_NAME = "";
    let adminHeaders = {};
    let projects = []; // [{ name, default }]
    let activeProject = "";
    const frames = new Map(); // project -> iframe
    const lastUsed = []; // projects, most recently shown first
    const unread = new Map(); // project -> number of unread messages
    const dots = new Map(); // project -> its dashboard wants the tab icon dot
    const refreshTimers = new Map();

    const tabsEl = document.getElementById("tabs");
    const framesEl = document.getElementById("frames");

    function projectBase(name) {
      return "/p/" + encodeURIComponent(name) + "/";
    }

    // --- Tab icon: a green dot while any project has unread messages ---
    const faviconEl = document.querySelector('link[rel="icon"]');
    const plainIcon = "${FAVICON_HREF}";
    const dotIcon = "${FAVICON_DOT_HREF}";
    function updateFavicon() {
      const hasNew = [...unread.values()].some((n) => n > 0) || [...dots.values()].some(Boolean);
      faviconEl.setAttribute("href", hasNew ? dotIcon : plainIcon);
    }

    // --- Tabs ---
    function renderTabs() {
      tabsEl.innerHTML = "";
      for (const p of projects) {
        const tab = document.createElement("div");
        tab.className = "tab" + (p.name === activeProject ? " active" : "");
        tab.dataset.project = p.name;
        tab.title = p.default
          ? "Default project (agents with a plain HUB_URL)"
          : "Agents join with HUB_URL=" + location.origin + projectBase(p.name).slice(0, -1);
        const count = unread.get(p.name) || 0;
        tab.innerHTML = '<span class="tab-name">' + escapeHtml(p.name) + "</span>" +
          (count > 0 ? '<span class="badge">' + (count > 99 ? "99+" : count) + "</span>" : "") +
          (p.default ? "" : '<button class="archive-btn" title="Archive this project">&times;</button>');
        tab.onclick = (e) => {
          if (e.target.closest(".archive-btn")) openArchive(p.name);
          else showProject(p.name);
        };
        tabsEl.appendChild(tab);
      }
      updateFavicon();
    }

    function postActive(name, active) {
      const frame = frames.get(name);
      if (frame && frame.contentWindow) {
        frame.contentWindow.postMessage({ type: "walkie-active", active }, location.origin);
      }
    }

    function showProject(name) {
      if (!projects.some((p) => p.name === name)) name = DEFAULT_PROJECT;
      const previous = activeProject;
      activeProject = name;
      store(ACTIVE_PROJECT_KEY, name);
      const hash = name === DEFAULT_PROJECT ? "" : "#" + encodeURIComponent(name);
      if (location.hash !== hash) history.replaceState(null, "", "/" + hash);
      document.title = name === DEFAULT_PROJECT ? "Walkie-Talkie" : name + " · Walkie-Talkie";

      let frame = frames.get(name);
      if (!frame) {
        frame = document.createElement("iframe");
        frame.src = projectBase(name) + "?embedded=1";
        frame.title = name;
        frames.set(name, frame);
        framesEl.appendChild(frame);
      }
      for (const [n, f] of frames) f.classList.toggle("active", n === name);
      if (previous && previous !== name) postActive(previous, false);
      postActive(name, true);

      const i = lastUsed.indexOf(name);
      if (i >= 0) lastUsed.splice(i, 1);
      lastUsed.unshift(name);
      while (lastUsed.length > MAX_LOADED) unloadProject(lastUsed.pop());
      renderTabs();
    }

    function dropFrame(name) {
      const frame = frames.get(name);
      if (frame) frame.remove();
      frames.delete(name);
      dots.delete(name);
    }

    // Drop a project's dashboard; its badge is then kept up to date from the hub
    function unloadProject(name) {
      dropFrame(name);
      refreshUnread(name);
    }

    function refreshUnread(name) {
      if (frames.has(name)) return; // a loaded dashboard reports its own count
      fetch(projectBase(name) + "admin-unread-counts", { headers: adminHeaders })
        .then((r) => r.json())
        .then((data) => {
          if (!data.counts || frames.has(name)) return;
          unread.set(name, Object.values(data.counts).reduce((a, n) => a + n, 0));
          renderTabs();
        })
        .catch(() => {});
    }

    function scheduleRefresh(name) {
      clearTimeout(refreshTimers.get(name));
      refreshTimers.set(name, setTimeout(() => refreshUnread(name), 400));
    }

    // Loaded dashboards report their unread count and whether they want the tab icon dot
    window.addEventListener("message", (e) => {
      if (e.origin !== location.origin || !e.data || e.data.type !== "walkie-unread") return;
      const name = [...frames].find(([, f]) => f.contentWindow === e.source)?.[0];
      if (!name) return;
      unread.set(name, e.data.unread || 0);
      dots.set(name, !!e.data.dot);
      renderTabs();
    });

    function loadProjects() {
      return fetch("/projects", { headers: adminHeaders })
        .then((r) => r.json())
        .then((data) => {
          projects = data.projects || [];
          for (const p of projects) refreshUnread(p.name);
        });
    }

    function removeProject(name) {
      projects = projects.filter((p) => p.name !== name);
      dropFrame(name);
      unread.delete(name);
      const i = lastUsed.indexOf(name);
      if (i >= 0) lastUsed.splice(i, 1);
      if (activeProject === name) showProject(DEFAULT_PROJECT);
      else renderTabs();
    }

    // --- Hub-wide live stream: new and archived projects, activity in projects not loaded ---
    function connectHubEvents() {
      const es = new EventSource("/hub-events?token=" + encodeURIComponent(ADMIN_TOKEN) + "&name=" + encodeURIComponent(MY_NAME));
      let opened = false;
      es.onmessage = (msg) => {
        let ev;
        try { ev = JSON.parse(msg.data); } catch { return; }
        if (ev.type === "project_create") {
          if (!projects.some((p) => p.name === ev.name)) loadProjects().then(renderTabs).catch(() => {});
        } else if (ev.type === "project_archive") {
          removeProject(ev.name);
        } else if (ev.type === "activity" || (ev.type === "read" && ev.userName === MY_NAME)) {
          scheduleRefresh(ev.project);
        }
      };
      // EventSource reconnects by itself; after a hub restart, catch up on what changed
      es.onopen = () => {
        if (!opened) { opened = true; return; }
        loadProjects().then(() => {
          if (!projects.some((p) => p.name === activeProject)) showProject(DEFAULT_PROJECT);
          else renderTabs();
        }).catch(() => {});
      };
    }

    // --- New project ---
    const projectDialogEl = document.getElementById("project-dialog");
    const projectNameEl = document.getElementById("project-name");
    const projectErrorEl = document.getElementById("project-error");
    function updateProjectUrl() {
      const name = projectNameEl.value.trim() || "<name>";
      document.getElementById("project-hub-url").textContent = location.origin + "/p/" + name;
    }
    document.getElementById("new-project-btn").onclick = () => {
      projectNameEl.value = "";
      projectErrorEl.style.display = "none";
      updateProjectUrl();
      projectDialogEl.style.display = "flex";
      projectNameEl.focus();
    };
    projectNameEl.addEventListener("input", updateProjectUrl);
    document.getElementById("project-cancel").onclick = () => { projectDialogEl.style.display = "none"; };
    function createProject() {
      const name = projectNameEl.value.trim();
      if (!name) return;
      fetch("/admin-project-create", { method: "POST", headers: adminHeaders, body: JSON.stringify({ name }) })
        .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
        .then(({ ok, data }) => {
          if (!ok) {
            projectErrorEl.textContent = data.error || "Could not create the project";
            projectErrorEl.style.display = "";
            return;
          }
          projectDialogEl.style.display = "none";
          return loadProjects().then(() => showProject(name));
        })
        .catch(() => {
          projectErrorEl.textContent = "Could not reach the Hub";
          projectErrorEl.style.display = "";
        });
    }
    document.getElementById("project-create").onclick = createProject;
    projectNameEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") createProject();
      if (e.key === "Escape") projectDialogEl.style.display = "none";
    });

    // --- Archive project ---
    const archiveDialogEl = document.getElementById("archive-dialog");
    const archiveErrorEl = document.getElementById("archive-error");
    let archiveTarget = "";
    function openArchive(name) {
      archiveTarget = name;
      document.getElementById("archive-title").textContent = "Archive project " + name + "?";
      archiveErrorEl.style.display = "none";
      archiveDialogEl.style.display = "flex";
    }
    document.getElementById("archive-cancel").onclick = () => { archiveDialogEl.style.display = "none"; };
    document.getElementById("archive-confirm").onclick = () => {
      const name = archiveTarget;
      fetch("/admin-project-archive", { method: "POST", headers: adminHeaders, body: JSON.stringify({ name }) })
        .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
        .then(({ ok, data }) => {
          if (!ok) {
            archiveErrorEl.textContent = data.error || "Could not archive the project";
            archiveErrorEl.style.display = "";
            return;
          }
          archiveDialogEl.style.display = "none";
          removeProject(name);
        })
        .catch(() => {
          archiveErrorEl.textContent = "Could not reach the Hub";
          archiveErrorEl.style.display = "";
        });
    };

    function onLoggedIn() {
      loadProjects()
        .then(() => {
          const wanted = decodeURIComponent(location.hash.slice(1)) || readStored(ACTIVE_PROJECT_KEY) || DEFAULT_PROJECT;
          showProject(wanted);
          connectHubEvents();
        })
        .catch(() => showLogin("Could not load the projects"));
    }

    window.addEventListener("hashchange", () => {
      const name = decodeURIComponent(location.hash.slice(1));
      if (MY_NAME && name && name !== activeProject) showProject(name);
    });

    beginLogin();
  </script>
</body>
</html>`;
}
