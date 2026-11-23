import fs from "node:fs";
import type { IncomingMessage } from "node:http";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { openProjectDB } from "../db.js";
import { createFileSpace, createFileStore, type FileLimits, filesDirFor, formatBytes } from "../files.js";

/** An upload request whose body is written by the test. */
function fakeUpload(size: number) {
  const req = new PassThrough() as PassThrough & { headers: Record<string, string> };
  req.headers = { "content-length": String(size) };
  return req;
}
const meta = { name: "f.bin", uploader: "a", channel: "#all" };
const limits = (over: Partial<FileLimits>): FileLimits => ({
  maxFileBytes: 1000,
  quotaBytes: 1500,
  totalBytes: 2500,
  minFreeBytes: 0,
  ttlMs: 60_000,
  ...over,
});

describe("file store cleanup", () => {
  it("deletes expired files and leftovers no record knows", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "walkie-files-test-"));
    const db = openProjectDB(":memory:");
    const store = createFileStore(db, dir);
    const now = Date.now();
    const base = { mimeType: "text/plain", uploader: "a", channel: "#all", createdAt: now, size: 1 };
    db.dbSaveFile({ ...base, id: "old", name: "old.txt", expiresAt: now - 1 });
    db.dbSaveFile({ ...base, id: "new", name: "new.txt", expiresAt: now + 60_000 });
    for (const f of ["old", "new", "stray", ".upload-recent"]) fs.writeFileSync(path.join(dir, f), "x");

    const expired = store.cleanup(now);
    expect(expired.map((f) => f.id)).toEqual(["old"]);
    expect(fs.readdirSync(dir).sort()).toEqual([".upload-recent", "new"]);
    expect(store.list().map((f) => f.id)).toEqual(["new"]);
    store.destroy();
    expect(fs.existsSync(dir)).toBe(false);
    db.close();
  });

  it("keeps a project's files next to its database or under the files folder", () => {
    expect(filesDirFor("/data/projects/alpha.db", "alpha", "")).toBe("/data/projects/alpha.files");
    // or in a folder of its own under WALKIE_TALKIE_FILES_DIR
    expect(filesDirFor("/data/projects/alpha.db", "alpha", "/scratch/hub")).toBe("/scratch/hub/alpha");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(3 * 1024 ** 3)).toBe("3.0 GB");
  });
});

describe("file limits", () => {
  const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "walkie-files-test-"));

  it("counts uploads in progress, per project and across the hub", async () => {
    const space = createFileSpace(limits({ totalBytes: 2200 }));
    const alpha = createFileStore(openProjectDB(":memory:"), tmp(), { space });
    const beta = createFileStore(openProjectDB(":memory:"), tmp(), { space });

    const first = fakeUpload(1000);
    const saving = alpha.save(first as unknown as IncomingMessage, meta);
    // while the first upload is still running, a second can't squeeze past the project quota
    await expect(alpha.save(fakeUpload(1000) as unknown as IncomingMessage, meta)).rejects.toThrow("this project's");
    first.end(Buffer.alloc(1000));
    await saving;

    // another project of the same hub: within its own quota, but over the hub's total
    const b1 = fakeUpload(1000);
    const p1 = beta.save(b1 as unknown as IncomingMessage, meta);
    b1.end(Buffer.alloc(1000));
    await p1;
    await expect(beta.save(fakeUpload(400) as unknown as IncomingMessage, meta)).rejects.toThrow("this hub's");
    alpha.destroy();
    beta.destroy();
  });

  it("refuses uploads when the disk is almost full", async () => {
    const store = createFileStore(openProjectDB(":memory:"), tmp(), {
      space: createFileSpace(limits({ minFreeBytes: Number.MAX_SAFE_INTEGER })),
    });
    await expect(store.save(fakeUpload(10) as unknown as IncomingMessage, meta)).rejects.toMatchObject({ status: 507 });
    store.destroy();
  });
});
