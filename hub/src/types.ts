import type { IncomingMessage, ServerResponse } from "node:http";

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
  fromRole?: UserRole; // sender's role at send time (not persisted)
  seq?: number; // storage order (SQLite rowid), set on history reads
  replyTo?: string; // id of the message this one replies to (same channel)
  editedAt?: number; // set when the sender changed the text
  retracted?: boolean; // the sender took it back; content and image are gone
}

export type UserRole = "agent" | "bridge" | "human";

export interface User {
  name: string;
  token: string;
  role: UserRole;
  registeredAt: number;
}

export interface RegisterRequest {
  name: string;
  oldToken?: string;
  role?: UserRole;
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
