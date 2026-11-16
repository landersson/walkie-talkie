import { type Auth, createAuth } from "./auth.js";
import { type Channels, createChannels } from "./channels.js";
import { openProjectDB, type ProjectDB } from "./db.js";
import { createEventStream, type EventStream } from "./events.js";
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
}

export function createProject(name: string, dbPath: string): Project {
  const db = openProjectDB(dbPath);
  const channels = createChannels(db);
  const auth = createAuth(db, channels);
  // Polls drain queues and the router delivers to polls, so the router is bound late
  let router: Router | undefined;
  const polling = createPolling((userName) => router!.drainQueue(userName));
  router = createRouter(db, auth, channels, polling);
  const events = createEventStream();
  channels.initGeneralChannel();
  return { name, db, auth, channels, polling, router, events };
}
