import { randomUUID } from "node:crypto";
import type { Auth } from "./auth.js";
import type { Channels } from "./channels.js";
import type { ProjectDB } from "./db.js";
import type { Polling } from "./polling.js";
import type { Message, MessageImage } from "./types.js";

export function createRouter(db: ProjectDB, auth: Auth, channels: Channels, polling: Polling) {
  const { getUserRole, getUsersByRole, isUserRegistered } = auth;
  const { getChannelMembers, isChannelMember } = channels;
  const { dbFindChannelMessage, dbGetChannel, dbSaveMessage } = db;
  const { deliverMessage } = polling;
  const messageQueues = new Map<string, Message[]>();

  function ensureQueue(name: string): void {
    if (!messageQueues.has(name)) {
      messageQueues.set(name, []);
    }
  }

  /** Snapshot of all non-empty queues, e.g. to save them before a restart. */
  function getAllQueues(): Map<string, Message[]> {
    return new Map([...messageQueues].filter(([, q]) => q.length > 0).map(([n, q]) => [n, [...q]]));
  }

  function removeQueue(name: string): void {
    messageQueues.delete(name);
  }

  function drainQueue(name: string): Message[] {
    const queue = messageQueues.get(name);
    if (!queue || queue.length === 0) return [];
    const messages = [...queue];
    queue.length = 0;
    return messages;
  }

  function routeMessage(
    from: string,
    to: string,
    content: string,
    channel = "#all",
    image?: MessageImage,
    replyToId?: string,
  ): Message {
    if (!dbGetChannel(channel)) {
      throw new Error(`Channel "${channel}" does not exist`);
    }
    // A reply names a message of the same channel, by id or a unique start of it
    let replyTo: string | undefined;
    if (replyToId) {
      const parent = dbFindChannelMessage(channel, replyToId);
      if (!parent) throw new Error(`No message "${replyToId}" in ${channel} to reply to`);
      replyTo = parent.replyTo ?? parent.id; // replies to a reply join the same thread
    }
    const members = getChannelMembers(channel);
    const senderRole = getUserRole(from) ?? undefined;

    if (to === "@all") {
      const message: Message = {
        id: randomUUID(),
        from,
        to: "@all",
        content,
        channel,
        timestamp: Date.now(),
        image,
        fromRole: senderRole,
        replyTo,
      };

      dbSaveMessage(message);

      // Deliver to all channel members except sender.
      // When a bridge sends @all, skip other bridges to avoid relay loops.
      // Humans read everything from the dashboard event stream, so they get no queue.
      for (const user of members) {
        if (user === from) continue;
        if (getUserRole(user) === "human") continue;
        if (senderRole === "bridge" && getUserRole(user) === "bridge") continue;
        enqueueAndDeliver(user, message);
      }
      return message;
    }

    const targetName = to.startsWith("@") ? to.slice(1) : to;

    if (!isUserRegistered(targetName)) {
      throw new Error(`User "${targetName}" is not connected`);
    }

    // Humans see every channel on the dashboard, so they can be addressed from any channel
    if (getUserRole(targetName) !== "human" && !isChannelMember(channel, targetName)) {
      throw new Error(`User "${targetName}" is not a member of ${channel}`);
    }

    const message: Message = {
      id: randomUUID(),
      from,
      to: targetName,
      content,
      channel,
      timestamp: Date.now(),
      image,
      fromRole: senderRole,
      replyTo,
    };

    dbSaveMessage(message);

    // Deliver to all channel members except sender
    for (const user of members) {
      if (user !== from && getUserRole(user) !== "human") {
        enqueueAndDeliver(user, message);
      }
    }
    return message;
  }

  function enqueueAndDeliver(targetName: string, message: Message): void {
    ensureQueue(targetName);
    const queue = messageQueues.get(targetName)!;
    queue.push(message);
    deliverMessage(targetName);
  }

  function notifyBridges(content: string): void {
    const bridges = getUsersByRole("bridge");
    const message: Message = {
      id: randomUUID(),
      from: "system",
      to: "@bridges",
      content,
      channel: "#all",
      timestamp: Date.now(),
    };
    for (const bridge of bridges) {
      enqueueAndDeliver(bridge, message);
    }
  }

  return {
    ensureQueue,
    getAllQueues,
    removeQueue,
    drainQueue,
    routeMessage,
    enqueueAndDeliver,
    notifyBridges,
  };
}

export type Router = ReturnType<typeof createRouter>;
