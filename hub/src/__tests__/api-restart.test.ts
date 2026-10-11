import fs from "node:fs";
import type { Server } from "node:http";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetAuthState } from "../auth.js";
import { initGeneralChannel, resetChannelState } from "../channels.js";
import { initDB } from "../db.js";
import { resetQueues } from "../router.js";
import { createHubServer, prepareShutdown } from "../server.js";

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

  it("forgets unregistered agents", async () => {
    let base = await startHub();
    const alice = await register(base, "alice");
    await call(base, alice, "/unregister", {});
    await stopHub("restart");
    base = await startHub();
    expect((await call(base, alice, "/poll?timeout=1")).status).toBe(401);
  });
});
