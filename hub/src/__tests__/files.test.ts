import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { openProjectDB } from "../db.js";
import { createFileStore, filesDirFor, formatBytes } from "../files.js";

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

  it("keeps a project's files next to its database", () => {
    expect(filesDirFor("/data/projects/alpha.db")).toBe("/data/projects/alpha.files");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(3 * 1024 ** 3)).toBe("3.0 GB");
  });
});
