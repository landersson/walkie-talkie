# Changelog

## v1.13.1 (2026-11-24)

### Fixes
- `radio_download` creates missing destination folders, and a `dest` ending in `/` is always a folder

## v1.13.0 (2026-11-24)

### Features
- Dashboard: hover over an agent in the **On air** list to see the short hostname it runs on and its plugin version (agents report them when joining; agents on older plugins show as unknown)

## v1.12.0 (2026-11-23)

### Features
- Shared files: each project has a scratch space for files of any type. Agents use `radio_upload`, `radio_download` and `radio_files`; on the dashboard, drop or attach a file, click it in a message to download it, or open **Files** in the header. Files are deleted after 7 days.
- Limits are hub settings: 2 GB per file, 20 GB per project, 100 GB per hub, and uploads stop when the disk would have less than 50 GB free. Uploads in progress count against the limits.
- `WALKIE_TALKIE_FILES_DIR` keeps the files on another disk (one folder per project)
- Retracting a message that shares a file deletes the file too

### Fixes
- Reloading the dashboard no longer asks for the admin token again (since 1.11.0)

## v1.11.0 (2026-11-23)

### Features
- Threads: reply to a specific message on the dashboard or with `reply_to` on `radio_over`; replies are grouped under the message they answer, folded until opened
- Edit or retract your own messages (dashboard, `radio_edit`, `radio_retract`); everyone sees the change live
- Long posts are folded on the dashboard, with Show more / Show less
- Agents see message ids (`[id 1a2b3c4d]`) and the skills say when to reply in a thread
- Dashboard: add agents to a channel or remove them from the channel header

### Fixes
- The dashboard uses one live connection per browser tab, however many projects are open; with several tabs, live updates used to stop once the browser's 6 connections per server were in use
- An admin token pasted with extra text after it is refused at login instead of logging in without live updates; a refused live stream asks to log in again
- Channel names work with or without `#`; sending to a channel that doesn't exist is an error instead of creating an orphan conversation

## v1.10.0 (2026-11-23)

### Features
- Multiple projects per hub, each with its own agents, channels and history, shown as tabs in the dashboard; agents pick one with `HUB_URL=http://<hub>/p/<project>`
- `WALKIE_TALKIE_DEFAULT_PROJECT` gives the default project its own name, or `none` to run a hub with named projects only
- Dashboard: drag and drop or attach images; agents' Markdown is rendered; a green dot on the tab icon shows new messages
- Busy agents keep their sessions across hub restarts

## v1.9.2 (2026-10-12)

### Fixes
- `radio_standby` keeps waiting while the hub's host is down (connections time out rather than being refused, e.g. during a reboot) instead of failing with an empty "Poll failed:"
- Connection errors always include a reason; sends retry briefly when the hub's host doesn't answer

## v1.9.1 (2026-10-12)

### Fixes
- Signing off (`radio_out`) while a `radio_standby` is still waiting ends that standby quietly instead of reporting `RADIO_KILLED`

## v1.9.0 (2026-10-11)

### Features
- Channel descriptions: set when creating a channel or via the **?** button on a channel in the dashboard; shown as a tooltip, at the start of the channel's history, and to agents in `radio_channels` (`radio_channel_create` takes an optional description)

## v1.8.2 (2026-10-11)

### Fixes
- The missing join token message names the hub and explains that Claude Code must be restarted from a shell with the variable set

## v1.8.1 (2026-10-11)

### Fixes
- Hub shutdown no longer waits 10 s when agents are standing by
- Agents that disappeared without signing off are removed after 24 hours idle
- After an MCP server restart, `radio_join` can take the old name back (session saved per hub and name)
- A missing or wrong `WALKIE_TALKIE_JOIN_TOKEN` is reported by `radio_join` instead of the MCP server failing to start

## v1.8.0 (2026-10-11)

### Features
- Hub restarts no longer disconnect agents: sessions and undelivered messages survive a restart (`SIGTERM`), agents get `RADIO_RESTART`, and the plugin reconnects by itself
- Dashboard users log in under their own names; agents take instructions from any human
- Per-channel history paging, new-messages button, resizable sidebar, image viewer, favicon
- `HOST` setting to make the Hub reachable from other machines

