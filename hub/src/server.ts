import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import path from "node:path";
import { getDashboardHTML } from "./dashboard.js";
import type { AgentConfigRow } from "./db.js";
import { createEventStream } from "./events.js";
import { launchAgent } from "./launcher.js";
import { createProject, type Project } from "./project.js";
import {
  archiveProjectFiles,
  DEFAULT_PROJECT,
  listProjectNames,
  NAME_RE,
  NAME_RULES,
  NO_DEFAULT_PROJECT,
  projectDbPath,
  validateProjectName,
} from "./projects.js";
import { getShellHTML } from "./shell.js";
import type { RegisterRequest, RouteHandler, SendRequest, UserRole } from "./types.js";

const AGENT_NAME_RE = /^[a-zA-Z0-9_-]+$/;
const RESERVED_NAMES = new Set(["system", "slack"]);
const DEFAULT_HUMAN = "operator";

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function sendError(res: ServerResponse, status: number, message: string): void {
  sendJson(res, status, { error: message });
}

function authenticateBearer(req: IncomingMessage, expected: string): boolean {
  const auth = req.headers.authorization;
  if (!auth) return false;
  const [scheme, token] = auth.split(" ");
  return scheme === "Bearer" && token === expected;
}

type Route = { method: string; handler: RouteHandler };
type RouteTable = Record<string, Route>;

function runRoute(route: Route, req: IncomingMessage, res: ServerResponse, userName?: string): void {
  route.handler(req, res, userName).catch((e) => {
    sendError(res, 500, (e as Error).message);
  });
}

function checkMethod(route: Route, req: IncomingMessage, res: ServerResponse): boolean {
  if (req.method === route.method) return true;
  sendError(res, 405, "Method not allowed");
  return false;
}

type HumanError = { status: number; error: string } | null;

/** Why `name` can't be a human's name, or null if it can. */
function humanNameError(name: string): HumanError {
  if (!NAME_RE.test(name) || RESERVED_NAMES.has(name)) {
    return { status: 400, error: `Invalid name "${name}" (${NAME_RULES})` };
  }
  return null;
}

/**
 * The human opening a dashboard live stream, or null after replying with an error.
 * EventSource cannot send headers, so the admin token and the name are query params.
 */
function streamHuman(
  url: URL,
  res: ServerResponse,
  adminToken: string,
  ensureHuman: (name: string) => HumanError,
): string | null {
  if (url.searchParams.get("token") !== adminToken) {
    sendError(res, 401, "Unauthorized");
    return null;
  }
  const name = url.searchParams.get("name") || DEFAULT_HUMAN;
  const error = ensureHuman(name);
  if (error) {
    sendError(res, error.status, error.error);
    return null;
  }
  return name;
}

/**
 * The request handlers and session bookkeeping of one project. Everything here works on
 * `project` only, so projects never see each other's users, channels or messages.
 */
