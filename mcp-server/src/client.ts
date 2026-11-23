import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";

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
// File transfers can take long; give up only when nothing moves for this long
const FILE_IDLE_TIMEOUT_MS = 120_000;

/** A file in the project's scratch space. */
export interface SharedFile {
  id: string;
  name: string;
  size: number;
  uploader: string;
  channel: string;
  createdAt: number;
  expiresAt: number;
}
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
  // A path in the hub URL selects a project, e.g. http://hub:9559/p/myproject
  private basePath: string;

  constructor(hubUrl: string) {
    this.baseUrl = new URL(hubUrl);
    this.basePath = this.baseUrl.pathname.replace(/\/+$/, "");
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
          path: this.basePath + options.path,
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

  /** A request whose body or answer is streamed (files); no overall timeout, only an idle one. */
  private streamRequest(method: string, pathAndQuery: string, token: string, headers: Record<string, string> = {}) {
    const transport = this.baseUrl.protocol === "https:" ? https : http;
    return transport.request({
      hostname: this.baseUrl.hostname,
      port: this.baseUrl.port,
      path: this.basePath + pathAndQuery,
      method,
      headers: { Authorization: `Bearer ${token}`, ...headers },
      timeout: FILE_IDLE_TIMEOUT_MS,
    });
  }

  /** Upload a local file to the project's scratch space; the hub announces it in the channel. */
  uploadFile(token: string, filePath: string, query: Record<string, string>): Promise<SharedFile> {
    const size = fs.statSync(filePath).size;
    const params = new URLSearchParams({ name: path.basename(filePath), ...query });
    return new Promise((resolve, reject) => {
      const req = this.streamRequest("POST", `/file-upload?${params}`, token, {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(size),
      });
      req.on("response", (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          let data: SharedFile & { error?: string };
          try {
            data = JSON.parse(Buffer.concat(chunks).toString());
          } catch {
            return reject(new Error(`Upload failed (HTTP ${res.statusCode})`));
          }
          if (res.statusCode !== 200) reject(new Error(data.error ?? `Upload failed (HTTP ${res.statusCode})`));
          else resolve(data);
        });
      });
      req.on("timeout", () => req.destroy(new Error("Upload stalled")));
      req.on("error", reject);
      fs.createReadStream(filePath).on("error", reject).pipe(req);
    });
  }

  /**
   * Download a scratch space file. `dest` is a file path or an existing folder (default: the
   * current folder); the file keeps its name in a folder. Resolves to where it was saved.
   */
  downloadFile(token: string, id: string, dest?: string): Promise<{ path: string; size: number }> {
    return new Promise((resolve, reject) => {
      const req = this.streamRequest("GET", `/file-download?id=${encodeURIComponent(id)}`, token);
      req.on("response", (res) => {
        if (res.statusCode !== 200) {
          const chunks: Buffer[] = [];
          res.on("data", (c: Buffer) => chunks.push(c));
          res.on("end", () => {
            let error = `Download failed (HTTP ${res.statusCode})`;
            try {
              error = JSON.parse(Buffer.concat(chunks).toString()).error ?? error;
            } catch {}
            reject(new Error(error));
          });
          return;
        }
        const disposition = res.headers["content-disposition"] ?? "";
        const match = /filename\*=UTF-8''([^;]+)/.exec(disposition);
        const name = path.basename(match ? decodeURIComponent(match[1]) : id);
        const target = path.resolve(
          dest && !(fs.existsSync(dest) && fs.statSync(dest).isDirectory()) ? dest : path.join(dest ?? ".", name),
        );
        const partial = `${target}.part`;
        const out = fs.createWriteStream(partial);
        res.pipe(out);
        out.on("finish", () => {
          fs.renameSync(partial, target);
          resolve({ path: target, size: fs.statSync(target).size });
        });
        const fail = (e: Error) => {
          out.destroy();
          fs.rmSync(partial, { force: true });
          reject(e);
        };
        out.on("error", fail);
        res.on("error", fail);
      });
      req.on("timeout", () => req.destroy(new Error("Download stalled")));
      req.on("error", reject);
      req.end();
    });
  }

  async listFiles(token: string): Promise<{ files: SharedFile[]; used: number; quota: number; maxFile: number }> {
    const res = await this.request<{ files: SharedFile[]; used: number; quota: number; maxFile: number }>({
      method: "GET",
      path: "/files",
      token,
    });
    if (res.status !== 200) throw new Error((res.data as { error?: string }).error ?? "Listing files failed");
    return res.data;
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
    replyTo?: string,
  ): Promise<{ id: string; to: string }> {
    const body: {
      to: string;
      content: string;
      channel?: string;
      image?: { data: string; mimeType: string };
      replyTo?: string;
    } = { to, content };
    if (channel) body.channel = channel;
    if (image) body.image = image;
    if (replyTo) body.replyTo = replyTo;
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

  /** Change (content given) or retract (no content) one of your own messages. */
  async changeMessage(token: string, id: string, channel?: string, content?: string): Promise<{ id: string }> {
    const res = await this.request<{ id: string }>({
      method: "POST",
      path: content === undefined ? "/message-retract" : "/message-edit",
      token,
      body: { id, channel, content },
    });
    if (res.status !== 200) {
      throw new Error((res.data as { error?: string }).error ?? "Request failed");
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
      replyTo?: string;
      editedAt?: number;
      file?: { id: string; name: string; size: number };
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
        replyTo?: string;
        editedAt?: number;
        file?: { id: string; name: string; size: number };
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
      replyTo?: string;
      editedAt?: number;
      file?: { id: string; name: string; size: number };
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
        replyTo?: string;
        editedAt?: number;
        file?: { id: string; name: string; size: number };
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
