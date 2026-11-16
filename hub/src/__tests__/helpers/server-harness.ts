import type { Server } from "node:http";
import { createHubServer, type HubOptions } from "../../server.js";

export interface TestContext {
  baseUrl: string;
  adminToken: string;
  joinToken: string;
  server: Server;
}

const ADMIN_TOKEN = "test-admin-token";
const JOIN_TOKEN = "test-join-token";

export async function startTestServer(options: HubOptions = {}): Promise<TestContext> {
  // Fresh in-memory projects unless the test asks for files
  const server = createHubServer(0, ADMIN_TOKEN, JOIN_TOKEN, "127.0.0.1", {
    dbPath: ":memory:",
    projectsDir: null,
    ...options,
  });

  // Wait for server to start listening
  await new Promise<void>((resolve) => {
    server.on("listening", resolve);
  });

  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    adminToken: ADMIN_TOKEN,
    joinToken: JOIN_TOKEN,
    server,
  };
}

export async function stopTestServer(ctx: TestContext): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    ctx.server.close((err) => (err ? reject(err) : resolve()));
  });
}

export async function registerUser(ctx: TestContext, name: string): Promise<string> {
  const res = await fetch(`${ctx.baseUrl}/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ctx.joinToken}`,
    },
    body: JSON.stringify({ name }),
  });
  const body = (await res.json()) as { token: string };
  return body.token;
}
