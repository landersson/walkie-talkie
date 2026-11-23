import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerUser, startTestServer, stopTestServer, type TestContext } from "./helpers/server-harness.js";

let ctx: TestContext;

beforeAll(async () => {
  ctx = await startTestServer();
});

afterAll(async () => {
  await stopTestServer(ctx);
});

const post = (token: string, route: string, body: unknown, user?: string) =>
  fetch(`${ctx.baseUrl}${route}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(user ? { "X-Walkie-User": user } : {}),
    },
    body: JSON.stringify(body),
  });

type HistoryMessage = { id: string; content: string; replyTo?: string; editedAt?: number; retracted?: boolean };
async function history(channel = "#all"): Promise<HistoryMessage[]> {
  const res = await fetch(`${ctx.baseUrl}/admin-channel-history?channel=${encodeURIComponent(channel)}`, {
    headers: { Authorization: `Bearer ${ctx.adminToken}` },
  });
  return ((await res.json()) as { messages: HistoryMessage[] }).messages;
}
const find = async (id: string) => (await history()).find((m) => m.id === id);

async function send(token: string, content: string, extra: Record<string, unknown> = {}) {
  const res = await post(token, "/send", { to: "@all", content, ...extra });
  return { status: res.status, body: (await res.json()) as { id: string; error?: string } };
}

describe("replies", () => {
  it("records the message replied to, by id or a unique start of it", async () => {
    const a = await registerUser(ctx, "reply-a");
    const b = await registerUser(ctx, "reply-b");
    const parent = await send(a, "parent post");
    const full = await send(b, "reply by id", { replyTo: parent.body.id });
    const short = await send(b, "reply by prefix", { replyTo: parent.body.id.slice(0, 8) });
    expect((await find(full.body.id))?.replyTo).toBe(parent.body.id);
    expect((await find(short.body.id))?.replyTo).toBe(parent.body.id);

    // a reply to a reply stays in the same thread, and agents receive replyTo
    const nested = await send(a, "reply to the reply", { replyTo: short.body.id });
    expect((await find(nested.body.id))?.replyTo).toBe(parent.body.id);
    const inbox = await fetch(`${ctx.baseUrl}/inbox`, { headers: { Authorization: `Bearer ${b}` } });
    const { messages } = (await inbox.json()) as { messages: HistoryMessage[] };
    expect(messages.find((m) => m.content === "reply to the reply")?.replyTo).toBe(parent.body.id);
  });

  it("refuses a reply to a message that is not in the channel", async () => {
    const a = await registerUser(ctx, "reply-missing");
    const res = await send(a, "orphan", { replyTo: "00000000-no-such-message" });
    expect(res.status).toBe(404);
    expect(res.body.error).toContain("to reply to");
  });
});

describe("edit and retract", () => {
  it("lets agents edit and retract their own messages", async () => {
    const a = await registerUser(ctx, "edit-agent");
    const sent = await send(a, "typo here");
    expect((await post(a, "/message-edit", { id: sent.body.id, content: "fixed" })).status).toBe(200);
    const edited = await find(sent.body.id);
    expect(edited?.content).toBe("fixed");
    expect(edited?.editedAt).toBeGreaterThan(0);

    // by a start of the id, within a channel
    const res = await post(a, "/message-retract", { id: sent.body.id.slice(0, 8), channel: "all" });
    expect(res.status).toBe(200);
    const retracted = await find(sent.body.id);
    expect(retracted?.retracted).toBe(true);
    expect(retracted?.content).toBe("");
    expect((await post(a, "/message-edit", { id: sent.body.id, content: "again" })).status).toBe(409);
  });

  it("lets dashboard users change only their own messages", async () => {
    const alice = await post(ctx.adminToken, "/admin-send", { to: "@all", content: "from alice" }, "alice");
    const { id } = (await alice.json()) as { id: string };
    expect((await post(ctx.adminToken, "/admin-message-edit", { id, content: "bob was here" }, "bob")).status).toBe(
      403,
    );
    expect((await post(ctx.adminToken, "/admin-message-edit", { id, content: "alice, edited" }, "alice")).status).toBe(
      200,
    );
    expect((await find(id))?.content).toBe("alice, edited");

    const agent = await registerUser(ctx, "edit-other");
    expect((await post(agent, "/message-retract", { id })).status).toBe(403);
    expect((await post(ctx.adminToken, "/admin-message-retract", { id }, "alice")).status).toBe(200);
  });

  it("rejects bad requests", async () => {
    const a = await registerUser(ctx, "edit-bad");
    expect((await post(a, "/message-edit", { content: "x" })).status).toBe(400);
    expect((await post(a, "/message-edit", { id: "nope", content: "x" })).status).toBe(404);
    const sent = await send(a, "keep");
    expect((await post(a, "/message-edit", { id: sent.body.id, content: "  " })).status).toBe(400);
  });
});
