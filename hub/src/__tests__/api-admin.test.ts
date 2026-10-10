import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerUser, startTestServer, stopTestServer, type TestContext } from "./helpers/server-harness.js";

let ctx: TestContext;

beforeAll(async () => {
  ctx = await startTestServer();
});

afterAll(async () => {
  await stopTestServer(ctx);
});

function adminHeaders(user?: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${ctx.adminToken}`,
    ...(user ? { "X-Walkie-User": user } : {}),
  };
}

describe("POST /kick", () => {
  it("should kick a registered user", async () => {
    await registerUser(ctx, "kick-target");
    const res = await fetch(`${ctx.baseUrl}/kick`, {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({ name: "kick-target" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; kicked: string };
    expect(body.kicked).toBe("kick-target");
  });

  it("should return 404 for non-existent user", async () => {
    const res = await fetch(`${ctx.baseUrl}/kick`, {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({ name: "nobody" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("POST /kick-all", () => {
  it("should kick all agents but exclude humans", async () => {
    await registerUser(ctx, "ka-agent1");
    await registerUser(ctx, "ka-agent2");
    await fetch(`${ctx.baseUrl}/admin-login`, { method: "POST", headers: adminHeaders("ka-human") });

    const res = await fetch(`${ctx.baseUrl}/kick-all`, {
      method: "POST",
      headers: adminHeaders(),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; kicked: string[] };
    expect(body.kicked).not.toContain("operator");
    expect(body.kicked).not.toContain("ka-human");
    expect(body.kicked).toContain("ka-agent1");
    expect(body.kicked).toContain("ka-agent2");

    // Verify humans are still registered
    const usersRes = await fetch(`${ctx.baseUrl}/users`);
    const usersBody = (await usersRes.json()) as { users: { name: string }[] };
    expect(usersBody.users.map((u) => u.name)).toEqual(expect.arrayContaining(["operator", "ka-human"]));
  });
});

describe("POST /admin-send", () => {
  it("should send a message as operator", async () => {
    await registerUser(ctx, "admin-recv");
    const res = await fetch(`${ctx.baseUrl}/admin-send`, {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({ to: "@all", content: "admin message" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; to: string };
    expect(body.to).toBe("@all");
  });

  it("should send a message with image as operator", async () => {
    await registerUser(ctx, "admin-img-recv");
    const res = await fetch(`${ctx.baseUrl}/admin-send`, {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({
        to: "@all",
        content: "see this",
        image: { data: "iVBORw0KGgo=", mimeType: "image/png" },
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; to: string };
    expect(body.id).toBeTruthy();
  });

  it("should accept image-only admin message", async () => {
    await registerUser(ctx, "admin-imgonly-recv");
    const res = await fetch(`${ctx.baseUrl}/admin-send`, {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({
        to: "@all",
        image: { data: "iVBORw0KGgo=", mimeType: "image/png" },
      }),
    });
    expect(res.status).toBe(200);
  });

  it("should reject missing fields", async () => {
    const res = await fetch(`${ctx.baseUrl}/admin-send`, {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({ to: "@all" }), // missing content
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /admin-channel-create", () => {
  it("should create a channel as admin", async () => {
    const res = await fetch(`${ctx.baseUrl}/admin-channel-create`, {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({ name: "admin-room" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; channel: string };
    expect(body.channel).toBe("#admin-room");
  });

  it("should reject duplicate channel", async () => {
    const res = await fetch(`${ctx.baseUrl}/admin-channel-create`, {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({ name: "admin-room" }),
    });
    expect(res.status).toBe(409);
  });
});

describe("POST /admin-channel-delete", () => {
  it("should delete a channel", async () => {
    await fetch(`${ctx.baseUrl}/admin-channel-create`, {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({ name: "admin-del-room" }),
    });
    const res = await fetch(`${ctx.baseUrl}/admin-channel-delete`, {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({ name: "#admin-del-room" }),
    });
    expect(res.status).toBe(200);
  });

  it("should reject deleting #all", async () => {
    const res = await fetch(`${ctx.baseUrl}/admin-channel-delete`, {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({ name: "#all" }),
    });
    expect(res.status).toBe(400);
  });

  it("should return 404 for non-existent channel", async () => {
    const res = await fetch(`${ctx.baseUrl}/admin-channel-delete`, {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({ name: "#nope" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("GET /admin-channel-history", () => {
  it("should return message history for a channel", async () => {
    const res = await fetch(`${ctx.baseUrl}/admin-channel-history?channel=${encodeURIComponent("#all")}`, {
      headers: { Authorization: `Bearer ${ctx.adminToken}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { messages: unknown[] };
    expect(Array.isArray(body.messages)).toBe(true);
  });

  it("should return recent messages without channel param", async () => {
    const res = await fetch(`${ctx.baseUrl}/admin-channel-history`, {
      headers: { Authorization: `Bearer ${ctx.adminToken}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { messages: unknown[] };
    expect(Array.isArray(body.messages)).toBe(true);
  });
});

describe("POST /admin-mark-read", () => {
  it("should mark a channel as read", async () => {
    const res = await fetch(`${ctx.baseUrl}/admin-mark-read`, {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({ channel: "#all" }),
    });
    expect(res.status).toBe(200);
  });

  it("should reject missing channel", async () => {
    const res = await fetch(`${ctx.baseUrl}/admin-mark-read`, {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});

describe("GET /admin-unread-counts", () => {
  it("should return unread counts for operator", async () => {
    const res = await fetch(`${ctx.baseUrl}/admin-unread-counts`, {
      headers: { Authorization: `Bearer ${ctx.adminToken}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { counts: Record<string, number> };
    expect(typeof body.counts).toBe("object");
  });
});

describe("human users", () => {
  type UserInfo = { name: string; online: boolean; role: string };
  async function getUser(name: string): Promise<UserInfo | undefined> {
    const body = (await (await fetch(`${ctx.baseUrl}/users`)).json()) as { users: UserInfo[] };
    return body.users.find((u) => u.name === name);
  }

  it("should log in a human by name", async () => {
    const res = await fetch(`${ctx.baseUrl}/admin-login`, { method: "POST", headers: adminHeaders("alice") });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { name: string }).name).toBe("alice");
    expect((await getUser("alice"))?.role).toBe("human");
  });

  it("should reject invalid and reserved names", async () => {
    for (const name of ["bad name", "system", "x".repeat(33)]) {
      const res = await fetch(`${ctx.baseUrl}/admin-login`, { method: "POST", headers: adminHeaders(name) });
      expect(res.status).toBe(400);
    }
  });

  it("should reject a name held by an agent", async () => {
    await registerUser(ctx, "agent-taken");
    const res = await fetch(`${ctx.baseUrl}/admin-login`, { method: "POST", headers: adminHeaders("agent-taken") });
    expect(res.status).toBe(409);
  });

  it("should send as the calling human and tag the sender role for agents", async () => {
    const token = await registerUser(ctx, "h-recv");
    const res = await fetch(`${ctx.baseUrl}/admin-send`, {
      method: "POST",
      headers: adminHeaders("bob"),
      body: JSON.stringify({ to: "@all", content: "hi from bob" }),
    });
    expect(res.status).toBe(200);
    const inbox = (await (
      await fetch(`${ctx.baseUrl}/inbox`, { headers: { Authorization: `Bearer ${token}` } })
    ).json()) as { messages: { from: string; fromRole?: string; content: string }[] };
    const msg = inbox.messages.find((m) => m.content === "hi from bob");
    expect(msg?.from).toBe("bob");
    expect(msg?.fromRole).toBe("human");
  });

  it("should let an agent reply to a human from any channel", async () => {
    await fetch(`${ctx.baseUrl}/admin-login`, { method: "POST", headers: adminHeaders("carol") });
    await fetch(`${ctx.baseUrl}/admin-channel-create`, {
      method: "POST",
      headers: adminHeaders("carol"),
      body: JSON.stringify({ name: "h-proj" }),
    });
    const token = await registerUser(ctx, "h-agent");
    const agentHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
    await fetch(`${ctx.baseUrl}/channel-join`, {
      method: "POST",
      headers: agentHeaders,
      body: JSON.stringify({ channel: "#h-proj" }),
    });
    const res = await fetch(`${ctx.baseUrl}/send`, {
      method: "POST",
      headers: agentHeaders,
      body: JSON.stringify({ to: "@carol", content: "done", channel: "#h-proj" }),
    });
    expect(res.status).toBe(200);
  });

  it("should keep unread counts per human", async () => {
    await fetch(`${ctx.baseUrl}/admin-channel-create`, {
      method: "POST",
      headers: adminHeaders("dave"),
      body: JSON.stringify({ name: "h-unread" }),
    });
    const token = await registerUser(ctx, "h-unread-agent");
    const agentHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
    await fetch(`${ctx.baseUrl}/channel-join`, {
      method: "POST",
      headers: agentHeaders,
      body: JSON.stringify({ channel: "#h-unread" }),
    });
    await fetch(`${ctx.baseUrl}/send`, {
      method: "POST",
      headers: agentHeaders,
      body: JSON.stringify({ to: "@all", content: "news", channel: "#h-unread" }),
    });
    await fetch(`${ctx.baseUrl}/admin-mark-read`, {
      method: "POST",
      headers: adminHeaders("dave"),
      body: JSON.stringify({ channel: "#h-unread" }),
    });
    const counts = async (user: string) =>
      (
        (await (await fetch(`${ctx.baseUrl}/admin-unread-counts`, { headers: adminHeaders(user) })).json()) as {
          counts: Record<string, number>;
        }
      ).counts["#h-unread"];
    expect(await counts("dave")).toBeUndefined();
    expect(await counts("erin")).toBe(1);
  });

  it("should refuse to kick a human", async () => {
    await fetch(`${ctx.baseUrl}/admin-login`, { method: "POST", headers: adminHeaders("frank") });
    const res = await fetch(`${ctx.baseUrl}/kick`, {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({ name: "frank" }),
    });
    expect(res.status).toBe(400);
  });

  it("should track presence from the dashboard event stream", async () => {
    const ac = new AbortController();
    const stream = await fetch(`${ctx.baseUrl}/events?token=${ctx.adminToken}&name=gina`, { signal: ac.signal });
    expect(stream.status).toBe(200);
    expect(await getUser("gina")).toMatchObject({ role: "human", online: true });
    ac.abort();
    await new Promise((r) => setTimeout(r, 100));
    expect(await getUser("gina")).toMatchObject({ role: "human", online: false });
  });

  it("should reject the event stream for a name held by an agent", async () => {
    await registerUser(ctx, "agent-stream");
    const res = await fetch(`${ctx.baseUrl}/events?token=${ctx.adminToken}&name=agent-stream`);
    expect(res.status).toBe(409);
  });
});

describe("GET /admin-channel-history paging", () => {
  it("should return only messages older than before", async () => {
    await fetch(`${ctx.baseUrl}/admin-channel-create`, {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({ name: "paging" }),
    });
    for (let i = 0; i < 3; i++) {
      await fetch(`${ctx.baseUrl}/admin-send`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({ to: "@all", content: `page ${i}`, channel: "#paging" }),
      });
      await new Promise((r) => setTimeout(r, 5));
    }
    const history = async (query: string) =>
      (
        (await (
          await fetch(`${ctx.baseUrl}/admin-channel-history?channel=${encodeURIComponent("#paging")}${query}`, {
            headers: adminHeaders(),
          })
        ).json()) as { messages: { content: string; timestamp: number }[] }
      ).messages;
    const latest = await history("&limit=2");
    expect(latest.map((m) => m.content)).toEqual(["page 1", "page 2"]);
    const older = await history(`&limit=2&before=${latest[0].timestamp}`);
    expect(older.map((m) => m.content)).toEqual(["page 0"]);
  });
});
