export function getDashboardHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Walkie-Talkie</title>
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20viewBox%3D'0%200%2032%2032'%3E%3Cdefs%3E%3ClinearGradient%20id%3D'g'%20x1%3D'0'%20y1%3D'0'%20x2%3D'1'%20y2%3D'1'%3E%3Cstop%20offset%3D'0'%20stop-color%3D'%23818cf8'%2F%3E%3Cstop%20offset%3D'1'%20stop-color%3D'%23a78bfa'%2F%3E%3C%2FlinearGradient%3E%3C%2Fdefs%3E%3Crect%20width%3D'32'%20height%3D'32'%20rx%3D'7'%20fill%3D'url(%23g)'%2F%3E%3Crect%20x%3D'9.5'%20y%3D'2.5'%20width%3D'3'%20height%3D'9'%20rx%3D'1.5'%20fill%3D'%23fff'%2F%3E%3Crect%20x%3D'18.5'%20y%3D'6'%20width%3D'3'%20height%3D'4'%20rx%3D'1'%20fill%3D'%23fff'%2F%3E%3Crect%20x%3D'8'%20y%3D'9'%20width%3D'16'%20height%3D'20'%20rx%3D'3.5'%20fill%3D'%23fff'%2F%3E%3Crect%20x%3D'11'%20y%3D'12.5'%20width%3D'10'%20height%3D'2'%20rx%3D'1'%20fill%3D'%236d68f2'%2F%3E%3Crect%20x%3D'11'%20y%3D'16.5'%20width%3D'10'%20height%3D'2'%20rx%3D'1'%20fill%3D'%236d68f2'%2F%3E%3Crect%20x%3D'11'%20y%3D'20.5'%20width%3D'10'%20height%3D'2'%20rx%3D'1'%20fill%3D'%236d68f2'%2F%3E%3Ccircle%20cx%3D'16'%20cy%3D'25.5'%20r%3D'1.4'%20fill%3D'%236d68f2'%2F%3E%3C%2Fsvg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root {
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
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: var(--font);
    background: var(--bg-base);
    color: var(--text-primary);
    height: 100vh;
    display: flex;
    flex-direction: column;
    -webkit-font-smoothing: antialiased;
  }

  /* Header */
  header {
    height: 52px;
    padding: 0 20px;
    background: var(--bg-raised);
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 14px;
    flex-shrink: 0;
    backdrop-filter: blur(12px);
  }
  .logo {
    display: flex;
    align-items: center;
    gap: 9px;
  }
  .logo-icon {
    width: 22px;
    height: 22px;
    border-radius: 6px;
    background: linear-gradient(135deg, var(--accent), #a78bfa);
    display: grid;
    place-items: center;
  }
  .logo-icon svg {
    width: 13px;
    height: 13px;
    fill: none;
    stroke: #fff;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  header h1 {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    letter-spacing: -0.01em;
  }
  .header-sep {
    width: 1px;
    height: 18px;
    background: var(--border);
  }
  #status {
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 500;
    padding: 3px 10px;
    border-radius: 100px;
    background: var(--green-soft);
    color: var(--green);
    border: 1px solid var(--green-border);
    transition: all 0.25s ease;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  #status::before {
    content: "";
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--green);
    box-shadow: 0 0 6px var(--green);
  }
  #status.disconnected {
    background: var(--red-soft);
    color: var(--red);
    border-color: var(--red-border);
  }
  #status.disconnected::before {
    background: var(--red);
    box-shadow: 0 0 6px var(--red);
  }
  .header-spacer { flex: 1; }
  #channel-header {
    font-family: var(--mono);
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .channel-members {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--text-tertiary);
    font-weight: 400;
  }
  .clear-btn, .filter-btn {
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 500;
    padding: 4px 12px;
    background: transparent;
    color: var(--text-tertiary);
    border: 1px solid var(--border);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .clear-btn:hover, .filter-btn:hover {
    color: var(--text-secondary);
    border-color: rgba(255,255,255,0.1);
    background: var(--bg-hover);
  }
  .clear-btn:active, .filter-btn:active {
    transform: scale(0.97);
  }
  .filter-btn.active {
    background: var(--accent-soft);
    color: var(--accent);
    border-color: rgba(129,140,248,0.3);
  }
  body.filter-mine .msg:not(.mine):not(.system) {
    opacity: 0.3;
  }

  /* Main */
  .container {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  /* Sidebar */
  #sidebar {
    width: 220px;
    background: var(--bg-raised);
    border-right: 1px solid var(--border);
    padding: 16px 12px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow-y: auto;
  }
  #sidebar-resizer {
    width: 7px;
    margin: 0 -4px 0 -3px;
    position: relative;
    z-index: 5;
    flex-shrink: 0;
    cursor: col-resize;
    touch-action: none;
    outline: none;
  }
  #sidebar-resizer::after {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    left: 2px;
    width: 3px;
    background: transparent;
    transition: background 0.15s ease;
  }
  #sidebar-resizer:hover::after, #sidebar-resizer:focus-visible::after, body.resizing #sidebar-resizer::after {
    background: var(--accent);
  }
  body.resizing {
    cursor: col-resize;
    user-select: none;
  }
  .sidebar-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-tertiary);
    padding: 0 8px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .sidebar-label .add-btn {
    font-family: var(--mono);
    font-size: 11px;
    background: transparent;
    color: var(--text-tertiary);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0 6px;
    cursor: pointer;
    transition: all 0.15s ease;
    line-height: 18px;
  }
  .sidebar-label .add-btn:hover {
    color: var(--accent);
    border-color: rgba(129,140,248,0.3);
    background: var(--accent-soft);
  }

  /* Channel list */
  #channel-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  #channel-list li {
    padding: 6px 8px;
    font-family: var(--mono);
    font-size: 13px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.15s ease;
    color: var(--text-secondary);
  }
  #channel-list li:hover {
    background: var(--bg-hover);
  }
  #channel-list li.active {
    background: var(--accent-soft);
    color: var(--accent);
  }
  .channel-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .channel-unread {
    font-family: var(--mono);
    font-size: 10px;
    background: var(--accent);
    color: #fff;
    padding: 1px 6px;
    border-radius: 100px;
    flex-shrink: 0;
    font-weight: 600;
  }
  #channel-list li.active .channel-unread {
    display: none;
  }
  .channel-del {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-tertiary);
    font-family: var(--mono);
    font-size: 10px;
    padding: 1px 5px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s ease;
    opacity: 0;
    flex-shrink: 0;
    margin-left: 4px;
  }
  #channel-list li:hover .channel-del {
    opacity: 1;
  }
  .channel-del:hover {
    border-color: var(--red-border);
    color: var(--red);
    background: var(--red-soft);
  }

  /* User list */
  #user-list {
    list-style: none;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  #user-list li {
    padding: 7px 8px;
    font-size: 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-radius: 8px;
    transition: background 0.15s ease;
  }
  #user-list li:hover {
    background: var(--bg-hover);
  }
  .user-info {
    display: flex;
    align-items: center;
    gap: 9px;
    min-width: 0;
  }
  .user-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--green);
    box-shadow: 0 0 8px rgba(52,211,153,0.35);
    flex-shrink: 0;
  }
  .user-dot.offline {
    background: #555;
    box-shadow: none;
  }
  .user-name {
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--text-primary);
  }
  .human-tag {
    font-family: var(--mono);
    font-size: 10px;
    color: var(--yellow);
    background: var(--yellow-soft);
    border-radius: 4px;
    padding: 1px 5px;
    margin-left: 6px;
    flex-shrink: 0;
  }
  .whoami {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--text-tertiary);
  }
  .whoami strong {
    color: var(--text-primary);
    font-weight: 500;
  }
  .kick-btn {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-tertiary);
    font-family: var(--mono);
    font-size: 10px;
    padding: 2px 8px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
    opacity: 0;
    flex-shrink: 0;
  }
  #user-list li:hover .kick-btn {
    opacity: 1;
  }
  .kick-btn:hover {
    border-color: var(--red-border);
    color: var(--red);
    background: var(--red-soft);
  }
  #stop-all {
    width: 100%;
    padding: 8px;
    background: var(--red-soft);
    color: var(--red);
    border: 1px solid var(--red-border);
    border-radius: 8px;
    font-family: var(--font);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  #stop-all:hover {
    background: rgba(248,113,113,0.18);
    border-color: rgba(248,113,113,0.35);
  }
  #stop-all:active {
    transform: scale(0.98);
  }

  /* Agent list */
  #agent-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  #agent-list li {
    padding: 7px 8px;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-radius: 8px;
    transition: background 0.15s ease;
  }
  #agent-list li:hover {
    background: var(--bg-hover);
  }
  .agent-info {
    display: flex;
    align-items: center;
    gap: 9px;
    min-width: 0;
  }
  .agent-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .agent-dot.online {
    background: var(--green);
    box-shadow: 0 0 8px rgba(52,211,153,0.35);
  }
  .agent-dot.offline {
    background: #555;
    box-shadow: none;
  }
  .agent-name {
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--text-primary);
  }
  .agent-actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }
  .agent-actions button {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-tertiary);
    font-family: var(--mono);
    font-size: 10px;
    padding: 2px 8px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
    opacity: 0;
  }
  #agent-list li:hover .agent-actions button {
    opacity: 1;
  }
  .agent-launch-btn:hover {
    border-color: var(--green-border) !important;
    color: var(--green) !important;
    background: var(--green-soft) !important;
  }
  .agent-edit-btn:hover {
    border-color: rgba(129,140,248,0.3) !important;
    color: var(--accent) !important;
    background: var(--accent-soft) !important;
  }
  .agent-del-btn:hover {
    border-color: var(--red-border) !important;
    color: var(--red) !important;
    background: var(--red-soft) !important;
  }

  /* Agent dialog */
  .dialog-overlay {
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

  /* Messages */
  .messages-wrap {
    flex: 1;
    position: relative;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  #messages {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 16px 24px;
    display: flex;
    flex-direction: column;
    gap: 3px;
    scrollbar-width: thin;
    scrollbar-color: var(--bg-surface) transparent;
  }
  #messages::-webkit-scrollbar { width: 5px; }
  #messages::-webkit-scrollbar-track { background: transparent; }
  #messages::-webkit-scrollbar-thumb { background: var(--bg-surface); border-radius: 8px; }

  .msg {
    padding: 10px 14px;
    border-radius: var(--radius);
    font-size: 16px;
    line-height: 1.6;
    max-width: 100%;
    animation: slideIn 0.25s cubic-bezier(0.16,1,0.3,1);
    border: 1px solid transparent;
  }
  .msg .time {
    font-family: var(--mono);
    font-size: 13px;
    color: var(--text-tertiary);
    margin-right: 8px;
  }
  .msg .channel-tag {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--yellow);
    background: var(--yellow-soft);
    padding: 1px 6px;
    border-radius: 4px;
    margin-right: 6px;
  }
  .msg .from {
    font-weight: 600;
    color: var(--accent);
  }
  .msg .to {
    font-family: var(--mono);
    font-size: 14px;
    color: var(--text-tertiary);
    margin-left: 2px;
  }
  .msg .content {
    margin-top: 4px;
    white-space: pre-wrap;
    word-break: break-word;
    color: var(--text-primary);
  }
  .msg.message {
    background: var(--bg-surface);
    border-color: var(--border-subtle);
  }
  .msg.message:hover {
    border-color: var(--border);
  }
  .msg.mine {
    background: var(--accent-soft);
    border-color: rgba(129,140,248,0.18);
    border-left: 3px solid var(--accent);
  }
  .msg.mine:hover {
    border-color: rgba(129,140,248,0.3);
    border-left-color: var(--accent);
  }
  .msg.human {
    background: var(--yellow-soft);
    border-color: rgba(251,191,36,0.14);
    border-left: 3px solid var(--yellow);
  }
  .msg.human:hover {
    border-color: rgba(251,191,36,0.28);
    border-left-color: var(--yellow);
  }
  .msg.system {
    background: transparent;
    font-size: 15px;
    color: var(--text-tertiary);
    max-width: 100%;
    padding: 6px 14px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .msg.system::before {
    content: "";
    flex: 0 0 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--green);
  }
  .msg.system.leave::before {
    background: var(--red);
  }
  .msg.system.channel-event::before {
    background: var(--yellow);
  }
  .msg.system strong {
    color: var(--text-secondary);
    font-weight: 500;
  }
  .empty {
    color: var(--text-tertiary);
    text-align: center;
    margin-top: 36vh;
    font-size: 13px;
  }

  /* Message area wrapper */
  .message-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  /* Input bar */
  .input-bar {
    padding: 12px 16px;
    background: var(--bg-raised);
    border-top: 1px solid var(--border);
    display: flex;
    align-items: flex-end;
    gap: 8px;
    flex-shrink: 0;
  }
  .input-bar-wrapper {
    position: relative;
    display: flex;
    align-items: flex-end;
    gap: 8px;
    flex: 1;
    min-width: 0;
  }
  .input-tag {
    font-family: var(--mono);
    font-size: 12px;
    font-weight: 500;
    padding: 6px 10px;
    border-radius: 6px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 1px;
    user-select: none;
  }
  .input-tag.channel {
    background: var(--yellow-soft);
    color: var(--yellow);
    border: 1px solid rgba(251,191,36,0.2);
  }
  .input-tag.recipient {
    background: var(--accent-soft);
    color: var(--accent);
    border: 1px solid rgba(129,140,248,0.2);
    cursor: default;
  }
  .input-tag .tag-remove {
    font-size: 14px;
    line-height: 1;
    cursor: pointer;
    opacity: 0.6;
    transition: opacity 0.15s ease;
  }
  .input-tag .tag-remove:hover {
    opacity: 1;
  }
  .mention-popup {
    position: absolute;
    bottom: 100%;
    left: 0;
    margin-bottom: 6px;
    background: var(--bg-raised);
    border: 1px solid var(--border);
    border-radius: 8px;
    min-width: 180px;
    max-height: 200px;
    overflow-y: auto;
    box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    z-index: 100;
    display: none;
    scrollbar-width: thin;
    scrollbar-color: var(--bg-surface) transparent;
  }
  .mention-popup.visible {
    display: block;
    animation: slideIn 0.15s cubic-bezier(0.16,1,0.3,1);
  }
  .mention-item {
    padding: 8px 12px;
    font-family: var(--mono);
    font-size: 13px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: background 0.1s ease;
  }
  .mention-item:hover, .mention-item.active {
    background: var(--accent-soft);
    color: var(--accent);
  }
  .mention-item:first-child { border-radius: 7px 7px 0 0; }
  .mention-item:last-child { border-radius: 0 0 7px 7px; }
  .mention-item:only-child { border-radius: 7px; }
  .input-bar textarea {
    flex: 1;
    font-family: var(--font);
    font-size: 13px;
    padding: 8px 12px;
    background: var(--bg-surface);
    color: var(--text-primary);
    border: 1px solid var(--border);
    border-radius: 8px;
    outline: none;
    resize: none;
    overflow-y: hidden;
    line-height: 1.5;
    min-height: 36px;
    max-height: 120px;
    field-sizing: content;
  }
  .input-bar textarea::placeholder {
    color: var(--text-tertiary);
  }
  .input-bar textarea:focus {
    border-color: var(--accent);
  }
  .send-btn {
    font-family: var(--font);
    font-size: 12px;
    font-weight: 600;
    padding: 8px 16px;
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
    flex-shrink: 0;
  }
  .send-btn:hover {
    opacity: 0.85;
  }
  .send-btn:active {
    transform: scale(0.97);
  }
  .send-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .msg.hidden-by-filter {
    display: none;
  }

  #history-status {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--text-tertiary);
    text-align: center;
    padding: 4px 0 10px;
  }
  #history-status:empty {
    display: none;
  }

  #new-msg-btn {
    display: none;
    position: absolute;
    bottom: 12px;
    left: 50%;
    transform: translateX(-50%);
    font-family: inherit;
    font-size: 12px;
    font-weight: 600;
    padding: 6px 14px;
    background: var(--accent);
    color: var(--bg-base);
    border: none;
    border-radius: 999px;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
  }
  #new-msg-btn.visible {
    display: block;
  }

  .typing-indicator {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--accent);
    margin-left: 6px;
    animation: typingBlink 1.2s ease-in-out infinite;
  }
  #typing-bar {
    font-family: var(--mono);
    font-size: 12px;
    color: var(--accent);
    padding: 0 24px;
    height: 0;
    overflow: hidden;
    transition: height 0.2s ease, padding 0.2s ease;
  }
  #typing-bar.active {
    height: 28px;
    padding: 6px 24px;
  }
  #image-preview {
    display: none;
    align-items: center;
    padding: 8px 16px;
    gap: 10px;
    border-top: 1px solid var(--border);
    background: var(--bg-raised);
  }
  #image-preview.active {
    display: flex;
  }
  #image-preview img {
    max-width: 120px;
    max-height: 80px;
    border-radius: 6px;
    border: 1px solid var(--border);
  }
  #image-preview .remove-img {
    font-family: var(--mono);
    font-size: 11px;
    background: transparent;
    color: var(--text-tertiary);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 2px 8px;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  #image-preview .remove-img:hover {
    border-color: var(--red-border);
    color: var(--red);
    background: var(--red-soft);
  }
  .msg-image img {
    max-width: 300px;
    max-height: 200px;
    border-radius: 6px;
    margin-top: 6px;
    border: 1px solid var(--border);
    cursor: pointer;
  }
  .msg-image img:hover {
    border-color: rgba(255,255,255,0.15);
  }
  @keyframes typingBlink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  @keyframes slideIn {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
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
    <span id="status">connected</span>
    <span id="channel-header"></span>
    <div class="header-spacer"></div>
    <span class="whoami" id="whoami"></span>
    <button class="filter-btn" id="switch-user-btn">Switch user</button>
    <button class="filter-btn" id="filter-btn">My messages</button>
    <button class="clear-btn" id="clear-btn">Clear</button>
  </header>
  <div class="container">
    <div id="sidebar">
      <span class="sidebar-label">Channels <button class="add-btn" id="add-channel-btn">+ New</button></span>
      <ul id="channel-list"></ul>
      <span class="sidebar-label">On Air</span>
      <ul id="user-list"></ul>
      <span class="sidebar-label">Agents <button class="add-btn" id="add-agent-btn">+ New</button></span>
      <ul id="agent-list"></ul>
      <button id="stop-all">Kick all agents</button>
    </div>
    <div id="sidebar-resizer" role="separator" aria-orientation="vertical" aria-label="Resize sidebar" tabindex="0" title="Drag to resize, double-click to reset"></div>
    <div class="message-area">
      <div class="messages-wrap">
        <div id="messages">
          <div class="empty">Waiting for transmissions...</div>
        </div>
        <button id="new-msg-btn">New messages &darr;</button>
      </div>
      <div id="typing-bar"></div>
      <div id="image-preview"></div>
      <div class="input-bar">
        <span class="input-tag channel" id="channel-tag">#all</span>
        <span class="input-tag recipient" id="recipient-tag">@all</span>
        <div class="input-bar-wrapper">
          <div class="mention-popup" id="mention-popup"></div>
          <textarea id="send-input" placeholder="Send a message... (type @ to mention)" rows="1"></textarea>
        </div>
        <button class="send-btn" id="send-btn">Send</button>
      </div>
    </div>
  </div>
  <div class="dialog-overlay" id="login-dialog" style="display:none">
    <div class="dialog">
      <h2>Log in</h2>
      <label id="login-token-row">Admin token
        <input type="password" id="login-token" placeholder="WALKIE_TALKIE_ADMIN_TOKEN" autocomplete="current-password">
      </label>
      <label id="login-name-row">Your name
        <input type="text" id="login-name" placeholder="e.g. alice" maxlength="32" autocomplete="nickname">
      </label>
      <span id="login-error" style="color:var(--red);font-size:11px;display:none"></span>
      <div class="dialog-buttons">
        <button class="btn-cancel" id="login-as-operator">Continue as operator</button>
        <button class="btn-save" id="login-submit">Log in</button>
      </div>
    </div>
  </div>
  <div class="dialog-overlay" id="agent-dialog" style="display:none">
    <div class="dialog">
      <h2 id="agent-dialog-title">New Agent</h2>
      <input type="hidden" id="agent-dialog-id">
      <label>Name <span style="font-weight:400;color:var(--text-tertiary)">(a-z, 0-9, hyphen, underscore)</span>
        <input type="text" id="agent-dialog-name" placeholder="alice" pattern="[a-zA-Z0-9_-]+">
        <span id="agent-dialog-name-error" style="color:var(--red);font-size:11px;display:none"></span>
      </label>
      <label>Working Directory
        <input type="text" id="agent-dialog-workdir" placeholder="/path/to/project">
      </label>
      <div class="checkbox-row">
        <input type="checkbox" id="agent-dialog-autostart">
        <label for="agent-dialog-autostart" style="flex-direction:row;gap:0">Auto-start on Hub launch</label>
      </div>
      <div class="dialog-buttons">
        <button class="btn-cancel" id="agent-dialog-cancel">Cancel</button>
        <button class="btn-save" id="agent-dialog-save">Save</button>
      </div>
    </div>
  </div>
  <script>
    const TOKEN_STORAGE_KEY = "walkie-talkie-admin-token";
    let ADMIN_TOKEN = "";
    let adminHeaders = {};
    const messagesEl = document.getElementById("messages");
    const userListEl = document.getElementById("user-list");
    const channelListEl = document.getElementById("channel-list");
    const statusEl = document.getElementById("status");
    const channelHeaderEl = document.getElementById("channel-header");
    const users = new Map(); // name -> online (boolean)
    const humans = new Set(); // names of dashboard users (role "human")
    let MY_NAME = "";

    // "operator" predates the human role, so its old messages count as human too
    function isHuman(name) {
      return humans.has(name) || name === "operator";
    }

    function messageClass(from, fromRole) {
      if (from === MY_NAME) return "message mine";
      if (fromRole === "human" || isHuman(from)) return "message human";
      return "message";
    }
    const channels = new Map(); // name -> { memberCount, createdBy, members }
    const typingUsers = new Map(); // name -> { timeoutId, channel }
    const pendingReply = new Map(); // name -> timeoutId (30s no-TYPING → grey)
    const agentConfigs = new Map(); // id -> { name, workDir, command, autoStart, status, pid, exitCode }
    const agentListEl = document.getElementById("agent-list");

    let selectedChannel = "#all";
    const unreadCounts = {}; // channel -> count

    function formatTime(ts) {
      return new Date(ts).toLocaleString();
    }

    function clearEmpty() {
      const empty = messagesEl.querySelector(".empty");
      if (empty) empty.remove();
    }

    function scrollBottom() {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function kick(name) {
      fetch("/kick", {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify({ name }),
      });
    }

    const typingBarEl = document.getElementById("typing-bar");
    function renderTypingBar() {
      const names = [...typingUsers.entries()].filter(([, v]) => v.channel === selectedChannel).map(([k]) => k);
      if (names.length === 0) {
        typingBarEl.className = "";
        typingBarEl.textContent = "";
      } else {
        typingBarEl.className = "active";
        typingBarEl.textContent = names.join(", ") + (names.length === 1 ? " is thinking..." : " are thinking...");
      }
    }

    function renderUsers() {
      userListEl.innerHTML = "";
      for (const [u, online] of users) {
        const li = document.createElement("li");
        const info = document.createElement("span");
        info.className = "user-info";
        const dotCls = online ? "user-dot" : "user-dot offline";
        const tu = typingUsers.get(u);
        const typingHtml = tu && tu.channel === selectedChannel ? '<span class="typing-indicator">typing...</span>' : '';
        const humanHtml = isHuman(u) ? '<span class="human-tag">' + (u === MY_NAME ? "you" : "human") + '</span>' : '';
        info.innerHTML = '<span class="' + dotCls + '"></span><span class="user-name">' + u + '</span>' + humanHtml + typingHtml;
        li.appendChild(info);
        if (!isHuman(u)) {
          const btn = document.createElement("button");
          btn.className = "kick-btn";
          btn.textContent = "kick";
          btn.onclick = () => kick(u);
          li.appendChild(btn);
        }
        userListEl.appendChild(li);
      }
      // Reset recipient if the current target left
      if (recipientTarget !== "@all") {
        const targetName = recipientTarget.slice(1);
        if (!users.has(targetName)) setRecipient("@all");
      }
      updateChannelHeader();
    }

    function renderAgents() {
      agentListEl.innerHTML = "";
      for (const [id, agent] of agentConfigs) {
        const li = document.createElement("li");
        const info = document.createElement("span");
        info.className = "agent-info";
        const isOnline = users.has(agent.name) && users.get(agent.name);
        info.innerHTML = '<span class="agent-dot ' + (isOnline ? 'online' : 'offline') + '"></span><span class="agent-name">' + agent.name + '</span>';
        const actions = document.createElement("span");
        actions.className = "agent-actions";
        const launchBtn = document.createElement("button");
        launchBtn.className = "agent-launch-btn";
        launchBtn.textContent = "launch";
        launchBtn.onclick = (e) => { e.stopPropagation(); agentLaunch(id); };
        actions.appendChild(launchBtn);
        if (!isOnline) {
          const editBtn = document.createElement("button");
          editBtn.className = "agent-edit-btn";
          editBtn.textContent = "edit";
          editBtn.onclick = (e) => { e.stopPropagation(); openAgentDialog(id, agent); };
          actions.appendChild(editBtn);
          const delBtn = document.createElement("button");
          delBtn.className = "agent-del-btn";
          delBtn.textContent = "x";
          delBtn.onclick = (e) => { e.stopPropagation(); if (confirm("Delete agent config '" + agent.name + "'?")) agentDelete(id); };
          actions.appendChild(delBtn);
        }
        li.appendChild(info);
        li.appendChild(actions);
        agentListEl.appendChild(li);
      }
    }

    function agentLaunch(id) {
      fetch("/admin-agent-start", {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify({ id }),
      }).then(r => r.json()).then(data => {
        if (data.error) alert(data.error);
      }).catch(() => {});
    }

    function agentDelete(id) {
      fetch("/admin-agent-config-delete", {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify({ id }),
      }).then(r => r.json()).then(data => {
        if (data.error) alert(data.error);
      }).catch(() => {});
    }

    function refreshAgentConfigs() {
      fetch("/admin-agent-configs", { headers: adminHeaders })
        .then(r => r.json())
        .then(data => {
          agentConfigs.clear();
          for (const c of data.configs) {
            agentConfigs.set(c.id, { name: c.name, workDir: c.workDir, autoStart: c.autoStart });
          }
          renderAgents();
        }).catch(() => {});
    }

    function refreshChannels() {
      fetch("/channels").then(r => r.json()).then(data => {
        channels.clear();
        for (const ch of data.channels) {
          channels.set(ch.name, { memberCount: ch.memberCount, createdBy: ch.createdBy, members: ch.members || [] });
        }
        renderChannels();
        updateChannelHeader();
      }).catch(() => {});
    }

    function renderChannels() {
      channelListEl.innerHTML = "";
      for (const [name, info] of channels) {
        const li = document.createElement("li");
        const unread = unreadCounts[name] || 0;
        const unreadBadge = unread > 0 ? '<span class="channel-unread">' + unread + '</span>' : '';
        if (name === "#all") {
          li.innerHTML = '<span class="channel-name">' + name + '</span>' + unreadBadge;
        } else {
          li.innerHTML = '<span class="channel-name">' + name + '</span>' + unreadBadge + '<button class="channel-del">x</button>';
          li.querySelector(".channel-del").onclick = (e) => {
            e.stopPropagation();
            if (confirm("Delete " + name + "?")) deleteChannel(name);
          };
        }
        if (selectedChannel === name) li.className = "active";
        li.onclick = () => selectChannel(name);
        channelListEl.appendChild(li);
      }
    }

    function updateChannelHeader() {
      if (!selectedChannel) {
        channelHeaderEl.innerHTML = "";
        return;
      }
      let membersHtml = "";
      if (selectedChannel === "#all") {
        const onlineUsers = [...users.keys()];
        const count = onlineUsers.length;
        const names = onlineUsers.join(", ");
        membersHtml = count > 0
          ? '<span class="channel-members">' + count + (count === 1 ? ' member' : ' members') + ': ' + names + '</span>'
          : '<span class="channel-members">0 members</span>';
      } else {
        const chInfo = channels.get(selectedChannel);
        const members = chInfo ? chInfo.members : [];
        const count = members.length;
        const names = members.join(", ");
        membersHtml = count > 0
          ? '<span class="channel-members">' + count + (count === 1 ? ' member' : ' members') + ': ' + names + '</span>'
          : '<span class="channel-members">0 members</span>';
      }
      channelHeaderEl.innerHTML = '<span>' + selectedChannel + '</span> — ' + membersHtml;
    }

    function markChannelRead(channel) {
      fetch("/admin-mark-read", {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify({ channel }),
      }).catch(() => {});
      delete unreadCounts[channel];
      renderChannels();
    }

    function selectChannel(name) {
      selectedChannel = name;
      channelTagEl.textContent = name || "#all";
      updateChannelHeader();
      // Reset recipient if not a member of the new channel
      if (recipientTarget !== "@all" && name !== "#all") {
        const chInfo = channels.get(name);
        const members = chInfo ? chInfo.members : [];
        if (members.length > 0 && !members.includes(recipientTarget.slice(1))) {
          setRecipient("@all");
        }
      }
      markChannelRead(name);
      applyChannelFilter();
      clearUnseen();
      scrollBottom();
      renderHistoryStatus();
      if (!historyState[name]) loadHistory(name);
      renderTypingBar();
      renderUsers();
    }

    function applyChannelFilter() {
      const msgs = messagesEl.querySelectorAll(".msg");
      for (const msg of msgs) {
        if (!selectedChannel) {
          msg.classList.remove("hidden-by-filter");
        } else {
          const ch = msg.dataset.channel;
          if (!ch) {
            msg.classList.remove("hidden-by-filter");
          } else if (ch === selectedChannel) {
            msg.classList.remove("hidden-by-filter");
          } else {
            msg.classList.add("hidden-by-filter");
          }
        }
      }
    }

    function buildMessageEl(html, cls, channel, ts, seq) {
      const div = document.createElement("div");
      div.className = "msg " + cls;
      if (channel) div.dataset.channel = channel;
      div.dataset.ts = String(ts || Date.now());
      if (seq) div.dataset.seq = String(seq);
      div.innerHTML = html;
      if (selectedChannel && channel && channel !== selectedChannel) {
        div.classList.add("hidden-by-filter");
      }
      for (const img of div.querySelectorAll("img")) {
        img.addEventListener("load", () => { if (atBottom) scrollBottom(); });
      }
      return div;
    }

    function messageHtml(m) {
      return '<span class="time">' + formatTime(m.timestamp) + '</span>' +
        '<span class="channel-tag">' + (m.channel || "#all") + '</span>' +
        '<span class="from">' + m.from + '</span> ' +
        '<span class="to">&rarr; ' + m.to + '</span>' +
        '<div class="content">' + m.content.replace(/</g, "&lt;") + '</div>' +
        renderImageTag(m.image);
    }

    function addMessage(html, cls, channel, ts) {
      clearEmpty();
      const div = buildMessageEl(html, cls, channel, ts);
      messagesEl.appendChild(div);
      // Follow new messages only when already at the bottom (or when you sent it);
      // otherwise remember the first unseen message and offer a jump button
      if (atBottom || cls.includes("mine")) {
        scrollBottom();
      } else if (!firstUnseenEl && cls.startsWith("message") && !div.classList.contains("hidden-by-filter")) {
        firstUnseenEl = div;
        newMsgBtnEl.classList.add("visible");
      }
    }

    const newMsgBtnEl = document.getElementById("new-msg-btn");
    let atBottom = true;
    let firstUnseenEl = null;

    function clearUnseen() {
      firstUnseenEl = null;
      newMsgBtnEl.classList.remove("visible");
    }

    messagesEl.addEventListener("scroll", () => {
      atBottom = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 40;
      if (firstUnseenEl && (atBottom || firstUnseenEl.getBoundingClientRect().top < messagesEl.getBoundingClientRect().bottom)) {
        clearUnseen();
      }
    });

    // Per-channel history: the newest page loads when a channel is first shown,
    // older pages load when scrolled to the top
    const HISTORY_PAGE = 200;
    const historyState = {}; // channel -> { oldest, oldestSeq, done, loading, loadedOnce }
    const firstLiveTs = {}; // channel -> first live message timestamp seen before its history loaded
    let historyCleared = false;
    const historyStatusEl = document.createElement("div");
    historyStatusEl.id = "history-status";
    messagesEl.prepend(historyStatusEl);

    function renderHistoryStatus() {
      const st = historyState[selectedChannel];
      if (historyCleared || !st) historyStatusEl.textContent = "";
      else if (st.loading) historyStatusEl.textContent = "Loading older messages...";
      else if (st.done) historyStatusEl.textContent = "Start of " + selectedChannel + " history";
      else historyStatusEl.textContent = "";
    }

    // Does view element el come after history message m? Order is (timestamp, seq);
    // live messages carry no seq and count as newest within their millisecond.
    function isAfter(el, m) {
      if (!el.dataset.ts) return false;
      const ts = Number(el.dataset.ts);
      if (ts !== m.timestamp) return ts > m.timestamp;
      return !el.dataset.seq || Number(el.dataset.seq) > m.seq;
    }

    // Merge chronologically sorted history messages into the view
    function insertHistory(messages) {
      if (messages.length > 0) clearEmpty();
      let next = messagesEl.firstElementChild;
      for (const m of messages) {
        while (next && !isAfter(next, m)) next = next.nextElementSibling;
        messagesEl.insertBefore(buildMessageEl(messageHtml(m), messageClass(m.from), m.channel || "#all", m.timestamp, m.seq), next);
      }
    }

    function loadHistory(channel) {
      if (historyCleared) return;
      if (!historyState[channel]) {
        // History must stop where live messages for this channel began, to avoid duplicates
        historyState[channel] = { oldest: firstLiveTs[channel] || null, done: false, loading: false, loadedOnce: false };
      }
      const st = historyState[channel];
      if (st.done || st.loading) return;
      st.loading = true;
      renderHistoryStatus();
      let url = "/admin-channel-history?channel=" + encodeURIComponent(channel) + "&limit=" + HISTORY_PAGE;
      if (st.oldest) url += "&before=" + st.oldest + (st.oldestSeq ? "&beforeSeq=" + st.oldestSeq : "");
      fetch(url, { headers: adminHeaders })
        .then(r => r.json())
        .then(data => {
          const msgs = data.messages || [];
          const prevHeight = messagesEl.scrollHeight;
          const prevTop = messagesEl.scrollTop;
          insertHistory(msgs);
          if (msgs.length > 0) {
            st.oldest = msgs[0].timestamp;
            st.oldestSeq = msgs[0].seq;
          }
          if (msgs.length < HISTORY_PAGE) st.done = true;
          st.loading = false;
          if (channel === selectedChannel) {
            // First page: show the newest messages. Older pages: keep the reader's place.
            if (!st.loadedOnce) scrollBottom();
            else messagesEl.scrollTop = prevTop + (messagesEl.scrollHeight - prevHeight);
          }
          st.loadedOnce = true;
          renderHistoryStatus();
          // Keep going while the channel doesn't fill the view yet
          if (channel === selectedChannel && !st.done && messagesEl.scrollHeight <= messagesEl.clientHeight) {
            loadHistory(channel);
          }
        })
        .catch(() => {
          st.loading = false;
          renderHistoryStatus();
        });
    }

    messagesEl.addEventListener("scroll", () => {
      if (messagesEl.scrollTop < 80 && historyState[selectedChannel]?.loadedOnce) loadHistory(selectedChannel);
    });

    newMsgBtnEl.onclick = () => {
      if (firstUnseenEl) firstUnseenEl.scrollIntoView({ block: "start", behavior: "smooth" });
      clearUnseen();
    };

    document.getElementById("stop-all").onclick = () => {
      fetch("/kick-all", { method: "POST", headers: adminHeaders });
    };

    // Send from dashboard
    const sendInputEl = document.getElementById("send-input");
    const sendBtnEl = document.getElementById("send-btn");
    const channelTagEl = document.getElementById("channel-tag");
    const recipientTagEl = document.getElementById("recipient-tag");
    const mentionPopupEl = document.getElementById("mention-popup");
    let recipientTarget = "@all";
    const MAX_IMAGE_SIZE = 1024; // max長辺 px
    let pendingImage = null; // { data, mimeType }

    function resizeImage(file, maxSize, callback) {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        const img = new Image();
        img.onload = () => {
          const w = img.width;
          const h = img.height;
          if (w <= maxSize && h <= maxSize) {
            callback(dataUrl.split(",")[1]);
            return;
          }
          const scale = maxSize / Math.max(w, h);
          const nw = Math.round(w * scale);
          const nh = Math.round(h * scale);
          const canvas = document.createElement("canvas");
          canvas.width = nw;
          canvas.height = nh;
          canvas.getContext("2d").drawImage(img, 0, 0, nw, nh);
          const resized = canvas.toDataURL("image/png");
          callback(resized.split(",")[1]);
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    }
    const imagePreviewEl = document.getElementById("image-preview");

    function renderImagePreview() {
      if (pendingImage) {
        imagePreviewEl.innerHTML = '<img src="data:' + pendingImage.mimeType + ';base64,' + pendingImage.data + '">'
          + '<button class="remove-img">Remove</button>';
        imagePreviewEl.classList.add("active");
        imagePreviewEl.querySelector(".remove-img").onclick = () => {
          pendingImage = null;
          renderImagePreview();
        };
      } else {
        imagePreviewEl.innerHTML = "";
        imagePreviewEl.classList.remove("active");
      }
    }

    sendInputEl.addEventListener("paste", (e) => {
      const items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const blob = item.getAsFile();
          if (!blob) return;
          resizeImage(blob, MAX_IMAGE_SIZE, (base64) => {
            pendingImage = { data: base64, mimeType: "image/png" };
            renderImagePreview();
          });
          return;
        }
      }
    });

    let mentionActive = false;
    let mentionIndex = 0;
    let mentionFiltered = [];

    function setRecipient(value) {
      recipientTarget = value;
      recipientTagEl.innerHTML = value === "@all"
        ? "@all"
        : value + ' <span class="tag-remove">&times;</span>';
    }

    recipientTagEl.addEventListener("click", (e) => {
      if (e.target.classList.contains("tag-remove")) {
        setRecipient("@all");
      }
    });

    let popupMode = ""; // "mention" or "channel"

    function getPopupQuery() {
      const val = sendInputEl.value;
      const pos = sendInputEl.selectionStart;
      const before = val.slice(0, pos);
      const mentionMatch = before.match(/@([\\w-]*)$/);
      if (mentionMatch) return { mode: "mention", query: mentionMatch[1] };
      const channelMatch = before.match(/#([\\w-]*)$/);
      if (channelMatch) return { mode: "channel", query: channelMatch[1] };
      return null;
    }

    function getMentionCandidates() {
      const chInfo = channels.get(selectedChannel);
      const memberList = chInfo ? chInfo.members : [];
      const candidates = [];
      for (const [u] of users) {
        if (u === MY_NAME) continue;
        if (!isHuman(u) && selectedChannel !== "#all" && memberList.length > 0 && !memberList.includes(u)) continue;
        candidates.push(u);
      }
      return candidates;
    }

    function getChannelCandidates() {
      return [...channels.keys()];
    }

    function showPopup() {
      const result = getPopupQuery();
      if (!result) { hidePopup(); return; }
      const candidates = result.mode === "mention" ? getMentionCandidates() : getChannelCandidates();
      mentionFiltered = candidates.filter(c => c.toLowerCase().startsWith((result.mode === "channel" ? "#" : "") + result.query.toLowerCase()));
      if (result.mode === "channel") mentionFiltered = mentionFiltered.map(c => c.replace(/^#/, ""));
      if (mentionFiltered.length === 0) { hidePopup(); return; }
      mentionIndex = 0;
      mentionActive = true;
      popupMode = result.mode;
      renderPopup();
    }

    function renderPopup() {
      const prefix = popupMode === "channel" ? "#" : "@";
      mentionPopupEl.innerHTML = "";
      mentionFiltered.forEach((name, i) => {
        const div = document.createElement("div");
        div.className = "mention-item" + (i === mentionIndex ? " active" : "");
        div.textContent = prefix + name;
        div.addEventListener("mouseenter", () => {
          mentionIndex = i;
          mentionPopupEl.querySelectorAll(".mention-item").forEach((el, j) => {
            el.classList.toggle("active", j === i);
          });
        });
        div.addEventListener("mousedown", (e) => { e.preventDefault(); selectPopupItem(name); });
        mentionPopupEl.appendChild(div);
      });
      mentionPopupEl.classList.add("visible");
    }

    function hidePopup() {
      mentionActive = false;
      mentionFiltered = [];
      popupMode = "";
      mentionPopupEl.classList.remove("visible");
    }

    function selectPopupItem(name) {
      const val = sendInputEl.value;
      const pos = sendInputEl.selectionStart;
      const before = val.slice(0, pos);
      const after = val.slice(pos);
      if (popupMode === "channel") {
        const replaced = before.replace(/#[\\w-]*$/, "#" + name + " ");
        sendInputEl.value = replaced + after;
        sendInputEl.selectionStart = sendInputEl.selectionEnd = replaced.length;
      } else {
        const replaced = before.replace(/@[\\w-]*$/, "");
        sendInputEl.value = replaced + after;
        sendInputEl.selectionStart = sendInputEl.selectionEnd = replaced.length;
        setRecipient("@" + name);
      }
      hidePopup();
      sendInputEl.focus();
    }

    function expectReply(name) {
      const prev = pendingReply.get(name);
      if (prev) clearTimeout(prev);
      pendingReply.set(name, setTimeout(() => {
        pendingReply.delete(name);
        if (users.has(name)) { users.set(name, false); renderUsers(); }
      }, 30000));
    }

    function clearPendingReply(name) {
      const timer = pendingReply.get(name);
      if (timer) { clearTimeout(timer); pendingReply.delete(name); }
    }

    function renderImageTag(image) {
      if (!image) return "";
      return '<div class="msg-image"><img src="data:' + image.mimeType + ';base64,' + image.data + '" onclick="window.open(this.src)"></div>';
    }

    function sendMessage() {
      const content = sendInputEl.value.trim();
      if (!content && !pendingImage) return;
      const channel = selectedChannel;
      const target = recipientTarget;
      const payload = { to: target, content, channel };
      if (pendingImage) payload.image = pendingImage;
      fetch("/admin-send", {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify(payload),
      }).then(() => {
        sendInputEl.value = "";
        sendInputEl.style.height = "auto";
        pendingImage = null;
        renderImagePreview();
        sendInputEl.focus();
        // Start 30s reply expectation timer
        const targetName = target.startsWith("@") ? target.slice(1) : target;
        if (targetName === "all") {
          for (const [u] of users) { if (!isHuman(u)) expectReply(u); }
        } else if (!isHuman(targetName)) {
          expectReply(targetName);
        }
      });
    }

    sendBtnEl.onclick = sendMessage;

    sendInputEl.addEventListener("keydown", (e) => {
      if (mentionActive && !e.isComposing) {
        if (e.key === "ArrowDown") { e.preventDefault(); mentionIndex = (mentionIndex + 1) % mentionFiltered.length; renderPopup(); return; }
        if (e.key === "ArrowUp") { e.preventDefault(); mentionIndex = (mentionIndex - 1 + mentionFiltered.length) % mentionFiltered.length; renderPopup(); return; }
        if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); selectPopupItem(mentionFiltered[mentionIndex]); return; }
        if (e.key === "Escape") { e.preventDefault(); hidePopup(); return; }
      }
      if (e.isComposing) return;
      if (e.key === "Enter" && !e.shiftKey && !e.metaKey) { e.preventDefault(); sendMessage(); }
    });

    sendInputEl.addEventListener("input", () => {
      sendInputEl.style.height = "auto";
      sendInputEl.style.height = Math.min(sendInputEl.scrollHeight, 120) + "px";
      sendInputEl.style.overflowY = sendInputEl.scrollHeight > 120 ? "auto" : "hidden";
      showPopup();
    });

    sendInputEl.addEventListener("blur", () => {
      setTimeout(() => hidePopup(), 150);
    });

    // Filter toggle
    const filterBtn = document.getElementById("filter-btn");
    filterBtn.onclick = () => {
      document.body.classList.toggle("filter-mine");
      filterBtn.classList.toggle("active");
    };

    // Clear button
    document.getElementById("clear-btn").onclick = () => {
      messagesEl.innerHTML = '<div class="empty">Waiting for transmissions...</div>';
      messagesEl.prepend(historyStatusEl);
      historyCleared = true;
      renderHistoryStatus();
      clearUnseen();
    };

    // Draggable sidebar width, remembered per browser
    const SIDEBAR_WIDTH_KEY = "walkie-talkie-sidebar-width";
    const SIDEBAR_DEFAULT_WIDTH = 220;
    const sidebarEl = document.getElementById("sidebar");
    const sidebarResizerEl = document.getElementById("sidebar-resizer");

    function setSidebarWidth(width, save) {
      const max = Math.max(SIDEBAR_DEFAULT_WIDTH, Math.min(600, window.innerWidth * 0.6));
      const w = Math.round(Math.min(Math.max(width, 160), max));
      sidebarEl.style.width = w + "px";
      if (save) {
        try { localStorage.setItem(SIDEBAR_WIDTH_KEY, String(w)); } catch {}
      }
    }

    try {
      const storedWidth = parseInt(localStorage.getItem(SIDEBAR_WIDTH_KEY) || "", 10);
      if (storedWidth) setSidebarWidth(storedWidth, false);
    } catch {}

    sidebarResizerEl.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      sidebarResizerEl.setPointerCapture(e.pointerId);
      document.body.classList.add("resizing");
    });
    sidebarResizerEl.addEventListener("pointermove", (e) => {
      if (!sidebarResizerEl.hasPointerCapture(e.pointerId)) return;
      setSidebarWidth(e.clientX - sidebarEl.getBoundingClientRect().left, false);
    });
    // Fires after pointerup and pointercancel alike
    sidebarResizerEl.addEventListener("lostpointercapture", () => {
      document.body.classList.remove("resizing");
      setSidebarWidth(sidebarEl.getBoundingClientRect().width, true);
    });
    sidebarResizerEl.addEventListener("dblclick", () => setSidebarWidth(SIDEBAR_DEFAULT_WIDTH, true));
    sidebarResizerEl.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const step = e.key === "ArrowLeft" ? -16 : 16;
      setSidebarWidth(sidebarEl.getBoundingClientRect().width + step, true);
    });

    const AGENT_NAME_RE = /^[a-zA-Z0-9_-]+$/;
    const agentDialogEl = document.getElementById("agent-dialog");
    const agentDialogTitle = document.getElementById("agent-dialog-title");
    const agentDialogId = document.getElementById("agent-dialog-id");
    const agentDialogName = document.getElementById("agent-dialog-name");
    const agentDialogNameError = document.getElementById("agent-dialog-name-error");
    const agentDialogWorkdir = document.getElementById("agent-dialog-workdir");
    const agentDialogAutostart = document.getElementById("agent-dialog-autostart");

    function updateCommandPreview() {
      const name = agentDialogName.value.trim();
      if (name && AGENT_NAME_RE.test(name)) {
        agentDialogNameError.style.display = "none";
      } else if (name) {
        agentDialogNameError.textContent = "Use only a-z, 0-9, hyphen, underscore";
        agentDialogNameError.style.display = "block";
      } else {
        agentDialogNameError.style.display = "none";
      }
    }

    agentDialogName.addEventListener("input", updateCommandPreview);

    function openAgentDialog(id, agent) {
      const isEdit = !!id;
      agentDialogTitle.textContent = isEdit ? "Edit Agent" : "New Agent";
      agentDialogId.value = id || "";
      agentDialogName.value = agent ? agent.name : "";
      agentDialogWorkdir.value = agent ? agent.workDir : "";
      agentDialogAutostart.checked = agent ? agent.autoStart : false;
      updateCommandPreview();
      agentDialogEl.style.display = "flex";
      agentDialogName.focus();
    }

    function closeAgentDialog() {
      agentDialogEl.style.display = "none";
    }

    document.getElementById("agent-dialog-cancel").onclick = closeAgentDialog;
    agentDialogEl.onclick = (e) => { if (e.target === agentDialogEl) closeAgentDialog(); };

    document.getElementById("agent-dialog-save").onclick = () => {
      const id = agentDialogId.value;
      const name = agentDialogName.value.trim();
      const workDir = agentDialogWorkdir.value.trim();
      const autoStart = agentDialogAutostart.checked;
      if (!name || !AGENT_NAME_RE.test(name)) { agentDialogName.focus(); updateCommandPreview(); return; }
      if (!workDir) { agentDialogWorkdir.focus(); return; }
      if (id) {
        fetch("/admin-agent-config-update", {
          method: "POST",
          headers: adminHeaders,
          body: JSON.stringify({ id, name, workDir, autoStart }),
        }).then(r => r.json()).then(data => {
          if (data.error) alert(data.error);
          else closeAgentDialog();
        }).catch(() => {});
      } else {
        fetch("/admin-agent-config-create", {
          method: "POST",
          headers: adminHeaders,
          body: JSON.stringify({ name, workDir }),
        }).then(r => r.json()).then(data => {
          if (data.error) alert(data.error);
          else closeAgentDialog();
        }).catch(() => {});
      }
    };

    document.getElementById("add-agent-btn").onclick = () => openAgentDialog(null, null);

    document.getElementById("add-channel-btn").onclick = () => {
      const name = prompt("Channel name (without #):");
      if (!name || !name.trim()) return;
      fetch("/admin-channel-create", {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify({ name: name.trim() }),
      }).then(r => r.json()).then(data => {
        if (data.error) alert(data.error);
      }).catch(() => {});
    };

    function deleteChannel(name) {
      fetch("/admin-channel-delete", {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify({ name }),
      }).then(r => r.json()).then(data => {
        if (data.error) alert(data.error);
      }).catch(() => {});
    }

    function startDashboard() {
      // Fetch initial data
      const usersLoaded = fetch("/users").then(r => r.json()).then(data => {
        for (const u of data.users) {
          users.set(u.name, u.online);
          if (u.role === "human") humans.add(u.name);
        }
        renderUsers();
      }).catch(() => {});

      fetch("/channels").then(r => r.json()).then(data => {
        for (const ch of data.channels) {
          channels.set(ch.name, { memberCount: ch.memberCount, createdBy: ch.createdBy, members: ch.members || [] });
        }
        renderChannels();
        updateChannelHeader();
      }).catch(() => {});

      // Load agent configs
      refreshAgentConfigs();

      // Load unread counts
      fetch("/admin-unread-counts", { headers: adminHeaders })
        .then(r => r.json())
        .then(data => {
          if (data.counts) {
            for (const [ch, cnt] of Object.entries(data.counts)) {
              unreadCounts[ch] = cnt;
            }
            renderChannels();
          }
        }).catch(() => {});

      // Load the open channel's history (after users, so human senders are known)
      usersLoaded.then(() => {
        loadHistory(selectedChannel);
        markChannelRead(selectedChannel);
      });

      const es = new EventSource("/events?token=" + encodeURIComponent(ADMIN_TOKEN) + "&name=" + encodeURIComponent(MY_NAME));

      es.onmessage = (e) => {
        const ev = JSON.parse(e.data);

        if (ev.type === "status") {
          if (users.has(ev.name)) {
            users.set(ev.name, ev.online);
            renderUsers();
            renderAgents();
          }
        } else if (ev.type === "join") {
          if (ev.role === "human") humans.add(ev.name);
          // Humans come online when their dashboard connects (a status event follows)
          users.set(ev.name, ev.role !== "human");
          renderUsers();
          renderAgents();
          refreshChannels();
          addMessage(
            '<span class="time">' + formatTime(ev.timestamp) + '</span>' +
            '<strong>' + ev.name + '</strong> joined the channel',
            "system",
            null
          );
        } else if (ev.type === "leave") {
          users.delete(ev.name);
          humans.delete(ev.name);
          renderUsers();
          renderAgents();
          refreshChannels();
          addMessage(
            '<span class="time">' + formatTime(ev.timestamp) + '</span>' +
            '<strong>' + ev.name + '</strong> left the channel',
            "system leave",
            null
          );
        } else if (ev.type === "message") {
          // Clear typing and pending-reply state when user sends a real message
          clearPendingReply(ev.from);
          if (users.has(ev.from)) users.set(ev.from, true);
          const existingTimer = typingUsers.get(ev.from);
          if (existingTimer) { clearTimeout(existingTimer.timeoutId); typingUsers.delete(ev.from); renderUsers(); renderTypingBar(); }
          const msgChannel = ev.channel || "#all";
          if (!historyState[msgChannel] && !firstLiveTs[msgChannel]) firstLiveTs[msgChannel] = ev.timestamp;
          addMessage(messageHtml(ev), messageClass(ev.from, ev.fromRole), msgChannel, ev.timestamp);
          // Unread tracking
          if (msgChannel === selectedChannel) {
            markChannelRead(msgChannel);
          } else {
            unreadCounts[msgChannel] = (unreadCounts[msgChannel] || 0) + 1;
            renderChannels();
          }
        } else if (ev.type === "channel_create") {
          refreshChannels();
          addMessage(
            '<span class="time">' + formatTime(ev.timestamp) + '</span>' +
            'Channel <strong>' + ev.name + '</strong> created',
            "system channel-event",
            null
          );
        } else if (ev.type === "channel_join") {
          refreshChannels();
          addMessage(
            '<span class="time">' + formatTime(ev.timestamp) + '</span>' +
            '<strong>' + ev.userName + '</strong> joined <strong>' + ev.channel + '</strong>',
            "system channel-event",
            ev.channel
          );
        } else if (ev.type === "channel_leave") {
          refreshChannels();
          addMessage(
            '<span class="time">' + formatTime(ev.timestamp) + '</span>' +
            '<strong>' + ev.userName + '</strong> left <strong>' + ev.channel + '</strong>',
            "system channel-event leave",
            ev.channel
          );
        } else if (ev.type === "read_update") {
          if (ev.userName === MY_NAME) {
            delete unreadCounts[ev.channel];
            renderChannels();
          }
        } else if (ev.type === "channel_delete") {
          if (selectedChannel === ev.name) selectedChannel = "#all";
          delete unreadCounts[ev.name];
          delete historyState[ev.name];
          refreshChannels();
          addMessage(
            '<span class="time">' + formatTime(ev.timestamp) + '</span>' +
            'Channel <strong>' + ev.name + '</strong> deleted',
            "system channel-event leave",
            null
          );
        } else if (ev.type === "agent_config_create" || ev.type === "agent_config_update") {
          refreshAgentConfigs();
        } else if (ev.type === "agent_config_delete") {
          agentConfigs.delete(ev.id);
          renderAgents();
        } else if (ev.type === "typing") {
          clearPendingReply(ev.name);
          if (users.has(ev.name)) users.set(ev.name, true);
          const prev = typingUsers.get(ev.name);
          if (prev) clearTimeout(prev.timeoutId);
          typingUsers.set(ev.name, { timeoutId: setTimeout(() => { typingUsers.delete(ev.name); renderUsers(); renderTypingBar(); }, 60000), channel: ev.channel || "#all" });
          renderUsers();
          renderTypingBar();
        }
      };

      es.onopen = () => {
        statusEl.textContent = "connected";
        statusEl.className = "";
      };

      es.onerror = () => {
        statusEl.textContent = "disconnected";
        statusEl.className = "disconnected";
      };
    }

    // Login: the admin token is never embedded in the page, and each person picks a name.
    // Both are remembered, so the dialog only asks for what is missing. The name is kept per tab
    // (sessionStorage) so different tabs can be different people; the last name used
    // (localStorage) is the default for new tabs.
    const USER_STORAGE_KEY = "walkie-talkie-user-name";
    const SWITCH_USER_KEY = "walkie-talkie-switch-user";
    const loginDialogEl = document.getElementById("login-dialog");
    const loginInputEl = document.getElementById("login-token");
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

    function rememberedName() {
      if (readStored(SWITCH_USER_KEY, true)) return "";
      return readStored(USER_STORAGE_KEY, true) || readStored(USER_STORAGE_KEY);
    }

    // Resolves to null on success, or { field, error } describing what to ask for again
    function tryLogin(token, name) {
      return fetch("/admin-login", { method: "POST", headers: { "Authorization": "Bearer " + token, "X-Walkie-User": name } })
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
          document.getElementById("whoami").innerHTML = "Signed in as <strong>" + name + "</strong>";
          loginDialogEl.style.display = "none";
          startDashboard();
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
      (loginNeedsToken ? loginInputEl : loginNameEl).focus();
    }

    function submitLogin(asName) {
      const token = loginNeedsToken ? loginInputEl.value.trim() : readStored(TOKEN_STORAGE_KEY);
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
    loginInputEl.addEventListener("keydown", (e) => { if (e.key === "Enter") submitLogin(); });
    loginNameEl.addEventListener("keydown", (e) => { if (e.key === "Enter") submitLogin(); });

    // Only this tab switches; other tabs keep their names
    document.getElementById("switch-user-btn").onclick = () => {
      store(SWITCH_USER_KEY, "1", true);
      store(USER_STORAGE_KEY, "", true);
      location.reload();
    };

    loginNeedsToken = !readStored(TOKEN_STORAGE_KEY);
    loginNeedsName = !rememberedName();
    if (loginNeedsToken || loginNeedsName) showLogin();
    else submitLogin();
  </script>
</body>
</html>`;
}
