import { type Auth, createAuth } from "./auth.js";
import { type Channels, createChannels } from "./channels.js";
import { openProjectDB, type ProjectDB } from "./db.js";
import { createEventStream, type EventStream } from "./events.js";
import { createFileStore, type FileStore, filesDirFor } from "./files.js";
import { createPolling, type Polling } from "./polling.js";
import { createRouter, type Router } from "./router.js";

/** The state of one project: its database, users, channels, queues, polls and dashboard stream. */
export interface Project {
  name: string;
  db: ProjectDB;
  auth: Auth;
  channels: Channels;
  polling: Polling;
  router: Router;
  events: EventStream;
  files: FileStore;
}

export function createProject(name: string, dbPath: string): Project {
  const db = openProjectDB(dbPath);
  const channels = createChannels(db);
  const auth = createAuth(db, channels);
  // Polls drain the router's queues; the router exists by the time the first poll arrives
  const polling = createPolling((userName) => router.drainQueue(userName));
  const router = createRouter(db, auth, channels, polling);
  const events = createEventStream();
  const files = createFileStore(db, filesDirFor(dbPath, name), { temporary: dbPath === ":memory:" });
  return { name, db, auth, channels, polling, router, events, files };
}
