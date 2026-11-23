import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerUser, startTestServer, stopTestServer, type TestContext } from "./helpers/server-harness.js";

let ctx: TestContext;

beforeAll(async () => {
  ctx = await startTestServer();
});

afterAll(async () => {
  await stopTestServer(ctx);
});

describe("POST /channel-create", () => {
  it("should create a channel and auto-join creator", async () => {
    const token = await registerUser(ctx, "ch-creator");
    const res = await fetch(`${ctx.baseUrl}/channel-create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: "test-room" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; channel: string };
    expect(body.channel).toBe("#test-room");
  });

  it("should reject duplicate channel creation", async () => {
    const token = await registerUser(ctx, "ch-dup-creator");
    await fetch(`${ctx.baseUrl}/channel-create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: "dup-room" }),
    });
    const res = await fetch(`${ctx.baseUrl}/channel-create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: "dup-room" }),
    });
    expect(res.status).toBe(409);
  });
});

describe("POST /channel-join", () => {
  it("should join an existing channel", async () => {
    const creatorToken = await registerUser(ctx, "join-creator");
    await fetch(`${ctx.baseUrl}/channel-create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${creatorToken}`,
      },
      body: JSON.stringify({ name: "join-room" }),
    });

    const joinerToken = await registerUser(ctx, "join-joiner");
    const res = await fetch(`${ctx.baseUrl}/channel-join`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${joinerToken}`,
      },
      body: JSON.stringify({ channel: "#join-room" }),
    });
    expect(res.status).toBe(200);
  });

  it("should reject joining non-existent channel", async () => {
    const token = await registerUser(ctx, "join-fail");
    const res = await fetch(`${ctx.baseUrl}/channel-join`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ channel: "#nonexistent" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("POST /channel-leave", () => {
  it("should leave a channel", async () => {
    const token = await registerUser(ctx, "leave-user");
    await fetch(`${ctx.baseUrl}/channel-create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: "leave-room" }),
    });
    const res = await fetch(`${ctx.baseUrl}/channel-leave`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ channel: "#leave-room" }),
    });
    expect(res.status).toBe(200);
  });

  it("should reject leaving #all", async () => {
    const token = await registerUser(ctx, "leave-all");
    const res = await fetch(`${ctx.baseUrl}/channel-leave`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ channel: "#all" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /channel-invite", () => {
  it("should invite a user to a channel", async () => {
    const creatorToken = await registerUser(ctx, "inv-creator");
    await registerUser(ctx, "inv-target");
    await fetch(`${ctx.baseUrl}/channel-create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${creatorToken}`,
      },
      body: JSON.stringify({ name: "inv-room" }),
    });
    const res = await fetch(`${ctx.baseUrl}/channel-invite`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${creatorToken}`,
      },
      body: JSON.stringify({ channel: "#inv-room", user: "inv-target" }),
    });
    expect(res.status).toBe(200);
  });

  it("should reject inviting non-existent user", async () => {
    const token = await registerUser(ctx, "inv-nope-creator");
    await fetch(`${ctx.baseUrl}/channel-create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: "inv-nope-room" }),
    });
    const res = await fetch(`${ctx.baseUrl}/channel-invite`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ channel: "#inv-nope-room", user: "ghost" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("GET /channel-history", () => {
  it("should return channel history for members", async () => {
    const token = await registerUser(ctx, "hist-user");
    const res = await fetch(`${ctx.baseUrl}/channel-history?channel=${encodeURIComponent("#all")}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { messages: unknown[] };
    expect(Array.isArray(body.messages)).toBe(true);
  });

  it("should reject when not a member of channel", async () => {
    const creatorToken = await registerUser(ctx, "hist-creator2");
    await fetch(`${ctx.baseUrl}/channel-create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${creatorToken}`,
      },
      body: JSON.stringify({ name: "hist-private" }),
    });

    const otherToken = await registerUser(ctx, "hist-outsider");
    const res = await fetch(`${ctx.baseUrl}/channel-history?channel=${encodeURIComponent("#hist-private")}`, {
      headers: { Authorization: `Bearer ${otherToken}` },
    });
    expect(res.status).toBe(403);
  });
});

