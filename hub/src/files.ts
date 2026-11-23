import { randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs";
import type { IncomingMessage } from "node:http";
import os from "node:os";
import path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ProjectDB } from "./db.js";
import type { StoredFile } from "./types.js";

const GB = 1024 ** 3;
export const DAY_MS = 24 * 3_600_000;
const TICKET_MS = 60_000; // a dashboard download link works this long
const ORPHAN_UPLOAD_MS = DAY_MS; // unfinished uploads left behind by a crash

export interface FileLimits {
  maxFileBytes: number;
  quotaBytes: number;
  ttlMs: number;
}

function envNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Limits of every project's scratch space, from the environment (sizes in GB, TTL in days). */
export function fileLimitsFromEnv(): FileLimits {
  return {
    maxFileBytes: envNumber("WALKIE_TALKIE_FILE_MAX_GB", 2) * GB,
    quotaBytes: envNumber("WALKIE_TALKIE_FILES_QUOTA_GB", 20) * GB,
    ttlMs: envNumber("WALKIE_TALKIE_FILE_TTL_DAYS", 7) * DAY_MS,
  };
}

/**
 * Where a project keeps its scratch files: <$WALKIE_TALKIE_FILES_DIR>/<project> when that is set
 * (e.g. a big local disk), else next to its database; a temporary folder for in-memory projects.
 */
export function filesDirFor(dbPath: string, project: string, root = process.env.WALKIE_TALKIE_FILES_DIR): string {
  if (dbPath === ":memory:") return fs.mkdtempSync(path.join(os.tmpdir(), "walkie-talkie-files-"));
  if (root) return path.join(path.resolve(root), project);
  return `${dbPath.replace(/\.db$/, "")}.files`;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = n / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

/** An upload or download that can't be done, with the HTTP status to answer. */
export class FileError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** A file name safe to show and to offer as a download name. */
function cleanName(name: string): string {
  const base = [...path.basename(name.replace(/\\/g, "/"))]
    .filter((c) => c.charCodeAt(0) >= 0x20 && c.charCodeAt(0) !== 0x7f)
    .join("")
    .trim();
  return base.slice(0, 200) || "file";
}

/** A project's scratch space: files agents and people share, deleted when they expire. */
export function createFileStore(
  db: ProjectDB,
  dir: string,
  { limits = fileLimitsFromEnv(), temporary = false }: { limits?: FileLimits; temporary?: boolean } = {},
) {
  const { dbDeleteFile, dbExpiredFiles, dbFilesTotalSize, dbFindFile, dbListFiles, dbSaveFile } = db;
  const tickets = new Map<string, { id: string; expires: number }>();
  fs.mkdirSync(dir, { recursive: true });

  function filePath(id: string): string {
    return path.join(dir, id);
  }

  /** Stream an upload to disk. The request must say its size (Content-Length). */
  async function save(
    req: IncomingMessage,
    meta: { name: string; mimeType?: string; uploader: string; channel: string; ttlMs?: number },
  ): Promise<StoredFile> {
    const declared = Number(req.headers["content-length"]);
    if (!Number.isInteger(declared) || declared <= 0) {
      throw new FileError(411, "The upload must say its size (Content-Length) and not be empty");
    }
    if (declared > limits.maxFileBytes) {
      throw new FileError(
        413,
        `File too large: ${formatBytes(declared)} (at most ${formatBytes(limits.maxFileBytes)})`,
      );
    }
    const used = dbFilesTotalSize();
    if (used + declared > limits.quotaBytes) {
      throw new FileError(
        413,
        `Not enough room in this project's scratch space: ${formatBytes(used)} of ${formatBytes(limits.quotaBytes)} used`,
      );
    }

    const id = randomUUID();
    const temp = path.join(dir, `.upload-${id}`);
    let received = 0;
    const counter = new Transform({
      transform(chunk: Buffer, _enc, done) {
        received += chunk.length;
        if (received > declared) done(new FileError(400, "The upload is larger than it said"));
        else done(null, chunk);
      },
    });
    try {
      await pipeline(req, counter, fs.createWriteStream(temp));
      if (received !== declared) throw new FileError(400, "The upload ended early");
      fs.renameSync(temp, filePath(id));
    } catch (e) {
      fs.rmSync(temp, { force: true });
      throw e instanceof FileError ? e : new FileError(400, `Upload failed: ${(e as Error).message}`);
    }

    const now = Date.now();
    const file: StoredFile = {
      id,
      name: cleanName(meta.name),
      size: declared,
      mimeType: meta.mimeType || "application/octet-stream",
      uploader: meta.uploader,
      channel: meta.channel,
      createdAt: now,
      expiresAt: now + Math.min(meta.ttlMs ?? limits.ttlMs, limits.ttlMs),
    };
    dbSaveFile(file);
    return file;
  }

  /** A file that is still there, by id or a unique start of it. */
  function find(idOrPrefix: string): StoredFile | undefined {
    const file = dbFindFile(idOrPrefix);
    if (!file || file.expiresAt <= Date.now() || !fs.existsSync(filePath(file.id))) return undefined;
    return file;
  }

  function list(): StoredFile[] {
    const now = Date.now();
    return dbListFiles().filter((f) => f.expiresAt > now);
  }

  function remove(id: string): void {
    fs.rmSync(filePath(id), { force: true });
    dbDeleteFile(id);
  }

  /** Delete expired files and leftovers on disk that no file record knows. Returns the expired files. */
  function cleanup(now = Date.now()): StoredFile[] {
    const expired = dbExpiredFiles(now);
    for (const f of expired) remove(f.id);
    const known = new Set(dbListFiles().map((f) => f.id));
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (entry.startsWith(".upload-")) {
        if (now - fs.statSync(full).mtimeMs > ORPHAN_UPLOAD_MS) fs.rmSync(full, { force: true });
      } else if (!known.has(entry)) {
        fs.rmSync(full, { force: true, recursive: true });
      }
    }
    for (const [ticket, t] of tickets) if (t.expires <= now) tickets.delete(ticket);
    return expired;
  }

  /** A short-lived secret that lets a browser download a file with a plain link. */
  function createTicket(id: string): string {
    const ticket = randomBytes(24).toString("base64url");
    tickets.set(ticket, { id, expires: Date.now() + TICKET_MS });
    return ticket;
  }

  function redeemTicket(ticket: string): StoredFile | undefined {
    const t = tickets.get(ticket);
    if (!t || t.expires <= Date.now()) return undefined;
    return find(t.id);
  }

  function usage() {
    return { used: dbFilesTotalSize(), quota: limits.quotaBytes, maxFile: limits.maxFileBytes, ttlMs: limits.ttlMs };
  }

  /** Delete the whole scratch space (the project is being archived). */
  function destroy(): void {
    fs.rmSync(dir, { recursive: true, force: true });
  }

  return { save, find, list, remove, cleanup, createTicket, redeemTicket, usage, filePath, destroy, temporary };
}

export type FileStore = ReturnType<typeof createFileStore>;
