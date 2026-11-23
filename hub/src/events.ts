import type { ServerResponse } from "node:http";

export type HubEvent =
  | {
      type: "message";
      id: string;
      from: string;
      to: string;
      content: string;
      channel: string;
      timestamp: number;
      image?: { data: string; mimeType: string };
      file?: { id: string; name: string; size: number };
      fromRole?: "agent" | "bridge" | "human";
      replyTo?: string;
    }
  | {
      type: "message_update";
      id: string;
      channel: string;
      content?: string;
      editedAt?: number;
      retracted?: boolean;
      timestamp: number;
    }
  | { type: "files_change"; timestamp: number }
  | {
      type: "join";
      name: string;
      role?: "agent" | "bridge" | "human";
      client?: { host?: string; version?: string };
      timestamp: number;
    }
  | { type: "leave"; name: string; timestamp: number }
  | { type: "channel_create"; name: string; timestamp: number }
  | { type: "channel_join"; channel: string; userName: string; timestamp: number }
  | { type: "channel_leave"; channel: string; userName: string; timestamp: number }
  | { type: "channel_delete"; name: string; timestamp: number }
  | { type: "channel_update"; name: string; description: string; by: string; timestamp: number }
  | { type: "status"; name: string; online: boolean; timestamp: number }
  | { type: "typing"; name: string; channel: string; timestamp: number }
  | { type: "read_update"; userName: string; channel: string; timestamp: number }
  | { type: "agent_config_create"; id: string; name: string; timestamp: number }
  | { type: "agent_config_update"; id: string; name: string; timestamp: number }
  | { type: "agent_config_delete"; id: string; timestamp: number };

const HEARTBEAT_INTERVAL_MS = 30_000; // 30 seconds

/** One live event stream (Server-Sent Events) with its own set of dashboard clients. */
export function createEventStream<E = HubEvent>() {
  const clients = new Set<ServerResponse>();
  const listeners = new Set<(event: E) => void>();
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  function startHeartbeat(): void {
    if (heartbeatTimer) return;
    heartbeatTimer = setInterval(() => {
      for (const client of clients) {
        client.write(":\n\n");
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  function stopHeartbeat(): void {
    if (heartbeatTimer && clients.size === 0) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  function addSSEClient(res: ServerResponse, onClose?: () => void): void {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.write("\n");
    clients.add(res);
    startHeartbeat();
    res.on("close", () => {
      clients.delete(res);
      stopHeartbeat();
      onClose?.();
    });
  }

  function closeAllSSEClients(): void {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    for (const client of clients) {
      client.end();
    }
    clients.clear();
  }

  function broadcast(event: E): void {
    if (clients.size > 0) {
      const data = JSON.stringify(event);
      for (const client of clients) {
        client.write(`data: ${data}\n\n`);
      }
    }
    for (const listener of listeners) listener(event);
  }

  /** Sends `event` to one client of this stream only. */
  function send(client: ServerResponse, event: E): void {
    client.write(`data: ${JSON.stringify(event)}\n\n`);
  }

  /** Calls `listener` with every event broadcast on this stream; returns an unsubscribe function. */
  function subscribe(listener: (event: E) => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return { addSSEClient, closeAllSSEClients, broadcast, send, subscribe };
}

export type EventStream<E = HubEvent> = ReturnType<typeof createEventStream<E>>;
