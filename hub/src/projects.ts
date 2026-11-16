import fs from "node:fs";
import path from "node:path";

/** The project that unprefixed routes and the original database belong to. */
export const DEFAULT_PROJECT = "default";

const PROJECT_NAME_RE = /^[a-zA-Z0-9_-]{1,32}$/;
const RESERVED_PROJECT_NAMES = new Set(["archive", "p"]);
const ARCHIVE_DIR = "archive";

/** Returns why `name` can't be a project name, or null if it can. */
export function validateProjectName(name: string): string | null {
  if (!PROJECT_NAME_RE.test(name)) {
    return `Invalid project name "${name}" (use letters, digits, - or _, max 32)`;
  }
  if (RESERVED_PROJECT_NAMES.has(name)) return `"${name}" is reserved`;
  return null;
}

export function projectDbPath(dir: string, name: string): string {
  return path.join(dir, `${name}.db`);
}

/** Names of the projects stored in `dir` (one `<name>.db` each). */
export function listProjectNames(dir: string): string[] {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".db"))
    .map((f) => f.slice(0, -3))
    .filter((name) => name !== DEFAULT_PROJECT && !validateProjectName(name))
    .sort((a, b) => a.localeCompare(b));
}

/**
 * Move a closed project's database (and any leftover WAL files) to `dir/archive/`, named
 * `<name>-<YYYYMMDD-HHMMSS>.db`. Returns the new path of the database.
 */
export function archiveProjectFiles(dir: string, name: string, now = new Date()): string {
  const archiveDir = path.join(dir, ARCHIVE_DIR);
  fs.mkdirSync(archiveDir, { recursive: true });
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-` +
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  let target = path.join(archiveDir, `${name}-${stamp}.db`);
  for (let i = 2; fs.existsSync(target); i++) target = path.join(archiveDir, `${name}-${stamp}-${i}.db`);
  const source = projectDbPath(dir, name);
  fs.renameSync(source, target);
  for (const suffix of ["-wal", "-shm"]) {
    if (fs.existsSync(source + suffix)) fs.renameSync(source + suffix, target + suffix);
  }
  return target;
}
