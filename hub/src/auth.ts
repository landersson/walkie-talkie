import { randomBytes } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { Channels } from "./channels.js";
import type { ProjectDB } from "./db.js";
import type { User, UserRole } from "./types.js";

export function createAuth(db: ProjectDB, channels: Channels) {
  const { dbDeleteSession, dbSaveSession } = db;
  const { removeUserFromAllChannels } = channels;
  const users = new Map<string, User>();
  const tokenToName = new Map<string, string>();

  function getUserToken(name: string): string | null {
    return users.get(name)?.token ?? null;
  }

  function registerUser(name: string, role: UserRole = "agent"): User {
    if (users.has(name)) {
      throw new Error(`User "${name}" is already registered`);
    }
    const token = randomBytes(32).toString("hex");
    const user: User = { name, token, role, registeredAt: Date.now() };
    users.set(name, user);
    tokenToName.set(token, name);
    // Agents and bridges keep their token across hub restarts; humans re-register on reconnect
    if (role !== "human") dbSaveSession(name, token, role, user.registeredAt);
    return user;
  }

  /** Re-adds a session saved before a hub restart (see dbListSessions). */
  function restoreUser(user: User): void {
    users.set(user.name, user);
    tokenToName.set(user.token, user.name);
  }

  function unregisterUser(name: string): void {
    const user = users.get(name);
    if (user) {
      tokenToName.delete(user.token);
      users.delete(name);
      dbDeleteSession(name);
      removeUserFromAllChannels(name);
    }
  }

  function authenticateRequest(req: IncomingMessage): string | null {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) return null;
    const token = auth.slice(7);
    return tokenToName.get(token) ?? null;
  }

  function getRegisteredUsers(): string[] {
    return Array.from(users.keys());
  }

  function getUserRole(name: string): UserRole | null {
    return users.get(name)?.role ?? null;
  }

  function getUsersByRole(role: UserRole): string[] {
    return Array.from(users.values())
      .filter((u) => u.role === role)
      .map((u) => u.name);
  }

  function isUserRegistered(name: string): boolean {
    return users.has(name);
  }

  return {
    getUserToken,
    registerUser,
    restoreUser,
    unregisterUser,
    authenticateRequest,
    getRegisteredUsers,
    getUserRole,
    getUsersByRole,
    isUserRegistered,
  };
}

export type Auth = ReturnType<typeof createAuth>;