function createProjectApp(project: Project, adminToken: string, joinToken: string) {
  const {
    authenticateRequest,
    getRegisteredUsers,
    getUserRole,
    getUserToken,
    isUserRegistered,
    registerUser,
    restoreUser,
    unregisterUser,
  } = project.auth;
  const {
    ensureChannelMembership,
    getChannelMemberCounts,
    getChannelMembers,
    isChannelMember,
    joinChannel,
    leaveChannel,
    removeChannel,
  } = project.channels;
  const {
    dbCreateAgentConfig,
    dbCreateChannel,
    dbDeleteAgentConfig,
    dbDeleteAllSessions,
    dbDeleteChannel,
    dbDeleteChannelMessages,
    dbDeleteReadCursorsForChannel,
    dbGetAgentConfig,
    dbGetChannel,
    dbGetChannelMessages,
    dbGetRecentMessages,
    dbGetUnreadCounts,
    dbGetUserChannels,
    dbListAgentConfigs,
    dbListChannels,
    dbListSessions,
    dbSavePendingMessages,
    dbSetChannelDescription,
    dbTakePendingMessages,
    dbUpdateAgentConfig,
    dbUpdateReadCursor,
  } = project.db;
  const { addSSEClient, broadcast } = project.events;
  const { addPoll, closeAllPolls, hasPendingPoll, isOnline, onPollDisconnect, removePoll, setOffline, setOnline } =
    project.polling;
  const { drainQueue, enqueueAndDeliver, ensureQueue, getAllQueues, notifyBridges, removeQueue, routeMessage } =
    project.router;

  // Open dashboard event streams per human; a human is online while at least one is open
  const humanConnections = new Map<string, number>();

  /**
   * Register `name` as a human user if needed.
   * Returns an HTTP error when the name is invalid or already held by an agent/bridge.
   */
  function ensureHuman(name: string): HumanError {
    const invalid = humanNameError(name);
    if (invalid) return invalid;
    const role = getUserRole(name);
    if (role === "human") return null;
    if (role) {
      return { status: 409, error: `Name "${name}" is already used by ${role === "agent" ? "an agent" : "a bridge"}` };
    }
    registerUser(name, "human");
    if (!humanConnections.get(name)) setOffline(name);
    broadcast({ type: "join", name, role: "human", timestamp: Date.now() });
    console.log(`[human] ${name}`);
    return null;
  }

  function connectHuman(name: string): void {
    const count = (humanConnections.get(name) ?? 0) + 1;
    humanConnections.set(name, count);
    if (count === 1) {
      setOnline(name);
      broadcast({ type: "status", name, online: true, timestamp: Date.now() });
    }
  }

  function disconnectHuman(name: string): void {
    const count = (humanConnections.get(name) ?? 1) - 1;
    if (count > 0) {
      humanConnections.set(name, count);
      return;
    }
    humanConnections.delete(name);
    if (getUserRole(name) === "human") {
      setOffline(name);
      broadcast({ type: "status", name, online: false, timestamp: Date.now() });
    }
  }

  const handleRegister: RouteHandler = async (req, res) => {
    const body = JSON.parse(await readBody(req)) as RegisterRequest;
    if (!body.name || typeof body.name !== "string") {
      return sendError(res, 400, "Missing or invalid 'name' field");
    }
    try {
      // Allow reconnection only if the caller proves ownership with the old token
      if (isUserRegistered(body.name)) {
        const existingToken = getUserToken(body.name);
        if (!body.oldToken || body.oldToken !== existingToken) {
          return sendError(res, 409, nameTakenMessage(body.name));
        }
        removePoll(body.name);
        removeQueue(body.name);
        unregisterUser(body.name);
      }
      // Cancel grace timer if reconnecting
      const graceTimer = staleTimers.get(body.name);
      if (graceTimer) {
        clearTimeout(graceTimer);
        staleTimers.delete(body.name);
      }
      staleDeadlines.delete(body.name);
      const role = body.role === "bridge" ? "bridge" : "agent";
      const user = registerUser(body.name, role);
      lastSeen.set(body.name, Date.now());
      ensureQueue(body.name);
      setOnline(body.name);
      // Auto-join #all
      try {
        joinChannel("#all", body.name);
      } catch {
        /* already joined or channel issue */
      }
      // Restore previous channel memberships from DB
      const previousChannels = dbGetUserChannels(body.name);
      for (const ch of previousChannels) {
        if (ch === "#all") continue;
        try {
          joinChannel(ch, body.name);
          broadcast({ type: "channel_join", channel: ch, userName: body.name, timestamp: Date.now() });
          console.log(`[auto-rejoin] ${body.name} -> ${ch}`);
        } catch {
          /* channel may no longer exist */
        }
      }
      broadcast({ type: "join", name: body.name, role, timestamp: Date.now() });
      console.log(`[register] ${body.name}`);

      if (role === "agent") {
        notifyBridges(`USER_JOINED: ${body.name}`);
      } else if (role === "bridge") {
        // Send current agent list to the newly connected bridge (even if empty)
        const agents = getRegisteredUsers().filter((n) => n !== body.name && getUserRole(n) === "agent");
        enqueueAndDeliver(body.name, {
          id: randomUUID(),
          from: "system",
          to: body.name,
          content: agents.length > 0 ? `CONNECTED_USERS: ${agents.join(", ")}` : "CONNECTED_USERS: (none)",
          channel: "#all",
          timestamp: Date.now(),
        });
      }

      sendJson(res, 200, { token: user.token, name: user.name });
    } catch (e) {
      sendError(res, 409, (e as Error).message);
    }
  };

  const handleSend: RouteHandler = async (req, res, userName) => {
    const body = JSON.parse(await readBody(req)) as SendRequest;
    if (!body.to || (!body.content && !body.image)) {
      return sendError(res, 400, "Missing 'to' or 'content' field");
    }
    // Typing indicator: broadcast typing event without routing to chat log
    if (body.content === "TYPING") {
      const channel = body.channel || "#all";
      dbUpdateReadCursor(userName!, channel);
      broadcast({ type: "typing", name: userName!, channel, timestamp: Date.now() });
      console.log(`[typing] ${userName}`);
      return sendJson(res, 200, { id: "typing", to: body.to });
    }
    const content = body.content || "";
    const channel = body.channel || "#all";
    try {
      const message = routeMessage(userName!, body.to, content, channel, body.image);
      broadcast({
        type: "message",
        from: message.from,
        to: message.to,
        content: message.content,
        channel: message.channel,
        timestamp: message.timestamp,
        image: message.image,
        fromRole: message.fromRole,
      });
      console.log(`[send] ${userName} -> ${body.to} (${channel}): ${content}${body.image ? " [+image]" : ""}`);
      sendJson(res, 200, { id: message.id, to: message.to });
    } catch (e) {
      sendError(res, 404, (e as Error).message);
    }
  };

  const handleInbox: RouteHandler = async (_req, res, userName) => {
    const messages = drainQueue(userName!);
    sendJson(res, 200, { messages });
  };

  const handlePoll: RouteHandler = async (req, res, userName) => {
    const wasOffline = !isOnline(userName!);
    // Optional ?timeout=<seconds> to end the poll early with 204 (clamped to 1 s .. 1 h)
    const url = new URL(req.url ?? "/", "http://localhost");
    const timeoutSec = parseInt(url.searchParams.get("timeout") ?? "", 10);
    addPoll(userName!, req, res, timeoutSec > 0 ? timeoutSec * 1000 : undefined);
    if (wasOffline) {
      setOnline(userName!);
      broadcast({ type: "status", name: userName!, online: true, timestamp: Date.now() });
    }
  };

  const handleUsers: RouteHandler = async (_req, res) => {
    const users = getRegisteredUsers().map((name) => ({
      name,
      online: isOnline(name),
      role: getUserRole(name) ?? "agent",
    }));
    sendJson(res, 200, { users });
  };

  const handleUnregister: RouteHandler = async (_req, res, userName) => {
    const role = getUserRole(userName!);
    removePoll(userName!);
    removeQueue(userName!);
    unregisterUser(userName!);
    broadcast({ type: "leave", name: userName!, timestamp: Date.now() });
    if (role === "agent") {
      notifyBridges(`USER_LEFT: ${userName}`);
    }
    console.log(`[unregister] ${userName}`);
    sendJson(res, 200, { ok: true });
  };

  function kickUser(name: string): boolean {
    if (!getRegisteredUsers().includes(name)) return false;
    const role = getUserRole(name);
    // Send a termination message directly to the target user's queue only
    ensureQueue(name);
    enqueueAndDeliver(name, {
      id: randomUUID(),
      from: "system",
      to: name,
      content: "RADIO_KILLED: You have been disconnected by the operator.",
      channel: "#all",
      timestamp: Date.now(),
    });
    removePoll(name);
    removeQueue(name);
    unregisterUser(name);
    broadcast({ type: "leave", name, timestamp: Date.now() });
    if (role === "agent") {
      notifyBridges(`USER_LEFT: ${name}`);
    }
    console.log(`[kick] ${name}`);
    return true;
  }

  const handleKick: RouteHandler = async (req, res) => {
    const body = JSON.parse(await readBody(req)) as { name?: string };
    if (!body.name) {
      return sendError(res, 400, "Missing 'name' field");
    }
    if (getUserRole(body.name) === "human") {
      return sendError(res, 400, `"${body.name}" is a human and cannot be kicked`);
    }
    if (kickUser(body.name)) {
      sendJson(res, 200, { ok: true, kicked: body.name });
    } else {
      sendError(res, 404, `User "${body.name}" not found`);
    }
  };

  const handleKickAll: RouteHandler = async (_req, res) => {
    const agents = [...getRegisteredUsers()].filter((name) => getUserRole(name) !== "human");
    for (const name of agents) {
      kickUser(name);
    }
    sendJson(res, 200, { ok: true, kicked: agents });
  };

  const handleAdminLogin: RouteHandler = async (_req, res, userName) => {
    // The caller's name was already validated and registered by the admin route guard
    sendJson(res, 200, { ok: true, name: userName });
  };

  const handleAdminSend: RouteHandler = async (req, res, userName) => {
    const body = JSON.parse(await readBody(req)) as {
      to?: string;
      content?: string;
      channel?: string;
      image?: { data: string; mimeType: string };
    };
    const from = userName!;
    if (!body.to || (!body.content && !body.image)) {
      return sendError(res, 400, "Missing 'to' or 'content' field");
    }
    const content = body.content || "";
    const channel = body.channel || "#all";
    try {
      const message = routeMessage(from, body.to, content, channel, body.image);
      broadcast({
        type: "message",
        from: message.from,
        to: message.to,
        content: message.content,
        channel: message.channel,
        timestamp: message.timestamp,
        image: message.image,
        fromRole: message.fromRole,
      });
      console.log(`[admin-send] ${from} -> ${body.to} (${channel}): ${content}${body.image ? " [+image]" : ""}`);
      sendJson(res, 200, { id: message.id, to: message.to });
    } catch (e) {
      sendError(res, 404, (e as Error).message);
    }
  };

  // Channel endpoints
  const CHANNEL_DESCRIPTION_MAX = 1000;

  /** Validates an optional channel description; returns it trimmed, or an error message. */
  function parseDescription(value: unknown): { description: string } | { error: string } {
    if (value === undefined || value === null) return { description: "" };
    if (typeof value !== "string") return { error: "Invalid 'description' field" };
    const description = value.trim();
    if (description.length > CHANNEL_DESCRIPTION_MAX) {
      return { error: `Description too long (max ${CHANNEL_DESCRIPTION_MAX} characters)` };
    }
    return { description };
  }

  const handleChannelCreate: RouteHandler = async (req, res, userName) => {
    const body = JSON.parse(await readBody(req)) as { name?: string; description?: unknown };
    if (!body.name || typeof body.name !== "string") {
      return sendError(res, 400, "Missing or invalid 'name' field");
    }
    const parsed = parseDescription(body.description);
    if ("error" in parsed) return sendError(res, 400, parsed.error);
    const channelName = body.name.startsWith("#") ? body.name : `#${body.name}`;
    if (dbGetChannel(channelName)) {
      return sendError(res, 409, `Channel "${channelName}" already exists`);
    }
    try {
      dbCreateChannel(channelName, userName!, parsed.description);
      ensureChannelMembership(channelName);
      // Auto-join the creator
      joinChannel(channelName, userName!);
      broadcast({ type: "channel_create", name: channelName, timestamp: Date.now() });
      broadcast({ type: "channel_join", channel: channelName, userName: userName!, timestamp: Date.now() });
      console.log(`[channel-create] ${channelName} by ${userName}`);
      sendJson(res, 200, { ok: true, channel: channelName });
    } catch (e) {
      sendError(res, 500, (e as Error).message);
    }
  };

  const handleChannelJoin: RouteHandler = async (req, res, userName) => {
    const body = JSON.parse(await readBody(req)) as { channel?: string };
    if (!body.channel || typeof body.channel !== "string") {
      return sendError(res, 400, "Missing or invalid 'channel' field");
    }
    try {
      joinChannel(body.channel, userName!);
      broadcast({ type: "channel_join", channel: body.channel, userName: userName!, timestamp: Date.now() });
      console.log(`[channel-join] ${userName} -> ${body.channel}`);
      sendJson(res, 200, { ok: true, channel: body.channel });
    } catch (e) {
      sendError(res, 404, (e as Error).message);
    }
  };

  const handleChannelLeave: RouteHandler = async (req, res, userName) => {
    const body = JSON.parse(await readBody(req)) as { channel?: string };
    if (!body.channel || typeof body.channel !== "string") {
      return sendError(res, 400, "Missing or invalid 'channel' field");
    }
    if (body.channel === "#all") {
      return sendError(res, 400, "Cannot leave #all");
    }
    leaveChannel(body.channel, userName!);
    broadcast({ type: "channel_leave", channel: body.channel, userName: userName!, timestamp: Date.now() });
    console.log(`[channel-leave] ${userName} <- ${body.channel}`);
    sendJson(res, 200, { ok: true, channel: body.channel });
  };

  const handleChannelInvite: RouteHandler = async (req, res, userName) => {
    const body = JSON.parse(await readBody(req)) as { channel?: string; user?: string };
    if (!body.channel || typeof body.channel !== "string") {
      return sendError(res, 400, "Missing or invalid 'channel' field");
    }
    if (!body.user || typeof body.user !== "string") {
      return sendError(res, 400, "Missing or invalid 'user' field");
    }
    const targetName = body.user.startsWith("@") ? body.user.slice(1) : body.user;
    if (!isUserRegistered(targetName)) {
      return sendError(res, 404, `User "${targetName}" is not connected`);
    }
    try {
      joinChannel(body.channel, targetName);
      broadcast({ type: "channel_join", channel: body.channel, userName: targetName, timestamp: Date.now() });
      // Notify the invited user via a system message in the channel
      routeMessage("system", `@${targetName}`, `You have been invited to ${body.channel} by ${userName}`, body.channel);
      console.log(`[channel-invite] ${userName} invited ${targetName} to ${body.channel}`);
      sendJson(res, 200, { ok: true, channel: body.channel, user: targetName });
    } catch (e) {
      sendError(res, 400, (e as Error).message);
    }
  };

  const handleListChannels: RouteHandler = async (_req, res) => {
    const channels = dbListChannels();
    const memberCounts = getChannelMemberCounts();
    const result = channels.map((ch) => ({
      name: ch.name,
      createdBy: ch.created_by,
      createdAt: ch.created_at,
      description: ch.description ?? "",
      memberCount: memberCounts.get(ch.name) ?? 0,
      members: getChannelMembers(ch.name),
    }));
    sendJson(res, 200, { channels: result });
  };

  const handleChannelHistory: RouteHandler = async (req, res, userName) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const channel = url.searchParams.get("channel");
    if (!channel) {
      return sendError(res, 400, "Missing 'channel' query parameter");
    }
    if (!isChannelMember(channel, userName!)) {
      return sendError(res, 403, `You are not a member of ${channel}`);
    }
    const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 1), 200);
    const messages = dbGetChannelMessages(channel, limit);
    sendJson(res, 200, { messages });
  };

  const handleAdminChannelCreate: RouteHandler = async (req, res, userName) => {
    const body = JSON.parse(await readBody(req)) as { name?: string; description?: unknown };
    if (!body.name || typeof body.name !== "string") {
      return sendError(res, 400, "Missing or invalid 'name' field");
    }
    const parsed = parseDescription(body.description);
    if ("error" in parsed) return sendError(res, 400, parsed.error);
    const channelName = body.name.startsWith("#") ? body.name : `#${body.name}`;
    if (dbGetChannel(channelName)) {
      return sendError(res, 409, `Channel "${channelName}" already exists`);
    }
    try {
      dbCreateChannel(channelName, userName!, parsed.description);
      ensureChannelMembership(channelName);
      broadcast({ type: "channel_create", name: channelName, timestamp: Date.now() });
      console.log(`[admin-channel-create] ${channelName}`);
      sendJson(res, 200, { ok: true, channel: channelName });
    } catch (e) {
      sendError(res, 500, (e as Error).message);
    }
  };

  const handleAdminChannelDescribe: RouteHandler = async (req, res, userName) => {
    const body = JSON.parse(await readBody(req)) as { name?: string; description?: unknown };
    if (!body.name || typeof body.name !== "string") {
      return sendError(res, 400, "Missing or invalid 'name' field");
    }
    const parsed = parseDescription(body.description);
    if ("error" in parsed) return sendError(res, 400, parsed.error);
    if (!dbSetChannelDescription(body.name, parsed.description)) {
      return sendError(res, 404, `Channel "${body.name}" not found`);
    }
    broadcast({
      type: "channel_update",
      name: body.name,
      description: parsed.description,
      by: userName!,
      timestamp: Date.now(),
    });
    console.log(`[admin-channel-describe] ${body.name} by ${userName}`);
    sendJson(res, 200, { ok: true, channel: body.name, description: parsed.description });
  };

  const handleAdminChannelHistory: RouteHandler = async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const channel = url.searchParams.get("channel");
    const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") ?? "200", 10) || 200, 1), 500);
    const beforeTs = parseInt(url.searchParams.get("before") ?? "", 10);
    const beforeSeq = parseInt(url.searchParams.get("beforeSeq") ?? "", 10);
    const before = beforeTs ? { timestamp: beforeTs, seq: beforeSeq || undefined } : undefined;
    if (channel) {
      const messages = dbGetChannelMessages(channel, limit, before);
      sendJson(res, 200, { messages });
    } else {
      const messages = dbGetRecentMessages(limit);
      sendJson(res, 200, { messages });
    }
  };

  const handleAdminChannelDelete: RouteHandler = async (req, res) => {
    const body = JSON.parse(await readBody(req)) as { name?: string };
    if (!body.name || typeof body.name !== "string") {
      return sendError(res, 400, "Missing or invalid 'name' field");
    }
    if (body.name === "#all") {
      return sendError(res, 400, "Cannot delete #all");
    }
    if (!dbGetChannel(body.name)) {
      return sendError(res, 404, `Channel "${body.name}" not found`);
    }
    dbDeleteChannel(body.name);
    dbDeleteChannelMessages(body.name);
    dbDeleteReadCursorsForChannel(body.name);
    removeChannel(body.name);
    broadcast({ type: "channel_delete", name: body.name, timestamp: Date.now() });
    console.log(`[admin-channel-delete] ${body.name}`);
    sendJson(res, 200, { ok: true, channel: body.name });
  };

  const handleAdminMarkRead: RouteHandler = async (req, res, userName) => {
    const body = JSON.parse(await readBody(req)) as { channel?: string; timestamp?: number };
    if (!body.channel || typeof body.channel !== "string") {
      return sendError(res, 400, "Missing or invalid 'channel' field");
    }
    const ts = body.timestamp ?? Date.now();
    dbUpdateReadCursor(userName!, body.channel, ts);
    broadcast({ type: "read_update", userName: userName!, channel: body.channel, timestamp: ts });
    sendJson(res, 200, { ok: true });
  };

  const handleAdminUnreadCounts: RouteHandler = async (_req, res, userName) => {
    const counts = dbGetUnreadCounts(userName!);
    sendJson(res, 200, { counts });
  };

  // Agent config endpoints
  const handleAdminAgentConfigs: RouteHandler = async (_req, res) => {
    const configs = dbListAgentConfigs();
    const result = configs.map((c) => ({
      id: c.id,
      name: c.name,
      workDir: c.work_dir,
      command: c.command,
      autoStart: c.auto_start === 1,
      envVars: c.env_vars ? JSON.parse(c.env_vars) : {},
      createdAt: c.created_at,
      online: isUserRegistered(c.name) && isOnline(c.name),
    }));
    sendJson(res, 200, { configs: result });
  };

  const handleAdminAgentConfigCreate: RouteHandler = async (req, res) => {
    const body = JSON.parse(await readBody(req)) as {
      name?: string;
      workDir?: string;
      command?: string;
      autoStart?: boolean;
      envVars?: Record<string, string>;
    };
    if (!body.name || typeof body.name !== "string") {
      return sendError(res, 400, "Missing or invalid 'name' field");
    }
    if (!AGENT_NAME_RE.test(body.name)) {
      return sendError(res, 400, "Agent name must contain only a-z, 0-9, hyphen, underscore");
    }
    if (!body.workDir || typeof body.workDir !== "string") {
      return sendError(res, 400, "Missing or invalid 'workDir' field");
    }
    try {
      const id = randomUUID();
      const config = dbCreateAgentConfig(
        id,
        body.name,
        body.workDir,
        body.command || "",
        body.autoStart ?? false,
        body.envVars,
      );
      broadcast({ type: "agent_config_create", id: config.id, name: config.name, timestamp: Date.now() });
      console.log(`[agent-config-create] ${config.name}`);
      sendJson(res, 200, { ok: true, id: config.id });
    } catch (e) {
      sendError(res, 409, (e as Error).message);
    }
  };

  const handleAdminAgentConfigUpdate: RouteHandler = async (req, res) => {
    const body = JSON.parse(await readBody(req)) as {
      id?: string;
      name?: string;
      workDir?: string;
      autoStart?: boolean;
      envVars?: Record<string, string> | null;
    };
    if (!body.id || typeof body.id !== "string") {
      return sendError(res, 400, "Missing or invalid 'id' field");
    }
    if (body.name && !AGENT_NAME_RE.test(body.name)) {
      return sendError(res, 400, "Agent name must contain only a-z, 0-9, hyphen, underscore");
    }
    const config = dbGetAgentConfig(body.id);
    if (!config) {
      return sendError(res, 404, "Agent config not found");
    }
    if (isUserRegistered(config.name)) {
      return sendError(res, 409, "Agent is currently online. Kick it first.");
    }
    dbUpdateAgentConfig(body.id, {
      name: body.name,
      workDir: body.workDir,
      autoStart: body.autoStart,
      envVars: body.envVars,
    });
    const name = body.name ?? config.name;
    broadcast({ type: "agent_config_update", id: body.id, name, timestamp: Date.now() });
    console.log(`[agent-config-update] ${name}`);
    sendJson(res, 200, { ok: true });
  };

  const handleAdminAgentConfigDelete: RouteHandler = async (req, res) => {
    const body = JSON.parse(await readBody(req)) as { id?: string };
    if (!body.id || typeof body.id !== "string") {
      return sendError(res, 400, "Missing or invalid 'id' field");
    }
    const configToDelete = dbGetAgentConfig(body.id);
    if (!configToDelete) {
      return sendError(res, 404, "Agent config not found");
    }
    if (isUserRegistered(configToDelete.name)) {
      return sendError(res, 409, "Agent is currently online. Kick it first.");
    }
    if (!dbDeleteAgentConfig(body.id)) {
      return sendError(res, 404, "Agent config not found");
    }
    broadcast({ type: "agent_config_delete", id: body.id, timestamp: Date.now() });
    console.log(`[agent-config-delete] ${body.id}`);
    sendJson(res, 200, { ok: true });
  };

  const handleAdminAgentStart: RouteHandler = async (req, res) => {
    const body = JSON.parse(await readBody(req)) as { id?: string };
    if (!body.id || typeof body.id !== "string") {
      return sendError(res, 400, "Missing or invalid 'id' field");
    }
    const config = dbGetAgentConfig(body.id);
    if (!config) {
      return sendError(res, 404, "Agent config not found");
    }
    try {
      await launchAgent(config);
      sendJson(res, 200, { ok: true });
    } catch (e) {
      sendError(res, 500, (e as Error).message);
    }
  };

  const publicRoutes: RouteTable = {
    "/users": { method: "GET", handler: handleUsers },
    "/channels": { method: "GET", handler: handleListChannels },
  };

  const joinRoutes: RouteTable = {
    "/register": { method: "POST", handler: handleRegister },
  };

  const adminRoutes: RouteTable = {
    "/admin-login": { method: "POST", handler: handleAdminLogin },
    "/kick": { method: "POST", handler: handleKick },
    "/kick-all": { method: "POST", handler: handleKickAll },
    "/admin-send": { method: "POST", handler: handleAdminSend },
    "/admin-channel-create": { method: "POST", handler: handleAdminChannelCreate },
    "/admin-channel-delete": { method: "POST", handler: handleAdminChannelDelete },
    "/admin-channel-describe": { method: "POST", handler: handleAdminChannelDescribe },
    "/admin-channel-history": { method: "GET", handler: handleAdminChannelHistory },
    "/admin-mark-read": { method: "POST", handler: handleAdminMarkRead },
    "/admin-unread-counts": { method: "GET", handler: handleAdminUnreadCounts },
    "/admin-agent-configs": { method: "GET", handler: handleAdminAgentConfigs },
    "/admin-agent-config-create": { method: "POST", handler: handleAdminAgentConfigCreate },
    "/admin-agent-config-update": { method: "POST", handler: handleAdminAgentConfigUpdate },
    "/admin-agent-config-delete": { method: "POST", handler: handleAdminAgentConfigDelete },
    "/admin-agent-start": { method: "POST", handler: handleAdminAgentStart },
  };

  const protectedRoutes: RouteTable = {
    "/send": { method: "POST", handler: handleSend },
    "/poll": { method: "GET", handler: handlePoll },
    "/inbox": { method: "GET", handler: handleInbox },
    "/unregister": { method: "POST", handler: handleUnregister },
    "/channel-create": { method: "POST", handler: handleChannelCreate },
    "/channel-join": { method: "POST", handler: handleChannelJoin },
    "/channel-leave": { method: "POST", handler: handleChannelLeave },
    "/channel-invite": { method: "POST", handler: handleChannelInvite },
    "/channel-history": { method: "GET", handler: handleChannelHistory },
  };

  const STALE_GRACE_MS = 30_000; // 30 seconds before auto-unregister
  // Agents not waiting in a poll and silent for this long are assumed gone (busy agents make no
  // requests while they work, so this is long)
  const IDLE_EXPIRY_MS = 24 * 3_600_000;
  const IDLE_CHECK_INTERVAL_MS = 10 * 60_000;
  const staleTimers = new Map<string, ReturnType<typeof setTimeout>>();
  // When each pending stale removal fires, to tell a rejoining agent how long to wait
  const staleDeadlines = new Map<string, number>();
  // Last authenticated request per agent/bridge
  const lastSeen = new Map<string, number>();

  function removeStaleUser(userName: string, reason: string): void {
    const role = getUserRole(userName);
    removePoll(userName);
    removeQueue(userName);
    setOffline(userName);
    unregisterUser(userName);
    lastSeen.delete(userName);
    broadcast({ type: "leave", name: userName, timestamp: Date.now() });
    if (role === "agent") {
      notifyBridges(`USER_LEFT: ${userName}`);
    }
    console.log(`[auto-unregister] ${userName} (${reason})`);
  }

  /** Explains to an agent trying to register `name` why it can't, and what to do about it. */
  function nameTakenMessage(name: string): string {
    const taken = `User "${name}" is already registered`;
    if (getUserRole(name) === "human") return `${taken} by a human on the dashboard. Choose another name.`;
    const deadline = staleDeadlines.get(name);
    if (!isOnline(name) && deadline) {
      const seconds = Math.max(1, Math.ceil((deadline - Date.now()) / 1000));
      return `${taken}, but its previous session lost its connection. The name is released in ${seconds} s; try again then.`;
    }
    if (!isOnline(name)) {
      return `${taken}, but not connected. A human can kick it from the dashboard; otherwise the name is released after 24 h of inactivity.`;
    }
    return `${taken} and active. Choose another name, or ask a human to kick the existing session from the dashboard.`;
  }

  /** Unregister agents/bridges that aren't polling and haven't made a request for IDLE_EXPIRY_MS. */
  function expireIdleSessions(now = Date.now()): string[] {
    const expired: string[] = [];
    for (const name of getRegisteredUsers()) {
      if (getUserRole(name) === "human" || hasPendingPoll(name)) continue;
      if (now - (lastSeen.get(name) ?? now) >= IDLE_EXPIRY_MS) {
        removeStaleUser(name, "idle");
        expired.push(name);
      }
    }
    return expired;
  }

  /** Unregister `userName` unless it polls again (= comes back online) within `graceMs`. */
  function scheduleStaleRemoval(userName: string, graceMs: number): void {
    const existing = staleTimers.get(userName);
    if (existing) clearTimeout(existing);
    staleDeadlines.set(userName, Date.now() + graceMs);

    staleTimers.set(
      userName,
      setTimeout(() => {
        staleTimers.delete(userName);
        staleDeadlines.delete(userName);
        if (isUserRegistered(userName) && !isOnline(userName)) {
          removeStaleUser(userName, "stale");
        }
      }, graceMs),
    );
  }

  /**
   * Bring back agent/bridge sessions (and their undelivered messages) saved before the last
   * shutdown, so they can carry on with their old token. They start offline until they poll
   * again. Agents busy with a long task may not poll for a while, so only the idle expiry
   * removes them, as it would have without the restart.
   */
  function restoreSessions(): void {
    const pending = dbTakePendingMessages();
    for (const session of dbListSessions()) {
      if (isUserRegistered(session.name)) continue;
      restoreUser({
        name: session.name,
        token: session.token,
        role: session.role as UserRole,
        registeredAt: session.registered_at,
      });
      ensureQueue(session.name);
      setOffline(session.name);
      lastSeen.set(session.name, Date.now());
      for (const ch of new Set(["#all", ...dbGetUserChannels(session.name)])) {
        try {
          joinChannel(ch, session.name);
        } catch {
          /* channel may no longer exist */
        }
      }
      for (const message of pending.get(session.name) ?? []) {
        enqueueAndDeliver(session.name, message);
      }
      console.log(`[restore] ${session.name}`);
    }
  }

  /**
   * Tell agents and bridges the hub is going away, and end all open polls and dashboard streams.
   * "restart": sessions and undelivered messages are kept for the next start (RADIO_RESTART).
   * "stop": everyone is disconnected and sessions are dropped (RADIO_KILLED).
   */
  function prepareShutdown(mode: "restart" | "stop"): void {
    const content =
      mode === "restart"
        ? "RADIO_RESTART: The hub is restarting and should be back within a few seconds. You stay on the air with your current session: keep calling radio_standby, and if it fails, wait a few seconds and try again. Do not call radio_join or radio_out. If the hub is still unreachable after a few minutes, stop and tell the user."
        : "RADIO_KILLED: Hub is shutting down.";
    for (const name of getRegisteredUsers()) {
      if (getUserRole(name) === "human") continue;
      ensureQueue(name);
      enqueueAndDeliver(name, {
        id: randomUUID(),
        from: "system",
        to: name,
        content,
        channel: "#all",
        timestamp: Date.now(),
      });
    }
    if (mode === "restart") {
      // Keep what agents haven't picked up yet, except the restart notice itself
      for (const [name, messages] of getAllQueues()) {
        const keep = messages.filter((m) => !(m.from === "system" && m.content.startsWith("RADIO_RESTART:")));
        if (keep.length > 0 && getUserRole(name) !== "human") dbSavePendingMessages(name, keep);
      }
    } else {
      dbDeleteAllSessions();
    }
    closeAllPolls();
    project.events.closeAllSSEClients();
  }

  /** The dashboard's live stream; its human is online while it is open. */
  function handleEvents(url: URL, res: ServerResponse): void {
    const humanName = streamHuman(url, res, adminToken, ensureHuman);
    if (!humanName) return;
    addSSEClient(res, () => disconnectHuman(humanName));
    connectHuman(humanName);
  }

  /** Handles `path` (relative to the project) if it is one of the project's API routes. */
  function dispatch(req: IncomingMessage, res: ServerResponse, url: URL, path: string): boolean {
    if (path === "/events" && req.method === "GET") {
      handleEvents(url, res);
      return true;
    }

    const publicRoute = publicRoutes[path];
    if (publicRoute) {
      if (checkMethod(publicRoute, req, res)) runRoute(publicRoute, req, res);
      return true;
    }

    // Join routes (require join token)
    const joinRoute = joinRoutes[path];
    if (joinRoute) {
      if (!checkMethod(joinRoute, req, res)) return true;
      if (!authenticateBearer(req, joinToken)) {
        sendError(res, 401, "Join token required");
        return true;
      }
      runRoute(joinRoute, req, res);
      return true;
    }

    // Admin routes (require admin token)
    const adminRoute = adminRoutes[path];
    if (adminRoute) {
      if (!checkMethod(adminRoute, req, res)) return true;
      if (!authenticateBearer(req, adminToken)) {
        sendError(res, 401, "Admin token required");
        return true;
      }
      // The dashboard identifies which human is acting; plain admin-token callers act as "operator"
      const caller = adminCaller(req);
      const callerError = ensureHuman(caller);
      if (callerError) {
        sendError(res, callerError.status, callerError.error);
        return true;
      }
      runRoute(adminRoute, req, res, caller);
      return true;
    }

    // User-protected routes (require user token)
    const protectedRoute = protectedRoutes[path];
    if (protectedRoute) {
      if (!checkMethod(protectedRoute, req, res)) return true;
      const userName = authenticateRequest(req);
      if (!userName) {
        sendError(res, 401, "Unauthorized");
        return true;
      }
      // Any authenticated request proves the agent is alive
      lastSeen.set(userName, Date.now());
      if (!isOnline(userName)) {
        setOnline(userName);
        broadcast({ type: "status", name: userName, online: true, timestamp: Date.now() });
      }
      runRoute(protectedRoute, req, res, userName);
      return true;
    }
    return false;
  }

  // When a poll connection drops unexpectedly, mark user offline and start grace timer
  onPollDisconnect((userName) => {
    if (!isUserRegistered(userName)) return;
    setOffline(userName);
    broadcast({ type: "status", name: userName, online: false, timestamp: Date.now() });
    console.log(`[offline] ${project.name}/${userName} (grace period ${STALE_GRACE_MS / 1000}s)`);
    scheduleStaleRemoval(userName, STALE_GRACE_MS);
  });

  restoreSessions();
  const idleTimer = setInterval(() => expireIdleSessions(), IDLE_CHECK_INTERVAL_MS);
  idleTimer.unref();

  /** Stop the project's timers, end its dashboard streams and close its database (agents: see prepareShutdown). */
  function close(): void {
    clearInterval(idleTimer);
    for (const timer of staleTimers.values()) clearTimeout(timer);
    staleTimers.clear();
    project.events.closeAllSSEClients();
    project.db.close();
  }

  return {
    project,
    dispatch,
    ensureHuman,
    connectHuman,
    disconnectHuman,
    expireIdleSessions,
    prepareShutdown,
    close,
  };
}

