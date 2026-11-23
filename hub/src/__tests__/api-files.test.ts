import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerUser, startTestServer, stopTestServer, type TestContext } from "./helpers/server-harness.js";

let ctx: TestContext;
const saved = { ...process.env };

beforeAll(async () => {
  // Tiny limits: files up to ~1 KB, ~3 KB per project
  process.env.WALKIE_TALKIE_FILE_MAX_GB = String(1024 / 1024 ** 3);
  process.env.WALKIE_TALKIE_FILES_QUOTA_GB = String(3000 / 1024 ** 3);
  ctx = await startTestServer();
});

afterAll(async () => {
  await stopTestServer(ctx);
  process.env = saved;
});

function upload(token: string, name: string, body: Buffer, query: Record<string, string> = {}, admin = false) {
  const params = new URLSearchParams({ name, ...query });
  return fetch(`${ctx.baseUrl}/${admin ? "admin-file-upload" : "file-upload"}?${params}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/octet-stream" },
    body: new Uint8Array(body),
  });
}
const post = (token: string, route: string, body: unknown) =>
  fetch(`${ctx.baseUrl}${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
type FileInfo = { id: string; name: string; size: number; uploader: string };
const list = async (token: string) =>
  (await (await fetch(`${ctx.baseUrl}/files`, { headers: { Authorization: `Bearer ${token}` } })).json()) as {
    files: FileInfo[];
    used: number;
  };

describe("scratch space", () => {
  it("shares a file: upload, announce in the channel, list, download", async () => {
    const a = await registerUser(ctx, "files-a");
    const b = await registerUser(ctx, "files-b");
    const data = Buffer.from("hello scratch space\n".repeat(10));
    const res = await upload(a, "../sneaky/report.txt", data, { message: "the report" });
    expect(res.status).toBe(200);
    const file = (await res.json()) as FileInfo;
    expect(file).toMatchObject({ name: "report.txt", size: data.length, uploader: "files-a" });

    const inbox = await fetch(`${ctx.baseUrl}/inbox`, { headers: { Authorization: `Bearer ${b}` } });
    const { messages } = (await inbox.json()) as { messages: { content: string; file?: FileInfo }[] };
    expect(messages).toContainEqual(
      expect.objectContaining({ content: "the report", file: { id: file.id, name: "report.txt", size: data.length } }),
    );
    expect((await list(b)).files.map((f) => f.id)).toContain(file.id);

    const dl = await fetch(`${ctx.baseUrl}/file-download?id=${file.id.slice(0, 8)}`, {
      headers: { Authorization: `Bearer ${b}` },
    });
    expect(dl.status).toBe(200);
    expect(dl.headers.get("content-disposition")).toContain("report.txt");
    expect(Buffer.from(await dl.arrayBuffer()).equals(data)).toBe(true);
  });

  it("enforces the size limit and the project quota", async () => {
    const a = await registerUser(ctx, "files-quota");
    const big = await upload(a, "big.bin", Buffer.alloc(2048));
    expect(big.status).toBe(413);
    expect(((await big.json()) as { error: string }).error).toContain("too large");
    // fill up the ~3 KB quota with 1 KB files
    let status = 200;
    for (let i = 0; i < 4 && status === 200; i++) status = (await upload(a, `part${i}.bin`, Buffer.alloc(1000))).status;
    expect(status).toBe(413);
  });

  it("refuses unknown channels and empty files", async () => {
    const a = await registerUser(ctx, "files-bad");
    expect((await upload(a, "x.txt", Buffer.from("x"), { channel: "no-such-room" })).status).toBe(404);
    expect((await upload(a, "empty.txt", Buffer.alloc(0))).status).toBe(411);
  });

  it("lets agents delete their own files and people delete any", async () => {
    // make room in the quota first
    for (const f of (await list(await registerUser(ctx, "files-cleaner"))).files) {
      await post(ctx.adminToken, "/admin-file-delete", { id: f.id });
    }
    const owner = await registerUser(ctx, "files-owner");
    const other = await registerUser(ctx, "files-other");
    const mine = (await (await upload(owner, "mine.txt", Buffer.from("mine"))).json()) as FileInfo;
    expect((await post(other, "/file-delete", { id: mine.id })).status).toBe(403);
    expect((await post(owner, "/file-delete", { id: mine.id })).status).toBe(200);
    const theirs = (await (await upload(owner, "theirs.txt", Buffer.from("theirs"))).json()) as FileInfo;
    expect((await post(ctx.adminToken, "/admin-file-delete", { id: theirs.id })).status).toBe(200);
    expect((await list(other)).files).toEqual([]);
  });

  it("gives the dashboard short-lived download links", async () => {
    const a = await registerUser(ctx, "files-ticket");
    const data = Buffer.from("ticket data");
    const file = (await (await upload(a, "t.txt", data)).json()) as FileInfo;
    const { url } = (await (await post(ctx.adminToken, "/admin-file-ticket", { id: file.id })).json()) as {
      url: string;
    };
    const dl = await fetch(`${ctx.baseUrl}/${url}`);
    expect(dl.status).toBe(200);
    expect(dl.headers.get("content-type")).toBe("application/octet-stream");
    expect(Buffer.from(await dl.arrayBuffer()).equals(data)).toBe(true);
    expect((await fetch(`${ctx.baseUrl}/file-get?ticket=made-up`)).status).toBe(404);
    expect((await fetch(`${ctx.baseUrl}/file-download?id=${file.id}`)).status).toBe(401);
  });

  it("forgets files once they expire", async () => {
    const a = await registerUser(ctx, "files-expire");
    const ttlDays = String(300 / 86_400_000); // 0.3 s
    const file = (await (await upload(a, "brief.txt", Buffer.from("brief"), { ttl_days: ttlDays })).json()) as FileInfo;
    expect((await list(a)).files.map((f) => f.id)).toContain(file.id);
    await new Promise((r) => setTimeout(r, 400));
    expect((await list(a)).files.map((f) => f.id)).not.toContain(file.id);
    const dl = await fetch(`${ctx.baseUrl}/file-download?id=${file.id}`, { headers: { Authorization: `Bearer ${a}` } });
    expect(dl.status).toBe(404);
  });
});
