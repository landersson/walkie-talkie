import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { HubClient, isHubUnreachable } from "./client.js";

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

// Humans (dashboard users) are marked so agents know whose instructions to act on
function senderLabel(m: { from: string; fromRole?: string }): string {
  return m.fromRole === "human" ? `${m.from} (human)` : m.from;
}

function getMimeType(source: string): string {
  const ext = path.extname(source).toLowerCase();
  return MIME_TYPES[ext] ?? "image/png";
}

function fetchUrl(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const transport = url.startsWith("https") ? https : http;
    transport
      .get(url, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          fetchUrl(res.headers.location).then(resolve, reject);
          return;
        }
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

let client: HubClient;
let joinToken: string;
let currentToken: string | null = null;
let currentName: string | null = null;

// Tokens are saved per hub and name, so a restarted MCP server (e.g. after /mcp reconnect)
// can take its name back instead of finding it held by its own previous session.
const SESSIONS_FILE = path.join(
  process.env.XDG_STATE_HOME || path.join(os.homedir(), ".local", "state"),
  "walkie-talkie",
  "mcp-sessions.json",
);

function sessionKey(name: string): string {
  return `${client.getBaseUrl()} ${name}`;
}

function readSavedSessions(): Record<string, string> {
  try {
    return JSON.parse(fs.readFileSync(SESSIONS_FILE, "utf8")) as Record<string, string>;
  } catch {
    return {};
  }
}

function writeSavedSessions(sessions: Record<string, string>): void {
  try {
    fs.mkdirSync(path.dirname(SESSIONS_FILE), { recursive: true, mode: 0o700 });
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2), { mode: 0o600 });
  } catch (e) {
    console.error(`[walkie-talkie] Could not save session: ${(e as Error).message}`);
  }
}

function startSession(name: string, token: string): void {
  currentName = name;
  currentToken = token;
  writeSavedSessions({ ...readSavedSessions(), [sessionKey(name)]: token });
}

/** Forget the current session (signed off or disconnected by the hub). */
function endSession(): void {
  if (currentName) {
    const sessions = readSavedSessions();
    delete sessions[sessionKey(currentName)];
    writeSavedSessions(sessions);
  }
  currentToken = null;
  currentName = null;
}

type PolledMessage = NonNullable<Awaited<ReturnType<HubClient["poll"]>>>["messages"][number];

// Messages that arrived for a radio_standby call the client had already given up on
// (interrupted or timed out). They are handed out by the next radio_standby/radio_check.
let stashedMessages: PolledMessage[] = [];

function takeStashed(): PolledMessage[] {
  const messages = stashedMessages;
  stashedMessages = [];
  return messages;
}

const STANDBY_DEFAULT_SECONDS = 600;
const STANDBY_PROGRESS_INTERVAL_MS = 30_000;
const RECONNECT_DELAY_MS = 1000;
// Only the newest radio_standby call keeps polling; an older one still running (e.g. moved to
// the background) gives up, so the two don't keep ending each other's polls on the hub.
let standbyGeneration = 0;

function registrationError(e: unknown): string {
  const msg = (e as Error).message;
  if (msg === "Join token required") {
    return `The hub at ${client.getBaseUrl()} rejected the join token. Check that WALKIE_TALKIE_JOIN_TOKEN matches the hub's join token.`;
  }
  return msg;
}

// The hub announces a restart with a RADIO_RESTART system message. The plugin handles it
// (keeps waiting and reconnects), so the agent never sees it.
function isRestartNotice(m: { from: string; content: string }): boolean {
  return m.from === "system" && m.content.startsWith("RADIO_RESTART:");
}

/**
 * Wait for messages until one arrives or `timeoutSec` has passed. Rides out hub restarts:
 * retries while the hub is unreachable, and re-registers under the same name if the hub
 * came back without our session.
 */
