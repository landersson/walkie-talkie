import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { HubOptions } from "../server.js";
import { registerUser, startTestServer, stopTestServer, type TestContext } from "./helpers/server-harness.js";

let dir: string;
let ctx: TestContext | null = null;

async function start(options: HubOptions = {}): Promise<TestContext> {
  ctx = await startTestServer({
    dbPath: path.join(dir, "hub.db"),
    projectsDir: path.join(dir, "projects"),
    ...options,
  });
  return ctx;
}

function admin(c: TestContext, route: string, body?: unknown): Promise<Response> {
  return fetch(`${c.baseUrl}${route}`, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${c.adminToken}` },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function register(c: TestContext, prefix: string, name: string): Promise<Response> {
  return fetch(`${c.baseUrl}${prefix}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${c.joinToken}` },
    body: JSON.stringify({ name }),
  });
}

function send(c: TestContext, prefix: string, token: string, content: string): Promise<Response> {
  return fetch(`${c.baseUrl}${prefix}/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ to: "@all", content, channel: "#all" }),
  });
}

async function history(c: TestContext, prefix: string): Promise<string[]> {
  const res = await admin(c, `${prefix}/admin-channel-history?channel=%23all`);
  const { messages } = (await res.json()) as { messages: { content: string }[] };
  return messages.map((m) => m.content);
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "walkie-projects-"));
});

