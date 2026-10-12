import http from "node:http";
import https from "node:https";

interface RequestOptions {
  method: string;
  path: string;
  token?: string;
  body?: unknown;
  timeoutMs?: number;
  /** Keep retrying for this long while the hub refuses connections (e.g. during a restart) */
  retryConnectMs?: number;
}

const CONNECT_RETRY_MS = 15_000;
// A host that is down (e.g. rebooting) doesn't refuse connections, they just hang
const CONNECT_TIMEOUT_MS = 10_000;

const UNREACHABLE_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "EPIPE",
  "ETIMEDOUT",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "EHOSTDOWN",
  "EAI_AGAIN",
]);

type NetError = NodeJS.ErrnoException & { errors?: unknown[] };

/** True when the hub could not be reached at all (down or restarting), as opposed to an HTTP error. */
export function isHubUnreachable(e: unknown): boolean {
  const err = e as NetError;
  if (UNREACHABLE_CODES.has(err?.code ?? "")) return true;
  // Node tries IPv4 and IPv6 addresses in parallel and reports the failures as one AggregateError
  return Array.isArray(err?.errors) && err.errors.some(isHubUnreachable);
}

/** True when the request failed before it reached the hub, so it is safe to send again. */
function isConnectFailure(e: unknown): boolean {
  const err = e as NetError;
  if (Array.isArray(err?.errors)) return err.errors.length > 0 && err.errors.every(isConnectFailure);
  return err?.syscall === "connect" || err?.syscall === "getaddrinfo";
}

interface HubResponse<T = unknown> {
  status: number;
  data: T;
}

export class HubClient {
  private baseUrl: URL;

  constructor(hubUrl: string) {
    this.baseUrl = new URL(hubUrl);
  }

  getBaseUrl(): string {
    return this.baseUrl.toString().replace(/\/$/, "");
  }