async function waitForMessages(timeoutSec: number, signal: AbortSignal): Promise<PolledMessage[] | "unreachable"> {
  const deadline = Date.now() + timeoutSec * 1000;
  const generation = ++standbyGeneration;
  let reconnecting = false;
  while (!signal.aborted && generation === standbyGeneration) {
    const remainingSec = Math.ceil((deadline - Date.now()) / 1000);
    if (remainingSec <= 0) break;
    try {
      const result = await client.poll(currentToken!, remainingSec);
      if (reconnecting) console.error("[walkie-talkie] Reconnected to the hub");
      reconnecting = false;
      const messages = (result?.messages ?? []).filter((m) => !isRestartNotice(m));
      if (messages.length > 0) return messages;
      if (result && result.messages.length > 0) {
        console.error("[walkie-talkie] Hub is restarting, waiting for it to come back");
        reconnecting = true;
        continue;
      }
      // An empty poll before the deadline means the hub ended it early (e.g. shutting down)
      if (!result && Date.now() < deadline - 1000) continue;
      break;
    } catch (e) {
      if (isHubUnreachable(e)) {
        reconnecting = true;
      } else if ((e as Error).message === "Unauthorized" && reconnecting && currentName) {
        // The hub came back without our session: take our name again
        const reg = await client.register(currentName, joinToken, currentToken ?? undefined);
        startSession(reg.name, reg.token);
        console.error(`[walkie-talkie] Re-registered as "${reg.name}" after hub restart`);
        continue;
      } else {
        throw e;
      }
      await new Promise((resolve) => setTimeout(resolve, Math.min(RECONNECT_DELAY_MS, deadline - Date.now())));
    }
  }
  return reconnecting ? "unreachable" : [];
}

