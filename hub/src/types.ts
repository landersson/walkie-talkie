import type { IncomingMessage, ServerResponse } from "node:http";

/** A scratch space file attached to a message. */
export interface MessageFile {
  id: string;
  name: string;
  size: number;
}

/** A file in a project's scratch space (stored on disk, deleted when it expires). */
export interface StoredFile {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  uploader: string;
  channel: string;
  createdAt: number;
  expiresAt: number;
}

export interface MessageImage {
  data: string; // base64 (no data-URI prefix)
  mimeType: string; // e.g. "image/png"
}

export interface Message {
  id: string;
  from: string;
  to: string;
  content: string;
  channel: string;
  timestamp: number;
  image?: MessageImage;
  file?: MessageFile; // a file in the project's scratch space
  fromRole?: UserRole; // sender's role at send time (not persisted)
  seq?: number; // storage order (SQLite rowid), set on history reads
  replyTo?: string; // id of the message this one replies to (same channel)
  editedAt?: number; // set when the sender changed the text
  retracted?: boolean; // the sender took it back; content and image are gone
}

export type UserRole = "agent" | "bridge" | "human";

/** Where an agent runs, as its MCP server reports it when joining (shown on the dashboard). */
export interface ClientInfo {
  /** Short hostname */
  host?: string;
  /** Walkie-Talkie plugin version */
  version?: string;
}

export interface User {
  name: string;
  token: string;
  role: UserRole;
  registeredAt: number;
  client?: ClientInfo;
}

export interface RegisterRequest {
  name: string;
  oldToken?: string;
  role?: UserRole;
  client?: ClientInfo;
}

export interface RegisterResponse {
  token: string;
  name: string;
}

export interface SendRequest {
  to: string;
  content: string;
  channel?: string;
  image?: MessageImage;
  replyTo?: string; // id (or a unique start of it) of a message in the same channel
}

export interface Channel {
  name: string;
  createdBy: string;
  createdAt: number;
}

export interface SendResponse {
  id: string;
  to: string;
}

export interface PollResponse {
  messages: Message[];
}

export interface UsersResponse {
  users: string[];
}

export interface ErrorResponse {
  error: string;
}

export type PendingPoll = {
  userName: string;
  res: ServerResponse;
  timer: ReturnType<typeof setTimeout>;
};

export type RouteHandler = (req: IncomingMessage, res: ServerResponse, userName?: string) => Promise<void>;