afterEach(async () => {
  if (ctx) await stopTestServer(ctx);
  ctx = null;
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("projects", () => {
  it("lists the default project and requires the admin token", async () => {
    const c = await start();
    expect((await fetch(`${c.baseUrl}/projects`)).status).toBe(401);
    const res = await admin(c, "/projects");
    expect(res.status).toBe(200);
    const { projects } = (await res.json()) as { projects: { name: string; default: boolean }[] };
    expect(projects.map((p) => p.name)).toEqual(["default"]);
    expect(projects[0].default).toBe(true);
  });

  it("creates projects and rejects duplicate, invalid and reserved names", async () => {
    const c = await start();
    expect((await admin(c, "/admin-project-create", { name: "alpha" })).status).toBe(200);
    expect((await admin(c, "/admin-project-create", { name: "alpha" })).status).toBe(409);
    expect((await admin(c, "/admin-project-create", { name: "default" })).status).toBe(409);
    expect((await admin(c, "/admin-project-create", { name: "bad name" })).status).toBe(400);
    expect((await admin(c, "/admin-project-create", { name: "archive" })).status).toBe(400);
    expect(fs.existsSync(path.join(dir, "projects", "alpha.db"))).toBe(true);
    const { projects } = (await (await admin(c, "/projects")).json()) as { projects: { name: string }[] };
    expect(projects.map((p) => p.name)).toEqual(["default", "alpha"]);
  });

  it("keeps projects apart: same agent names, separate history", async () => {
    const c = await start();
    await admin(c, "/admin-project-create", { name: "alpha" });
    expect((await register(c, "/p/alpha", "Tester")).status).toBe(200);
    expect((await register(c, "", "Tester")).status).toBe(200);
    const alphaToken = await registerUser(c, "Sender", "/p/alpha");
    expect((await send(c, "/p/alpha", alphaToken, "only in alpha")).status).toBe(200);
    expect(await history(c, "/p/alpha")).toContain("only in alpha");
    expect(await history(c, "")).not.toContain("only in alpha");
    expect(await history(c, "/p/default")).not.toContain("only in alpha");
    // A token from one project means nothing in another
    expect((await send(c, "", alphaToken, "wrong project")).status).toBe(401);
  });

  it("routes unknown projects to 404 and adds the trailing slash", async () => {
    const c = await start();
    expect((await fetch(`${c.baseUrl}/p/nope/users`)).status).toBe(404);
    const res = await fetch(`${c.baseUrl}/p/default`, { redirect: "manual" });
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("/p/default/");
    const dashboard = await fetch(`${c.baseUrl}/p/default/`);
    expect(await dashboard.text()).toContain('id="channel-list"');
    const shell = await fetch(`${c.baseUrl}/`);
    expect(await shell.text()).toContain('id="tabs"');
  });

  it("archives a project: agents are disconnected and the database moves to archive/", async () => {
    const c = await start();
    await admin(c, "/admin-project-create", { name: "alpha" });
    const token = await registerUser(c, "Worker", "/p/alpha");
    const poll = fetch(`${c.baseUrl}/p/alpha/poll`, { headers: { Authorization: `Bearer ${token}` } });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect((await admin(c, "/admin-project-archive", { name: "default" })).status).toBe(400);
    expect((await admin(c, "/admin-project-archive", { name: "nope" })).status).toBe(404);
    const res = await admin(c, "/admin-project-archive", { name: "alpha" });
    expect(res.status).toBe(200);

    const { messages } = (await (await poll).json()) as { messages: { content: string }[] };
    expect(messages[0].content).toMatch(/^RADIO_KILLED:/);
    expect((await fetch(`${c.baseUrl}/p/alpha/users`)).status).toBe(404);
    expect(fs.existsSync(path.join(dir, "projects", "alpha.db"))).toBe(false);
    const archived = fs.readdirSync(path.join(dir, "projects", "archive"));
    expect(archived.some((f) => /^alpha-\d{8}-\d{6}\.db$/.test(f))).toBe(true);
  });

  it("reloads projects and their history after a restart", async () => {
    let c = await start();
    await admin(c, "/admin-project-create", { name: "alpha" });
    const token = await registerUser(c, "Writer", "/p/alpha");
    await send(c, "/p/alpha", token, "kept");
    await stopTestServer(c);
    ctx = null;

    c = await start();
    const { projects } = (await (await admin(c, "/projects")).json()) as { projects: { name: string }[] };
    expect(projects.map((p) => p.name)).toEqual(["default", "alpha"]);
    expect(await history(c, "/p/alpha")).toContain("kept");
  });

  it("reports activity in any project on the hub-wide stream", async () => {
    const c = await start();
    await admin(c, "/admin-project-create", { name: "alpha" });
    const controller = new AbortController();
    const stream = await fetch(`${c.baseUrl}/hub-events?token=${c.adminToken}&name=alice`, {
      signal: controller.signal,
    });
    const reader = stream.body!.getReader();
    const token = await registerUser(c, "Chatty", "/p/alpha");
    await send(c, "/p/alpha", token, "hello");

    let text = "";
    while (!text.includes('"activity"')) {
      const { value, done } = await reader.read();
      if (done) break;
      text += new TextDecoder().decode(value);
    }
    expect(text).toContain('"project":"alpha"');

    // The stream makes alice present in every project
    const users = (await (await fetch(`${c.baseUrl}/p/alpha/users`)).json()) as {
      users: { name: string; online: boolean }[];
    };
    expect(users.users).toContainEqual({ name: "alice", online: true, role: "human" });
    controller.abort();
  });

  it("can give the default project its own name", async () => {
    const c = await start({ defaultProject: "RotoCap" });
    const { projects } = (await (await admin(c, "/projects")).json()) as {
      projects: { name: string; default: boolean }[];
    };
    expect(projects).toEqual([{ name: "RotoCap", default: true }]);
    // A plain HUB_URL and /p/RotoCap reach the same project
    const token = await registerUser(c, "Worker");
    expect((await send(c, "", token, "same project")).status).toBe(200);
    expect(await history(c, "/p/RotoCap")).toContain("same project");
    expect((await fetch(`${c.baseUrl}/p/default/users`)).status).toBe(404);
    expect((await admin(c, "/admin-project-create", { name: "RotoCap" })).status).toBe(409);
    expect((await admin(c, "/admin-project-archive", { name: "RotoCap" })).status).toBe(400);
  });

  it("can run without a default project", async () => {
    const c = await start({ defaultProject: null });
    let { projects } = (await (await admin(c, "/projects")).json()) as { projects: { name: string }[] };
    expect(projects).toEqual([]);
    // A plain HUB_URL gets told to name a project
    const res = await register(c, "", "Lost");
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: string }).error).toMatch(/no default project.*\/p\/<project>/);
    // The tabs page can still log in, and projects work as usual
    const login = await fetch(`${c.baseUrl}/admin-login`, {
      method: "POST",
      headers: { Authorization: `Bearer ${c.adminToken}`, "X-Walkie-User": "alice" },
    });
    expect(login.status).toBe(200);
    expect((await admin(c, "/admin-project-create", { name: "alpha" })).status).toBe(200);
    ({ projects } = (await (await admin(c, "/projects")).json()) as { projects: { name: string }[] });
    expect(projects.map((p) => p.name)).toEqual(["alpha"]);
    expect((await register(c, "/p/alpha", "Found")).status).toBe(200);
    expect((await admin(c, "/admin-project-archive", { name: "alpha" })).status).toBe(200);
  });
});