export function createMcpServer(hubUrl: string, joinTok: string): McpServer {
  client = new HubClient(hubUrl);
  joinToken = joinTok;

  const server = new McpServer({
    name: "walkie-talkie",
    version: "1.0.0",
  });

  server.tool(
    "radio_join",
    "Join the Walkie-Talkie hub with a display name. You must join before using other radio tools.",
    { name: z.string().describe("Your display name for this session") },
    async ({ name }) => {
      if (!joinToken) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Cannot join: the WALKIE_TALKIE_JOIN_TOKEN environment variable is not set for the walkie-talkie MCP server. Ask the user to set it to the hub's join token (e.g. in their shell profile) and restart Claude Code.",
            },
          ],
          isError: true,
        };
      }
      try {
        const oldToken = currentToken ?? readSavedSessions()[sessionKey(name)];
        const result = await client.register(name, joinToken, oldToken);
        startSession(result.name, result.token);
        return {
          content: [
            {
              type: "text" as const,
              text: `Registered as "${currentName}". You are now in #all. You can now send and receive messages.`,
            },
          ],
        };
      } catch (e) {
        return {
          content: [{ type: "text" as const, text: `Registration failed: ${registrationError(e)}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "radio_over",
    "Send a message to another user. Use @name format for the recipient, or @all to broadcast. Messages are scoped to a channel.",
    {
      to: z.string().describe("Recipient: @name or @all"),
      message: z.string().describe("Message content"),
      channel: z
        .string()
        .optional()
        .describe(
          "Channel to send to. IMPORTANT: Always reply in the same channel where you received the message. Defaults to #all if omitted.",
        ),
      image_data: z
        .string()
        .optional()
        .describe("Base64-encoded image data. Must be provided together with image_mime_type."),
      image_mime_type: z
        .string()
        .optional()
        .describe("MIME type of the image (e.g. 'image/png'). Must be provided together with image_data."),
    },
    async ({ to, message, channel, image_data, image_mime_type }) => {
      if (!currentToken) {
        return {
          content: [{ type: "text" as const, text: "Not on the air. Use radio_join first." }],
          isError: true,
        };
      }
      try {
        const image = image_data && image_mime_type ? { data: image_data, mimeType: image_mime_type } : undefined;
        const result = await client.send(currentToken, to, message, channel, image);
        return {
          content: [
            {
              type: "text" as const,
              text: `Message sent to ${result.to} in ${channel || "#all"} (id: ${result.id})`,
            },
          ],
        };
      } catch (e) {
        return {
          content: [{ type: "text" as const, text: `Send failed: ${(e as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "radio_send_image",
    "Send an image from a local file path or URL. Much faster than passing base64 via radio_over.",
    {
      to: z.string().describe("Recipient: @name or @all"),
      source: z.string().describe("Image file path or URL (http/https)"),
      message: z.string().optional().describe("Optional text message to accompany the image"),
      channel: z.string().optional().describe("Channel to send to (default: #all)"),
    },
    async ({ to, source, message, channel }) => {
      if (!currentToken) {
        return {
          content: [{ type: "text" as const, text: "Not on the air. Use radio_join first." }],
          isError: true,
        };
      }
      try {
        let buf: Buffer;
        if (source.startsWith("http://") || source.startsWith("https://")) {
          buf = await fetchUrl(source);
        } else {
          buf = fs.readFileSync(source);
        }
        const data = buf.toString("base64");
        const mimeType = getMimeType(source);
        const result = await client.send(currentToken, to, message ?? "", channel, { data, mimeType });
        return {
          content: [
            {
              type: "text" as const,
              text: `Image sent to ${result.to} in ${channel || "#all"} (id: ${result.id})`,
            },
          ],
        };
      } catch (e) {
        return {
          content: [{ type: "text" as const, text: `Failed to send image: ${(e as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "radio_check",
    "Check for new messages immediately without waiting. Returns any queued messages instantly. Use this instead of radio_standby when you want to poll periodically with sleep in between.",
    {},
    async () => {
      if (!currentToken) {
        return {
          content: [{ type: "text" as const, text: "Not on the air. Use radio_join first." }],
          isError: true,
        };
      }
      try {
        const inbox = await client.inbox(currentToken);
        const result = { messages: [...takeStashed(), ...inbox.messages].filter((m) => !isRestartNotice(m)) };
        if (result.messages.length === 0) {
          return {
            content: [{ type: "text" as const, text: "No new messages." }],
          };
        }
        const killed = result.messages.find((m) => m.content.startsWith("RADIO_KILLED:"));
        if (killed) {
          endSession();
          return {
            content: [
              {
                type: "text" as const,
                text: "RADIO_KILLED: You have been disconnected by the operator. Do NOT call any more radio tools. Stop immediately.",
              },
            ],
            isError: true,
          };
        }
        const contentBlocks: Array<{ type: "text"; text: string } | { type: "image"; data: string; mimeType: string }> =
          [];
        for (const m of result.messages) {
          if (m.image) {
            contentBlocks.push({
              type: "image" as const,
              data: m.image.data,
              mimeType: m.image.mimeType,
            });
          }
          const imageTag = m.image ? " [image attached]" : "";
          const line = `[${new Date(m.timestamp).toLocaleTimeString()}] ${m.channel || "#all"} ${senderLabel(m)} → ${m.to}: ${m.content}${imageTag}`;
          contentBlocks.push({ type: "text" as const, text: line });
        }
        const channels = [
          ...new Set(result.messages.filter((m) => m.channel && m.channel !== "#all").map((m) => m.channel)),
        ];
        if (channels.length > 0) {
          contentBlocks.push({
            type: "text" as const,
            text: `\nIMPORTANT: Reply in the same channel you received the message on. Use the channel parameter: ${channels.map((c) => `"${c}"`).join(", ")}`,
          });
        }
        return { content: contentBlocks };
      } catch (e) {
        return {
          content: [{ type: "text" as const, text: `Check failed: ${(e as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "radio_standby",
    `Stand by for incoming messages using long polling. Returns as soon as a message arrives, or with "No new messages" after timeout_seconds (default ${STANDBY_DEFAULT_SECONDS}). Sends progress notifications while waiting.`,
    {
      timeout_seconds: z
        .number()
        .int()
        .min(1)
        .max(3600)
        .optional()
        .describe(`Maximum seconds to wait for a message (default ${STANDBY_DEFAULT_SECONDS}, max 3600)`),
    },
    async ({ timeout_seconds }, extra) => {
      if (!currentToken) {
        return {
          content: [{ type: "text" as const, text: "Not on the air. Use radio_join first." }],
          isError: true,
        };
      }
      try {
        let result: { messages: PolledMessage[] } | null;
        const stashed = takeStashed();
        if (stashed.length > 0) {
          result = { messages: stashed };
        } else {
          // Progress notifications keep the client's idle timeout from aborting a long wait
          const progressToken = extra._meta?.progressToken;
          const started = Date.now();
          const progressTimer =
            progressToken === undefined
              ? undefined
              : setInterval(() => {
                  extra
                    .sendNotification({
                      method: "notifications/progress",
                      params: {
                        progressToken,
                        progress: Math.round((Date.now() - started) / 1000),
                        message: "Waiting for messages",
                      },
                    })
                    .catch(() => {});
                }, STANDBY_PROGRESS_INTERVAL_MS);
          let waited: PolledMessage[] | "unreachable";
          try {
            waited = await waitForMessages(timeout_seconds ?? STANDBY_DEFAULT_SECONDS, extra.signal);
          } finally {
            clearInterval(progressTimer);
          }
          if (waited === "unreachable") {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `The hub at ${client.getBaseUrl()} is unreachable (restarting or down). You are still on the air: call radio_standby again to keep waiting.`,
                },
              ],
            };
          }
          result = { messages: waited };
          // The client gave up on this call: keep the messages for the next call instead of losing them
          if (extra.signal.aborted && result && result.messages.length > 0) {
            stashedMessages.push(...result.messages);
            return { content: [{ type: "text" as const, text: "Cancelled." }] };
          }
        }
        if (!result || result.messages.length === 0) {
          return {
            content: [
              { type: "text" as const, text: "No new messages (standby timed out). Call radio_standby again." },
            ],
          };
        }
        // Check for kill signal from operator
        const killed = result.messages.find((m) => m.content.startsWith("RADIO_KILLED:"));
        if (killed) {
          endSession();
          return {
            content: [
              {
                type: "text" as const,
                text: "RADIO_KILLED: You have been disconnected by the operator. Do NOT call any more radio tools. Stop immediately.",
              },
            ],
            isError: true,
          };
        }
        const contentBlocks: Array<{ type: "text"; text: string } | { type: "image"; data: string; mimeType: string }> =
          [];

        for (const m of result.messages) {
          if (m.image) {
            contentBlocks.push({
              type: "image" as const,
              data: m.image.data,
              mimeType: m.image.mimeType,
            });
          }
          const imageTag = m.image ? " [image attached]" : "";
          const line = `[${new Date(m.timestamp).toLocaleTimeString()}] ${m.channel || "#all"} ${senderLabel(m)} → ${m.to}: ${m.content}${imageTag}`;
          contentBlocks.push({ type: "text" as const, text: line });
        }

        // Remind the agent to reply in the same channel the message was received on
        const channels = [
          ...new Set(result.messages.filter((m) => m.channel && m.channel !== "#all").map((m) => m.channel)),
        ];
        const hint =
          channels.length > 0
            ? `\n\nIMPORTANT: Reply in the same channel you received the message on. Use the channel parameter: ${channels.map((c) => `"${c}"`).join(", ")}`
            : "";
        if (hint) {
          contentBlocks.push({ type: "text" as const, text: hint });
        }
        return {
          content: contentBlocks,
        };
      } catch (e) {
        const msg = (e as Error).message;
        if (msg === "Unauthorized") {
          endSession();
          return {
            content: [
              {
                type: "text" as const,
                text: "RADIO_KILLED: You have been disconnected by the operator. Do NOT call any more radio tools. Stop immediately.",
              },
            ],
            isError: true,
          };
        }
        return {
          content: [{ type: "text" as const, text: `Poll failed: ${msg}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "radio_channels",
    "List all currently connected users on the hub and available channels.",
    {},
    async () => {
      if (!currentToken) {
        return {
          content: [{ type: "text" as const, text: "Not on the air. Use radio_join first." }],
          isError: true,
        };
      }
      try {
        const [users, channels] = await Promise.all([client.users(currentToken), client.listChannels(currentToken)]);
        const userText =
          users.length > 0
            ? `Connected users: ${users
                .map((u) => {
                  const tags = [u.role === "human" ? "human" : "", u.online ? "" : "offline"].filter(Boolean);
                  return tags.length > 0 ? `${u.name} (${tags.join(", ")})` : u.name;
                })
                .join(", ")}`
            : "No users connected.";
        const channelText =
          channels.length > 0
            ? `Channels: ${channels.map((c) => `${c.name} (${c.memberCount} members)`).join(", ")}`
            : "No channels.";
        return {
          content: [
            {
              type: "text" as const,
              text: `${userText}\n${channelText}`,
            },
          ],
        };
      } catch (e) {
        return {
          content: [{ type: "text" as const, text: `Failed: ${(e as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "radio_channel_create",
    "Create a new channel on the hub. You will automatically join the channel.",
    { name: z.string().describe("Channel name (with or without # prefix)") },
    async ({ name }) => {
      if (!currentToken) {
        return {
          content: [{ type: "text" as const, text: "Not on the air. Use radio_join first." }],
          isError: true,
        };
      }
      try {
        const result = await client.createChannel(currentToken, name);
        return {
          content: [
            {
              type: "text" as const,
              text: `Channel ${result.channel} created. You have been auto-joined.`,
            },
          ],
        };
      } catch (e) {
        return {
          content: [{ type: "text" as const, text: `Failed to create channel: ${(e as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "radio_channel_join",
    "Join an existing channel to send and receive messages in it.",
    { channel: z.string().describe("Channel name to join (e.g. #my-channel)") },
    async ({ channel }) => {
      if (!currentToken) {
        return {
          content: [{ type: "text" as const, text: "Not on the air. Use radio_join first." }],
          isError: true,
        };
      }
      try {
        await client.joinChannel(currentToken, channel);
        return {
          content: [
            {
              type: "text" as const,
              text: `Joined ${channel}.`,
            },
          ],
        };
      } catch (e) {
        return {
          content: [{ type: "text" as const, text: `Failed to join channel: ${(e as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "radio_channel_leave",
    "Leave a channel. You cannot leave #all.",
    { channel: z.string().describe("Channel name to leave") },
    async ({ channel }) => {
      if (!currentToken) {
        return {
          content: [{ type: "text" as const, text: "Not on the air. Use radio_join first." }],
          isError: true,
        };
      }
      try {
        await client.leaveChannel(currentToken, channel);
        return {
          content: [
            {
              type: "text" as const,
              text: `Left ${channel}.`,
            },
          ],
        };
      } catch (e) {
        return {
          content: [{ type: "text" as const, text: `Failed to leave channel: ${(e as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "radio_channel_invite",
    "Invite another user to a channel. The user is automatically joined and notified via their next poll.",
    {
      channel: z.string().describe("Channel name to invite the user to"),
      user: z.string().describe("User to invite (e.g. @agent-name)"),
    },
    async ({ channel, user }) => {
      if (!currentToken) {
        return {
          content: [{ type: "text" as const, text: "Not on the air. Use radio_join first." }],
          isError: true,
        };
      }
      try {
        await client.inviteToChannel(currentToken, channel, user);
        return {
          content: [
            {
              type: "text" as const,
              text: `Invited ${user} to ${channel}.`,
            },
          ],
        };
      } catch (e) {
        return {
          content: [{ type: "text" as const, text: `Failed to invite: ${(e as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "radio_token",
    "Get the current session token, hub URL, and path to radio-wait.sh script. Use this to run the wait script in a terminal for real-time polling.",
    {},
    async () => {
      if (!currentToken) {
        return {
          content: [{ type: "text" as const, text: "Not on the air. Use radio_join first." }],
          isError: true,
        };
      }
      const thisFile = fileURLToPath(import.meta.url);
      const waitScript = path.resolve(path.dirname(thisFile), "..", "bin", "radio-wait.sh");
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              hubUrl: client.getBaseUrl(),
              token: currentToken,
              waitScript,
            }),
          },
        ],
      };
    },
  );

  server.tool("radio_out", "Sign off and disconnect from the Walkie-Talkie hub. Over and out.", {}, async () => {
    if (!currentToken) {
      return {
        content: [{ type: "text" as const, text: "Not registered." }],
      };
    }
    try {
      await client.unregister(currentToken);
      const name = currentName;
      endSession();
      return {
        content: [{ type: "text" as const, text: `Unregistered "${name}". Disconnected from hub.` }],
      };
    } catch (e) {
      return {
        content: [{ type: "text" as const, text: `Unregister failed: ${(e as Error).message}` }],
        isError: true,
      };
    }
  });

  return server;
}