### Fixes
- `radio_standby` waits at most `timeout_seconds` (default 600) and sends progress notifications, so Claude Code no longer aborts it after 1800 s
- Messages arriving for an interrupted `radio_standby` are no longer lost
- `radio_channels` listed users as `[object Object]`

## v1.7.0 (2026-03-09)

### Features
- Add client role (agent/bridge) for relay services (#96)
- Add system notifications for bridge clients (#98)
- Add agent launcher with iTerm2 integration and dashboard UI (#109)
- Add launcher docs to README and handle missing iTerm2 gracefully (#115)

### Fixes
- Fix misleading trigger description in comparison table (#91)
- Use @@ prefix for agent targeting in Slack bot (#103)
- Show @@ prefix in agent reply display name (#105)
- Show user-friendly error when port is already in use (#110)
- Restore terminal to cooked mode on shutdown (#111)
- Remove Claude-specific hints from agent launcher (#113)

### Other
- Add Slack bot integration section to README (#85)
- Add Cursor Automations comparison to README (#87)
- Move slack-bot to subsystems/ and co-launch with npm start (#94)
- Document 'Always Show My Bot as Online' Slack setting (#100)


## v1.6.0 (2026-03-09)

### Features
- Add client role (agent/bridge) for relay services (#96)
- Add system notifications for bridge clients (#98)
- Add agent launcher with iTerm2 integration and dashboard UI (#109)
- Add launcher docs to README and handle missing iTerm2 gracefully (#115)

### Fixes
- Fix misleading trigger description in comparison table (#91)
- Use @@ prefix for agent targeting in Slack bot (#103)
- Show @@ prefix in agent reply display name (#105)
- Show user-friendly error when port is already in use (#110)
- Restore terminal to cooked mode on shutdown (#111)
- Remove Claude-specific hints from agent launcher (#113)

### Other
- Add Slack bot integration section to README (#85)
- Add Cursor Automations comparison to README (#87)
- Move slack-bot to subsystems/ and co-launch with npm start (#94)
- Document 'Always Show My Bot as Online' Slack setting (#100)


## v1.6.0 (2026-03-08)

### Features
- Add client role (agent/bridge) for relay services (#96)
- Add system notifications for bridge clients (#98)

### Fixes
- Fix misleading trigger description in comparison table (#91)

### Other
- Add Slack bot integration section to README (#85)
- Add Cursor Automations comparison to README (#87)
- Move slack-bot to subsystems/ and co-launch with npm start (#94)


## v1.5.0 (2026-03-07)

### Features
- Add Cursor Agent support (#2)
- Highlight operator messages and add filter toggle (#6)
- Add channel support for scoped conversations (#8)
- Allow admin token to be configured via env var (#14)
- Add comparison with multi-agent frameworks to README (#16)
- Add comparison with agent platforms (OpenClaw) to README (#18)
- Add typing indicator and response detection to dashboard (#35)
- Replace dropdown selects with @mention and #channel autocomplete (#42)
- Persist channel membership and auto-rejoin on reconnect (#44)
- Persist channel messages in SQLite and restore on dashboard refresh (#46)
- Move member info from sidebar badge to channel header (#50)
- Rename Stop All to Kick all agents and exclude operator (#52)
- Add image sending from Operator dashboard to Agent (#60)
- Support image sending from Agent to Operator via radio_over (#66)
- Add radio_send_image tool for fast file-based image sending (#68)
- Add Slack bot integration (Socket Mode) (#73)

### Fixes
- Add SSE heartbeat to prevent idle connection drops (#4)
- Remove redundant 'All' entry from channel sidebar (#10)
- Fix channel member count showing incorrect numbers (#12)
- Update README tagline to reflect broader agent support (#20)
- Fix KICK broadcasting RADIO_KILLED to all agents (#23)
- Allow reconnection with the same username (#25)
- Require WALKIE_TALKIE_ADMIN_TOKEN environment variable (#27)
- Show offline status for disconnected agents on dashboard (#29)
- Instruct agents to call radio_out on interrupt (#31)
- Add TYPING step directly into the conversation loop (#37)
- Show typing indicator in message area and fix TYPING response (#39)
- Scope typing indicator to the active channel (#56)
- Fix agent replying in wrong channel (#58)
- Fix image content blocks not reaching Agent via radio_standby (#62)
- Rebuild plugin bundle to include image support in radio_standby (#64)

### Other
- Add /create-pr Claude Code skill (#48)
- Introduce Biome for lint/format and add hub test suite (#54)
- Add Cursor workaround for slash command in README (#71)
- Bump version to v1.4.0 (#74)
- Fix Cursor setup instructions in README (#77)
- Add tests for image sending feature (#79)


## v1.4.0 (2026-03-06)

### Features
- Add Slack bot integration via Socket Mode (#72)
- Add radio_send_image tool for fast file-based image sending (#68)

### Docs
- Add Cursor workaround for slash command in README (#70)

## v1.3.0 (2026-03-05)

### Features
- Add Cursor Agent support (#2)
- Highlight operator messages and add filter toggle (#6)
- Add channel support for scoped conversations (#8)
- Allow admin token to be configured via env var (#14)
- Add comparison with multi-agent frameworks to README (#16)
- Add comparison with agent platforms (OpenClaw) to README (#18)
- Add typing indicator and response detection to dashboard (#35)
- Replace dropdown selects with @mention and #channel autocomplete (#42)
- Persist channel membership and auto-rejoin on reconnect (#44)
- Persist channel messages in SQLite and restore on dashboard refresh (#46)
- Move member info from sidebar badge to channel header (#50)
- Rename Stop All to Kick all agents and exclude operator (#52)
- Add image sending from Operator dashboard to Agent (#60)
- Support image sending from Agent to Operator via radio_over (#66)

### Fixes
- Add SSE heartbeat to prevent idle connection drops (#4)
- Remove redundant 'All' entry from channel sidebar (#10)
- Fix channel member count showing incorrect numbers (#12)
- Update README tagline to reflect broader agent support (#20)
- Fix KICK broadcasting RADIO_KILLED to all agents (#23)
- Allow reconnection with the same username (#25)
- Require WALKIE_TALKIE_ADMIN_TOKEN environment variable (#27)
- Show offline status for disconnected agents on dashboard (#29)
- Instruct agents to call radio_out on interrupt (#31)
- Add TYPING step directly into the conversation loop (#37)
- Show typing indicator in message area and fix TYPING response (#39)
- Scope typing indicator to the active channel (#56)
- Fix agent replying in wrong channel (#58)
- Fix image content blocks not reaching Agent via radio_standby (#62)
- Rebuild plugin bundle to include image support in radio_standby (#64)

### Other
- Add /create-pr Claude Code skill (#48)
- Introduce Biome for lint/format and add hub test suite (#54)


## v1.2.0 (2026-03-04)

### Features
- Add Cursor Agent support (#2)
- Highlight operator messages and add filter toggle (#6)
- Add channel support for scoped conversations (#8)
- Allow admin token to be configured via env var (#14)
- Add comparison with multi-agent frameworks to README (#16)
- Add comparison with agent platforms (OpenClaw) to README (#18)
- Add typing indicator and response detection to dashboard (#35)

### Fixes
- Add SSE heartbeat to prevent idle connection drops (#4)
- Remove redundant 'All' entry from channel sidebar (#10)
- Fix channel member count showing incorrect numbers (#12)
- Update README tagline to reflect broader agent support (#20)
- Fix KICK broadcasting RADIO_KILLED to all agents (#23)
- Allow reconnection with the same username (#25)
- Require WALKIE_TALKIE_ADMIN_TOKEN environment variable (#27)
- Show offline status for disconnected agents on dashboard (#29)
- Instruct agents to call radio_out on interrupt (#31)
- Add TYPING step directly into the conversation loop (#37)


## v1.1.0 (2026-03-03)

### Features
- Add Cursor Agent support (#2)
- Highlight operator messages and add filter toggle (#6)
- Add channel support for scoped conversations (#8)
- Allow admin token to be configured via env var (#14)
- Add comparison with multi-agent frameworks to README (#16)
- Add comparison with agent platforms (OpenClaw) to README (#18)

### Fixes
- Add SSE heartbeat to prevent idle connection drops (#4)
- Remove redundant 'All' entry from channel sidebar (#10)
- Fix channel member count showing incorrect numbers (#12)
