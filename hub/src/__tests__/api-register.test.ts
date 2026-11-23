import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerUser, startTestServer, stopTestServer, type TestContext } from "./helpers/server-harness.js";

let ctx: TestContext;

beforeAll(async () => {
  ctx = await startTestServer();
});

afterAll(async () => {
  await stopTestServer(ctx);
});

describe("POST /register", () => {
  it("should register a new user and return a token", async () => {
    const res = await fetch(`${ctx.baseUrl}/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ctx.joinToken}`,
      },
      body: JSON.stringify({ name: "reg-alice" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string; name: string };
    expect(body.name).toBe("reg-alice");
    expect(body.token).toBeTruthy();
  });

  it("keeps the host and plugin version an agent reports, cleaned up", async () => {
    const join = (name: string, client: unknown) =>
      fetch(`${ctx.baseUrl}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${ctx.joinToken}` },
        body: JSON.stringify({ name, client }),
      });
    expect((await join("reg-host", { host: " zeus\u0007 ", version: "1.13.0", extra: "x" })).status).toBe(200);
    expect((await join("reg-nohost", "not an object")).status).toBe(200);
    expect((await join("reg-long", { host: "h".repeat(200) })).status).toBe(200);
    const { users } = (await (await fetch(`${ctx.baseUrl}/users`)).json()) as {
      users: { name: string; client?: { host?: string; version?: string } }[];
    };
    const client = (name: string) => users.find((u) => u.name === name)?.client;
    expect(client("reg-host")).toEqual({ host: "zeus", version: "1.13.0" });
    expect(client("reg-nohost")).toBeUndefined();
    expect(client("reg-long")?.host).toHaveLength(64);
  });

  it("should reject duplicate registration", async () => {
    await registerUser(ctx, "reg-dup");
    const res = await fetch(`${ctx.baseUrl}/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ctx.joinToken}`,
      },
      body: JSON.stringify({ name: "reg-dup" }),
    });
    expect(res.status).toBe(409);
  });

  it("should allow reconnect with old token", async () => {
    const token = await registerUser(ctx, "reg-reconnect");
    const res = await fetch(`${ctx.baseUrl}/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ctx.joinToken}`,
      },
      body: JSON.stringify({ name: "reg-reconnect", oldToken: token }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string; name: string };
    expect(body.name).toBe("reg-reconnect");
    // New token should be different
    expect(body.token).toBeTruthy();
  });

  it("should reject reconnect with wrong old token", async () => {
    await registerUser(ctx, "reg-wrongtoken");
    const res = await fetch(`${ctx.baseUrl}/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ctx.joinToken}`,
      },
      body: JSON.stringify({ name: "reg-wrongtoken", oldToken: "wrong" }),
    });
    expect(res.status).toBe(409);
  });

  it("should reject missing name", async () => {
    const res = await fetch(`${ctx.baseUrl}/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ctx.joinToken}`,
      },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /unregister", () => {
  it("should unregister an authenticated user", async () => {
    const token = await registerUser(ctx, "reg-unreg");
    const res = await fetch(`${ctx.baseUrl}/unregister`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);

    // Should no longer appear in users list
    const usersRes = await fetch(`${ctx.baseUrl}/users`);
    const usersBody = (await usersRes.json()) as { users: { name: string }[] };
    expect(usersBody.users.map((u) => u.name)).not.toContain("reg-unreg");
  });

  it("should reject unregister without token", async () => {
    const res = await fetch(`${ctx.baseUrl}/unregister`, {
      method: "POST",
    });
    expect(res.status).toBe(401);
  });
});
