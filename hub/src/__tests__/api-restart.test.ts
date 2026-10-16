import fs from "node:fs";
import type { Server } from "node:http";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetAuthState } from "../auth.js";
import { initGeneralChannel, resetChannelState } from "../channels.js";
import { initDB } from "../db.js";
import { resetQueues } from "../router.js";
import { createHubServer, expireIdleSessions, prepareShutdown } from "../server.js";

const JOIN = "join";
const ADMIN = "admin";
let dir: string;
let server: Server | null = null;

// Simulates a hub process start: fresh in-memory state, same database file
async function startHub(): Promise<string> {
  resetAuthState();
  resetChannelState();
  resetQueues();
  initDB();
  initGeneralChannel();
  server = createHubServer(0, ADMIN, JOIN);
  await new Promise<void>((resolve) => server!.on("listening", resolve));
  const addr = server.address();
  return `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
}

async function stopHub(mode: "restart" | "stop"): Promise<void> {
  prepareShutdown(mode);
  await new Promise<void>((resolve) => server!.close(() => resolve()));
  server = null;
}

async function register(base: string, name: string): Promise<string> {
  const res = await fetch(`${base}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${JOIN}` },
    body: JSON.stringify({ name }),
  });
  return ((await res.json()) as { token: string }).token;
}

async function call(base: string, token: string, route: string, body?: unknown): Promise<Response> {
  return fetch(`${base}${route}`, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "walkie-restart-"));
  process.env.WALKIE_TALKIE_DB_PATH = path.join(dir, "hub.db");
});

afterEach(async () => {
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  server = null;
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("hub restart", () => {
  it("keeps sessions, channels and undelivered messages across a restart", async () => {
    let base = await startHub();
    const alice = await register(base, "alice");
    const bob = await register(base, "bob");
    await call(base, alice, "/channel-create", { name: "#proj" });
    await call(base, bob, "/send", { to: "@alice", content: "queued before restart" });

    // A waiting poll gets the restart notice
    const waiting = call(base, bob, "/poll?timeout=10");
    await new Promise((r) => setTimeout(r, 50));
    await stopHub("restart");
    const notice = (await (await waiting).json()) as { messages: { from: string; content: string }[] };
    expect(notice.messages[0].from).toBe("system");
    expect(notice.messages[0].content).toMatch(/^RADIO_RESTART:/);

    base = await startHub();
    // Old tokens still work, and the queued message (but not the notice) is delivered
    const res = await call(base, alice, "/poll?timeout=1");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { messages: { content: string }[] };
    expect(body.messages.map((m) => m.content)).toEqual(["queued before restart"]);
    expect((await call(base, alice, "/send", { to: "@all", content: "back", channel: "#proj" })).status).toBe(200);
    const channels = (await (await fetch(`${base}/channels`)).json()) as {
      channels: { name: string; members: string[] }[];
    };
    expect(channels.channels.find((c) => c.name === "#proj")?.members).toEqual(["alice"]);

    const users = (await (await fetch(`${base}/users`)).json()) as { users: { name: string }[] };
    expect(users.users.map((u) => u.name).sort()).toEqual(["alice", "bob"]);
  });

  it("drops sessions when the hub is stopped for good", async () => {
    let base = await startHub();
    const alice = await register(base, "alice");
    const waiting = call(base, alice, "/poll?timeout=10");
    await new Promise((r) => setTimeout(r, 50));
    await stopHub("stop");
    const notice = (await (await waiting).json()) as { messages: { content: string }[] };
    expect(notice.messages[0].content).toMatch(/^RADIO_KILLED:/);

    base = await startHub();
    expect((await call(base, alice, "/poll?timeout=1")).status).toBe(401);
    expect(await register(base, "alice")).toBeTruthy();
  });

  it("keeps agents that are busy (not polling) across a restart until they're idle for 24 h", async () => {
    let base = await startHub();
    const alice = await register(base, "alice");
    const bob = await register(base, "bob");
    await stopHub("restart");
    base = await startHub();

    // alice is mid-task: no poll and no countdown to removal, and messages to her are queued
    const res = await fetch(`${base}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${JOIN}` },
      body: JSON.stringify({ name: "alice" }),
    });
    expect(((await res.json()) as { error: string }).error).toMatch(/already registered, but not connected/);
    expect((await call(base, bob, "/send", { to: "@alice", content: "while you were busy" })).status).toBe(200);
    expect(expireIdleSessions(Date.now() + 23 * 3_600_000)).toEqual([]);

    const body = (await (await call(base, alice, "/poll?timeout=1")).json()) as { messages: { content: string }[] };
    expect(body.messages.map((m) => m.content)).toEqual(["while you were busy"]);
    expect(expireIdleSessions(Date.now() + 25 * 3_600_000).sort()).toEqual(["alice", "bob"]);
  });

  it("forgets unregistered agents", async () => {
    let base = await startHub();
    const alice = await register(base, "alice");
    await call(base, alice, "/unregister", {});
    await stopHub("restart");
    base = await startHub();
    expect((await call(base, alice, "/poll?timeout=1")).status).toBe(401);
  });
});

describe("shutdown and idle sessions", () => {
  it("drops new requests once shutdown has started, so the server can close", async () => {
    const base = await startHub();
    const alice = await register(base, "alice");
    prepareShutdown("restart");
    await expect(call(base, alice, "/poll?timeout=10")).rejects.toThrow();
  });

  it("expires agents that are idle and not polling, but not polling ones", async () => {
    const base = await startHub();
    const alice = await register(base, "alice");
    const bob = await register(base, "bob");
    const waiting = call(base, bob, "/poll?timeout=5");
    await new Promise((r) => setTimeout(r, 50));
    expect(expireIdleSessions(Date.now() + 23 * 3_600_000)).toEqual([]);
    expect(expireIdleSessions(Date.now() + 25 * 3_600_000)).toEqual(["alice"]);
    expect((await call(base, alice, "/poll?timeout=1")).status).toBe(401);
    await stopHub("restart");
    await waiting;
  });
});

describe("name already registered", () => {
  async function registerError(base: string, name: string): Promise<{ status: number; error: string }> {
    const res = await fetch(`${base}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${JOIN}` },
      body: JSON.stringify({ name }),
    });
    return { status: res.status, error: ((await res.json()) as { error: string }).error };
  }

  it("says what to do, depending on the existing session", async () => {
    const base = await startHub();
    const alice = await register(base, "alice");
    const active = await registerError(base, "alice");
    expect(active.status).toBe(409);
    expect(active.error).toMatch(/already registered and active\. Choose another name/);

    // The poll connection drops (e.g. the agent's MCP server was restarted)
    const ac = new AbortController();
    const poll = fetch(`${base}/poll?timeout=10`, {
      headers: { Authorization: `Bearer ${alice}` },
      signal: ac.signal,
    }).catch(() => null);
    await new Promise((r) => setTimeout(r, 50));
    ac.abort();
    await poll;
    await new Promise((r) => setTimeout(r, 100));
    const dropped = await registerError(base, "alice");
    expect(dropped.status).toBe(409);
    expect(dropped.error).toMatch(/lost its connection\. The name is released in (30|29|28) s; try again then\./);
  });
});