describe("GET /channels", () => {
  it("should list channels with member info", async () => {
    const res = await fetch(`${ctx.baseUrl}/channels`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      channels: { name: string; memberCount: number; members: string[] }[];
    };
    expect(Array.isArray(body.channels)).toBe(true);
    const all = body.channels.find((c) => c.name === "#all");
    expect(all).toBeDefined();
  });
});

describe("POST /send to a channel", () => {
  const post = (token: string, route: string, body: unknown) =>
    fetch(`${ctx.baseUrl}${route}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });

  it("accepts the channel name without #", async () => {
    const sender = await registerUser(ctx, "nohash-sender");
    const reader = await registerUser(ctx, "nohash-reader");
    await post(sender, "/channel-create", { name: "nohash-room" });
    expect((await post(reader, "/channel-join", { channel: "nohash-room" })).status).toBe(200);

    const res = await post(sender, "/send", { to: "@all", content: "hello room", channel: "nohash-room" });
    expect(res.status).toBe(200);
    const inbox = await fetch(`${ctx.baseUrl}/inbox`, { headers: { Authorization: `Bearer ${reader}` } });
    const { messages } = (await inbox.json()) as { messages: { content: string; channel: string }[] };
    expect(messages).toContainEqual(expect.objectContaining({ content: "hello room", channel: "#nohash-room" }));
  });

  it("rejects a channel that does not exist", async () => {
    const sender = await registerUser(ctx, "nochan-sender");
    const res = await post(sender, "/send", { to: "@all", content: "lost", channel: "#no-such-room" });
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: string }).error).toContain("does not exist");
    const history = await fetch(`${ctx.baseUrl}/admin-channel-history?channel=${encodeURIComponent("#no-such-room")}`, {
      headers: { Authorization: `Bearer ${ctx.adminToken}` },
    });
    const { messages } = (await history.json()) as { messages: { content: string }[] };
    expect(messages).toEqual([]);
  });
});

describe("POST /admin-channel-add and /admin-channel-remove", () => {
  const admin = (route: string, body: unknown) =>
    fetch(`${ctx.baseUrl}${route}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ctx.adminToken}`, "X-Walkie-User": "alice" },
      body: JSON.stringify(body),
    });
  const members = async (channel: string) => {
    const res = await fetch(`${ctx.baseUrl}/channels`);
    const { channels } = (await res.json()) as { channels: { name: string; members: string[] }[] };
    return channels.find((c) => c.name === channel)?.members ?? [];
  };

  it("adds an agent to a channel and tells it", async () => {
    const agent = await registerUser(ctx, "added-agent");
    await admin("/admin-channel-create", { name: "added-room" });
    const res = await admin("/admin-channel-add", { channel: "added-room", user: "@added-agent" });
    expect(res.status).toBe(200);
    expect(await members("#added-room")).toEqual(["added-agent"]);
    const inbox = await fetch(`${ctx.baseUrl}/inbox`, { headers: { Authorization: `Bearer ${agent}` } });
    const { messages } = (await inbox.json()) as { messages: { from: string; content: string }[] };
    expect(messages).toContainEqual(
      expect.objectContaining({ from: "system", content: "You have been added to #added-room by alice" }),
    );
  });

  it("removes an agent from a channel", async () => {
    await registerUser(ctx, "removed-agent");
    await admin("/admin-channel-create", { name: "removed-room" });
    await admin("/admin-channel-add", { channel: "#removed-room", user: "removed-agent" });
    const res = await admin("/admin-channel-remove", { channel: "#removed-room", user: "removed-agent" });
    expect(res.status).toBe(200);
    expect(await members("#removed-room")).toEqual([]);
  });

  it("refuses unknown agents and channels, humans, and removing from #all", async () => {
    await registerUser(ctx, "refused-agent");
    await admin("/admin-channel-create", { name: "refused-room" });
    expect((await admin("/admin-channel-add", { channel: "#refused-room", user: "nobody" })).status).toBe(404);
    expect((await admin("/admin-channel-add", { channel: "#no-room", user: "refused-agent" })).status).toBe(404);
    expect((await admin("/admin-channel-add", { channel: "#refused-room", user: "alice" })).status).toBe(400);
    expect((await admin("/admin-channel-remove", { channel: "#all", user: "refused-agent" })).status).toBe(400);
    expect((await admin("/admin-channel-remove", { channel: "#refused-room", user: "refused-agent" })).status).toBe(404);
  });
});
