import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { startTestServer, stopTestServer, type TestContext } from "./helpers/server-harness.js";

let dir: string;
let ctx: TestContext;

type Polled = { messages: { from: string; content: string; channel: string; fromRole?: string }[] };

async function register(name: string, oldToken?: string): Promise<string> {
  const res = await fetch(`${ctx.baseUrl}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ctx.joinToken}` },
    body: JSON.stringify({ name, oldToken }),
  });
  expect(res.status).toBe(200);
  return ((await res.json()) as { token: string }).token;
}

async function call(token: string, route: string, body?: unknown): Promise<Response> {
  return fetch(`${ctx.baseUrl}${route}`, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function send(token: string, content: string, channel = "#all"): Promise<string> {
  const res = await call(token, "/send", { to: "@all", content, channel });
  expect(res.status).toBe(200);
  return ((await res.json()) as { id: string }).id;
}

async function poll(token: string): Promise<Polled["messages"]> {
  const res = await call(token, "/poll?timeout=1");
  return res.status === 204 ? [] : ((await res.json()) as Polled).messages;
}

/** The hub drops idle agents after 24 h; pretend that much time passed. */
function dropIdle(): string[] {
  return ctx.hub.expireIdleSessions(Date.now() + 25 * 3_600_000);
}

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "walkie-catchup-"));
  ctx = await startTestServer({ dbPath: path.join(dir, "hub.db"), projectsDir: path.join(dir, "projects") });
});

afterEach(async () => {
  await stopTestServer(ctx);
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("catching up after being dropped", () => {
  it("gives a rejoining agent the messages it missed, in its channels, after a note", async () => {
    const alice = await register("alice");
    const bob = await register("bob");
    expect((await call(alice, "/channel-create", { name: "#proj" })).status).toBe(200);
    expect((await call(bob, "/channel-join", { channel: "#proj" })).status).toBe(200);
    await send(alice, "alice before");
    await send(bob, "undelivered");
    expect(dropIdle().sort()).toEqual(["alice", "bob"]);

    const bob2 = await register("bob");
    await send(bob2, "in all");
    await send(bob2, "in proj", "#proj");
    const gone = await send(bob2, "taken back");
    expect((await call(bob2, "/message-retract", { id: gone, channel: "#all" })).status).toBe(200);
    await call(bob2, "/channel-create", { name: "#other" });
    await send(bob2, "not alice's channel", "#other");

    const alice2 = await register("alice");
    await send(alice2, "alice after");
    const messages = await poll(alice2);
    expect(messages[0].from).toBe("system");
    expect(messages[0].content).toMatch(/^CATCH_UP: .*3 messages sent meanwhile in #all, #proj/);
    expect(messages.slice(1).map((m) => [m.channel, m.content])).toEqual([
      ["#all", "undelivered"],
      ["#all", "in all"],
      ["#proj", "in proj"],
    ]);
    // Caught up once: nothing more on the next poll
    expect(await poll(alice2)).toEqual([]);
  });

  it("keeps a reconnecting agent's undelivered messages when it takes its session back", async () => {
    const alice = await register("alice");
    const bob = await register("bob");
    await send(bob, "waiting for you");
    const again = await register("alice", alice);
    const messages = await poll(again);
    expect(messages.map((m) => m.content)).toEqual([
      expect.stringMatching(/^CATCH_UP: .*1 messages/),
      "waiting for you",
    ]);
    expect(await poll(again)).toEqual([]);
    expect(bob).toBeTruthy();
  });

  it("delivers the newest 100 and says how many older ones were left out", async () => {
    await register("alice");
    const bob = await register("bob");
    dropIdle();
    const bob2 = await register("bob");
    for (let i = 1; i <= 105; i++) await send(bob2, `m${i}`);
    const messages = await poll(await register("alice"));
    expect(messages).toHaveLength(101);
    expect(messages[0].content).toMatch(/100 messages .* The 5 older ones are left out/);
    expect(messages[1].content).toBe("m6");
    expect(messages[100].content).toBe("m105");
    expect(bob).toBeTruthy();
  });

  it("starts fresh after signing off", async () => {
    const alice = await register("alice");
    const bob = await register("bob");
    await send(bob, "before sign-off");
    expect((await call(alice, "/unregister", {})).status).toBe(200);
    await send(bob, "while signed off");
    expect(await poll(await register("alice"))).toEqual([]);
  });

  it("sends nothing when nothing was missed", async () => {
    await register("alice");
    dropIdle();
    expect(await poll(await register("alice"))).toEqual([]);
  });
});

describe("channel history", () => {
  it("accepts a channel name without # and marks humans' messages", async () => {
    const alice = await register("alice");
    const page = await fetch(`${ctx.baseUrl}/admin-send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ctx.adminToken}`,
        "X-Walkie-User": "carol",
      },
      body: JSON.stringify({ to: "@all", content: "from a human" }),
    });
    expect(page.status).toBe(200);
    await send(alice, "from an agent");
    const res = await call(alice, "/channel-history?channel=all&limit=5");
    expect(res.status).toBe(200);
    const { messages } = (await res.json()) as Polled;
    expect(messages.map((m) => [m.content, m.fromRole])).toEqual([
      ["from a human", "human"],
      ["from an agent", "agent"],
    ]);
  });
});