  private async request<T>(options: RequestOptions): Promise<HubResponse<T>> {
    const deadline = Date.now() + (options.retryConnectMs ?? CONNECT_RETRY_MS);
    for (;;) {
      try {
        return await this.requestOnce<T>(options);
      } catch (e) {
        // Only a failed connection is safe to retry: the request never reached the hub
        if (!isConnectFailure(e) || Date.now() >= deadline) throw e;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  private requestOnce<T>(options: RequestOptions): Promise<HubResponse<T>> {
    return new Promise((resolve, reject) => {
      const isHttps = this.baseUrl.protocol === "https:";
      const transport = isHttps ? https : http;

      const headers: Record<string, string> = {};
      if (options.token) {
        headers.Authorization = `Bearer ${options.token}`;
      }

      let bodyStr: string | undefined;
      if (options.body !== undefined) {
        bodyStr = JSON.stringify(options.body);
        headers["Content-Type"] = "application/json";
        headers["Content-Length"] = Buffer.byteLength(bodyStr).toString();
      }

      const req = transport.request(
        {
          hostname: this.baseUrl.hostname,
          port: this.baseUrl.port,
          path: options.path,
          method: options.method,
          headers,
          timeout: options.timeoutMs ?? 10_000,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => {
            const raw = Buffer.concat(chunks).toString();
            const status = res.statusCode ?? 0;
            if (status === 204 || raw.length === 0) {
              resolve({ status, data: {} as T });
              return;
            }
            try {
              resolve({ status, data: JSON.parse(raw) as T });
            } catch {
              reject(new Error(`Invalid JSON response: ${raw}`));
            }
          });
        },
      );

      const connectTimeout = (): NodeJS.ErrnoException => {
        const err: NodeJS.ErrnoException = new Error(`connect ETIMEDOUT ${this.baseUrl.host}`);
        err.code = "ETIMEDOUT";
        err.syscall = "connect";
        return err;
      };
      req.on("socket", (socket) => {
        if (!socket.connecting) return;
        const timer = setTimeout(() => req.destroy(connectTimeout()), CONNECT_TIMEOUT_MS);
        socket.once("connect", () => clearTimeout(timer));
        socket.once("close", () => clearTimeout(timer));
      });
      req.on("error", (e: NetError) => {
        // AggregateErrors have an empty message; always say what went wrong
        if (!e.message) {
          const codes = [...new Set((e.errors ?? []).map((x) => (x as NetError).code).filter(Boolean))];
          e.message = `cannot reach ${this.baseUrl.host} (${codes.join(", ") || e.code || e.name})`;
        }
        reject(e);
      });
      req.on("timeout", () => {
        // Still connecting: the hub's host isn't answering at all (retryable, see isConnectFailure)
        if (req.socket?.connecting) {
          req.destroy(connectTimeout());
          return;
        }
        req.destroy();
        reject(new Error("Request timed out"));
      });

      if (bodyStr) req.write(bodyStr);
      req.end();
    });
  }

  async register(name: string, joinToken: string, oldToken?: string): Promise<{ token: string; name: string }> {
    const body: { name: string; oldToken?: string } = { name };
    if (oldToken) body.oldToken = oldToken;
    const res = await this.request<{ token: string; name: string }>({
      method: "POST",
      path: "/register",
      token: joinToken,
      body,
    });
    if (res.status !== 200) {
      throw new Error((res.data as { error?: string }).error ?? "Registration failed");
    }
    return res.data;
  }

  async unregister(token: string): Promise<void> {
    await this.request({
      method: "POST",
      path: "/unregister",
      token,
    });
  }

  async send(
    token: string,
    to: string,
    content: string,
    channel?: string,
    image?: { data: string; mimeType: string },
  ): Promise<{ id: string; to: string }> {
    const body: { to: string; content: string; channel?: string; image?: { data: string; mimeType: string } } = {
      to,
      content,
    };
    if (channel) body.channel = channel;
    if (image) body.image = image;
    const res = await this.request<{ id: string; to: string }>({
      method: "POST",
      path: "/send",
      token,
      body,
    });
    if (res.status !== 200) {
      throw new Error((res.data as { error?: string }).error ?? "Send failed");
    }
    return res.data;
  }

  async poll(
    token: string,
    timeoutSec = 3600,
  ): Promise<{
    messages: Array<{
      id: string;
      from: string;
      fromRole?: string;
      to: string;
      content: string;
      channel: string;
      timestamp: number;
      image?: { data: string; mimeType: string };
    }>;
  } | null> {
    const res = await this.request<{
      messages: Array<{
        id: string;
        from: string;
        fromRole?: string;
        to: string;
        content: string;
        channel: string;
        timestamp: number;
        image?: { data: string; mimeType: string };
      }>;
    }>({
      method: "GET",
      path: `/poll?timeout=${timeoutSec}`,
      token,
      timeoutMs: (timeoutSec + 60) * 1000, // hub ends the poll first; 60 s margin
      retryConnectMs: 0, // radio_standby handles reconnecting itself
    });
    if (res.status === 204) return null;
    if (res.status !== 200) {
      throw new Error((res.data as { error?: string }).error ?? "Poll failed");
    }
    return res.data;
  }

  async inbox(token: string): Promise<{
    messages: Array<{
      id: string;
      from: string;
      fromRole?: string;
      to: string;
      content: string;
      channel: string;
      timestamp: number;
      image?: { data: string; mimeType: string };
    }>;
  }> {
    const res = await this.request<{
      messages: Array<{
        id: string;
        from: string;
        fromRole?: string;
        to: string;
        content: string;
        channel: string;
        timestamp: number;
        image?: { data: string; mimeType: string };
      }>;
    }>({
      method: "GET",
      path: "/inbox",
      token,
    });
    if (res.status !== 200) {
      throw new Error((res.data as { error?: string }).error ?? "Inbox fetch failed");
    }
    return res.data;
  }

  async users(token: string): Promise<Array<{ name: string; online: boolean; role: string }>> {
    const res = await this.request<{ users: Array<{ name: string; online: boolean; role: string }> }>({
      method: "GET",
      path: "/users",
      token,
    });
    if (res.status !== 200) {
      throw new Error((res.data as { error?: string }).error ?? "Failed to get users");
    }
    return res.data.users;
  }

  async listChannels(
    token: string,
  ): Promise<Array<{ name: string; memberCount: number; createdBy: string; description?: string }>> {
    const res = await this.request<{
      channels: Array<{ name: string; memberCount: number; createdBy: string; description?: string }>;
    }>({
      method: "GET",
      path: "/channels",
      token,
    });
    if (res.status !== 200) {
      throw new Error((res.data as { error?: string }).error ?? "Failed to list channels");
    }
    return res.data.channels;
  }

  async createChannel(token: string, name: string, description?: string): Promise<{ channel: string }> {
    const res = await this.request<{ ok: boolean; channel: string }>({
      method: "POST",
      path: "/channel-create",
      token,
      body: { name, description },
    });
    if (res.status !== 200) {
      throw new Error((res.data as { error?: string }).error ?? "Failed to create channel");
    }
    return { channel: res.data.channel };
  }

  async joinChannel(token: string, channel: string): Promise<void> {
    const res = await this.request({
      method: "POST",
      path: "/channel-join",
      token,
      body: { channel },
    });
    if (res.status !== 200) {
      throw new Error((res.data as { error?: string }).error ?? "Failed to join channel");
    }
  }

  async leaveChannel(token: string, channel: string): Promise<void> {
    const res = await this.request({
      method: "POST",
      path: "/channel-leave",
      token,
      body: { channel },
    });
    if (res.status !== 200) {
      throw new Error((res.data as { error?: string }).error ?? "Failed to leave channel");
    }
  }

  async inviteToChannel(token: string, channel: string, user: string): Promise<void> {
    const res = await this.request({
      method: "POST",
      path: "/channel-invite",
      token,
      body: { channel, user },
    });
    if (res.status !== 200) {
      throw new Error((res.data as { error?: string }).error ?? "Failed to invite user to channel");
    }
  }
}