type ProjectApp = ReturnType<typeof createProjectApp>;

/** The caller named in a dashboard request's X-Walkie-User header, or "operator". */
function adminCaller(req: IncomingMessage): string {
  const header = req.headers["x-walkie-user"];
  return (typeof header === "string" && header.trim()) || DEFAULT_HUMAN;
}

/** Events on the hub-wide stream that the dashboard's project tabs listen to. */
type HubWideEvent =
  | { type: "project_create"; name: string; timestamp: number }
  | { type: "project_archive"; name: string; timestamp: number }
  | { type: "activity"; project: string; channel: string; from: string; timestamp: number }
  | { type: "read"; project: string; userName: string; channel: string; timestamp: number };

export interface HubOptions {
  /** Database of the default project (default: $WALKIE_TALKIE_DB_PATH or ./walkie-talkie.db). */
  dbPath?: string;
  /**
   * Name of the default project, which a plain HUB_URL (no /p/<project>) reaches; null for a hub
   * without one (default: $WALKIE_TALKIE_DEFAULT_PROJECT, where "none" means null, or "default").
   */
  defaultProject?: string | null;
  /** Folder holding the other projects' databases; null keeps new projects in memory. */
  projectsDir?: string | null;
}

/** A running hub: its HTTP server plus the operations that span all projects. */
export interface Hub {
  server: Server;
  /**
   * Tell agents and bridges in every project that the hub is going away, end all polls and live
   * streams, and drop new requests so the server can close.
   * "restart": sessions and undelivered messages are kept for the next start (RADIO_RESTART).
   * "stop": everyone is disconnected and sessions are dropped (RADIO_KILLED).
   */
  shutdown(mode: "restart" | "stop"): void;
  /** Unregister idle agents in every project; returns their names. */
  expireIdleSessions(now?: number): string[];
  /** Saved agent launch configs of every project. */
  agentConfigs(): AgentConfigRow[];
}

export function createHubServer(
  port: number,
  adminToken: string,
  joinToken: string,
  host = "127.0.0.1",
  options: HubOptions = {},
): Hub {
  const dbPath = options.dbPath ?? process.env.WALKIE_TALKIE_DB_PATH ?? path.join(process.cwd(), "walkie-talkie.db");
  const projectsDir =
    options.projectsDir !== undefined
      ? options.projectsDir
      : (process.env.WALKIE_TALKIE_PROJECTS_DIR ??
        (dbPath === ":memory:" ? null : path.join(path.dirname(dbPath), "projects")));
  if (projectsDir) fs.mkdirSync(projectsDir, { recursive: true });
  const envDefault = process.env.WALKIE_TALKIE_DEFAULT_PROJECT || DEFAULT_PROJECT;
  const defaultName =
    options.defaultProject !== undefined
      ? options.defaultProject
      : envDefault === NO_DEFAULT_PROJECT
        ? null
        : envDefault;
  const invalidDefault = defaultName === null ? null : validateProjectName(defaultName);
  if (invalidDefault) throw new Error(`WALKIE_TALKIE_DEFAULT_PROJECT: ${invalidDefault}`);

  const apps = new Map<string, ProjectApp>();
  const events = createEventStream<HubWideEvent>();
  // Each hub-wide stream makes its human present in every project (where the name is free)
  const hubPresences = new Set<{ name: string; apps: Set<ProjectApp> }>();
  function attachPresence(presence: { name: string; apps: Set<ProjectApp> }, app: ProjectApp): void {
    if (app.ensureHuman(presence.name)) return; // the name belongs to an agent in that project
    app.connectHuman(presence.name);
    presence.apps.add(app);
  }
  let shuttingDown = false;

  function openProject(name: string, file: string): ProjectApp {
    const app = createProjectApp(createProject(name, file), adminToken, joinToken);
    app.project.events.subscribe((ev) => {
      if (ev.type === "message") {
        events.broadcast({
          type: "activity",
          project: name,
          channel: ev.channel,
          from: ev.from,
          timestamp: ev.timestamp,
        });
      } else if (ev.type === "read_update") {
        events.broadcast({
          type: "read",
          project: name,
          userName: ev.userName,
          channel: ev.channel,
          timestamp: ev.timestamp,
        });
      }
    });
    apps.set(name, app);
    for (const presence of hubPresences) attachPresence(presence, app);
    console.log(`[project] ${name} (${file})`);
    return app;
  }

  const defaultApp = defaultName === null ? null : openProject(defaultName, dbPath);
  if (projectsDir) {
    for (const name of listProjectNames(projectsDir)) {
      if (name === defaultName) {
        console.error(`[project] skipping ${projectDbPath(projectsDir, name)}: "${name}" is the default project`);
        continue;
      }
      openProject(name, projectDbPath(projectsDir, name));
    }
  }

  /** The default project first, then the others by name. */
  function listProjects() {
    const names = [...apps.keys()].filter((n) => n !== defaultName).sort((a, b) => a.localeCompare(b));
    return [...(defaultApp ? [defaultName as string] : []), ...names].map((name) => ({
      name,
      default: name === defaultName,
    }));
  }

  async function handleProjectCreate(req: IncomingMessage, res: ServerResponse, caller?: string): Promise<void> {
    const body = JSON.parse((await readBody(req)) || "{}") as { name?: unknown };
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const invalid = validateProjectName(name);
    if (invalid) return sendError(res, 400, invalid);
    if (apps.has(name)) return sendError(res, 409, `Project "${name}" already exists`);
    openProject(name, projectsDir ? projectDbPath(projectsDir, name) : ":memory:");
    events.broadcast({ type: "project_create", name, timestamp: Date.now() });
    console.log(`[project-create] ${name} by ${caller}`);
    sendJson(res, 200, { ok: true, project: name });
  }

  async function handleProjectArchive(req: IncomingMessage, res: ServerResponse, caller?: string): Promise<void> {
    const body = JSON.parse((await readBody(req)) || "{}") as { name?: unknown };
    const name = typeof body.name === "string" ? body.name : "";
    if (name === defaultName) return sendError(res, 400, "The default project can't be archived");
    const app = apps.get(name);
    if (!app) return sendError(res, 404, `Project "${name}" not found`);
    apps.delete(name);
    for (const presence of hubPresences) presence.apps.delete(app);
    app.prepareShutdown("stop");
    app.close();
    const archivedAs = projectsDir ? archiveProjectFiles(projectsDir, name) : null;
    events.broadcast({ type: "project_archive", name, timestamp: Date.now() });
    console.log(`[project-archive] ${name} by ${caller}${archivedAs ? ` -> ${archivedAs}` : ""}`);
    sendJson(res, 200, { ok: true, project: name, archivedAs });
  }

  function handleHubEvents(url: URL, res: ServerResponse) {
    const name = streamHuman(url, res, adminToken, defaultApp ? defaultApp.ensureHuman : humanNameError);
    if (!name) return;
    const presence = { name, apps: new Set<ProjectApp>() };
    for (const app of apps.values()) attachPresence(presence, app);
    hubPresences.add(presence);
    events.addSSEClient(res, () => {
      hubPresences.delete(presence);
      for (const app of presence.apps) app.disconnectHuman(name);
    });
  }

  /** Routes that concern the hub as a whole rather than one project (admin token). */
  const hubRoutes: RouteTable = {
    "/projects": { method: "GET", handler: async (_req, res) => sendJson(res, 200, { projects: listProjects() }) },
    "/admin-project-create": { method: "POST", handler: handleProjectCreate },
    "/admin-project-archive": { method: "POST", handler: handleProjectArchive },
  };
  // The project tabs page logs in here; with a default project, that project checks the name
  if (!defaultApp) {
    hubRoutes["/admin-login"] = {
      method: "POST",
      handler: async (_req, res, caller = DEFAULT_HUMAN) => {
        const invalid = humanNameError(caller);
        if (invalid) return sendError(res, invalid.status, invalid.error);
        sendJson(res, 200, { ok: true, name: caller });
      },
    };
  }

  function dispatchHub(req: IncomingMessage, res: ServerResponse, url: URL): boolean {
    if (url.pathname === "/hub-events" && req.method === "GET") {
      handleHubEvents(url, res);
      return true;
    }
    const route = hubRoutes[url.pathname];
    if (!route) return false;
    if (!checkMethod(route, req, res)) return true;
    if (!authenticateBearer(req, adminToken)) {
      sendError(res, 401, "Admin token required");
      return true;
    }
    runRoute(route, req, res, adminCaller(req));
    return true;
  }

  function handleRequest(req: IncomingMessage, res: ServerResponse) {
    if (shuttingDown) {
      req.socket.destroy();
      return;
    }
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    // /p/<project>/<route> is that project; anything else is the default project, if there is one
    const prefixed = /^\/p\/([^/]+)(\/.*)?$/.exec(url.pathname);
    if (prefixed) {
      const name = decodeURIComponent(prefixed[1]);
      const app = apps.get(name);
      if (!app) return sendError(res, 404, `No such project "${name}"`);
      const route = prefixed[2];
      if (route === undefined) {
        res.writeHead(301, { Location: `/p/${encodeURIComponent(name)}/${url.search}` });
        res.end();
        return;
      }
      if (route === "/" && req.method === "GET") return sendHtml(res, getDashboardHTML());
      if (!app.dispatch(req, res, url, route)) sendError(res, 404, "Not found");
      return;
    }

    if (url.pathname === "/" && req.method === "GET") return sendHtml(res, getShellHTML());
    if (dispatchHub(req, res, url)) return;
    if (!defaultApp) {
      return sendError(
        res,
        404,
        "This hub has no default project: use /p/<project>/, e.g. HUB_URL=http://<hub>/p/<project>",
      );
    }
    if (!defaultApp.dispatch(req, res, url, url.pathname)) sendError(res, 404, "Not found");
  }

  const server = createServer(handleRequest);
  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(`Error: Port ${port} is already in use. Is another Hub instance running?`);
      process.exit(1);
    }
    throw err;
  });
  server.on("close", () => {
    for (const app of apps.values()) app.close();
  });
  server.listen(port, host, () => {
    console.log(`Walkie-Talkie Hub listening on http://${host}:${port}`);
  });

  return {
    server,
    shutdown(mode) {
      // From now on new requests are dropped (see handleRequest), so agents re-polling right after
      // their poll ends can't keep the server from closing; they reconnect once the hub is back
      shuttingDown = true;
      for (const app of apps.values()) app.prepareShutdown(mode);
      events.closeAllSSEClients();
    },
    expireIdleSessions: (now = Date.now()) => [...apps.values()].flatMap((app) => app.expireIdleSessions(now)),
    agentConfigs: () => [...apps.values()].flatMap((app) => app.project.db.dbListAgentConfigs()),
  };
}

function sendHtml(res: ServerResponse, html: string): void {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}
