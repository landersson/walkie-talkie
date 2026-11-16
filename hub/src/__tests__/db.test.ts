import { beforeEach, describe, expect, it } from "vitest";
import { createProject, type Project } from "../project.js";
import type { Message } from "../types.js";

let p: Project;

beforeEach(() => {
  p = createProject("test", ":memory:");
});

describe("channels CRUD", () => {
  it("should seed #all on init", () => {
    const ch = p.db.dbGetChannel("#all");
    expect(ch).toBeDefined();
    expect(ch!.name).toBe("#all");
    expect(ch!.created_by).toBe("system");
  });

  it("should create and retrieve a channel", () => {
    const ch = p.db.dbCreateChannel("#test", "alice");
    expect(ch.name).toBe("#test");
    expect(ch.created_by).toBe("alice");
    expect(p.db.dbGetChannel("#test")).toBeDefined();
  });

  it("should list channels in creation order", () => {
    p.db.dbCreateChannel("#a", "alice");
    p.db.dbCreateChannel("#b", "bob");
    const list = p.db.dbListChannels();
    const names = list.map((c) => c.name);
    expect(names).toContain("#all");
    expect(names).toContain("#a");
    expect(names).toContain("#b");
  });

  it("should delete a channel", () => {
    p.db.dbCreateChannel("#del", "alice");
    expect(p.db.dbDeleteChannel("#del")).toBe(true);
    expect(p.db.dbGetChannel("#del")).toBeUndefined();
  });

  it("should return false when deleting non-existent channel", () => {
    expect(p.db.dbDeleteChannel("#nope")).toBe(false);
  });
});

describe("channel members", () => {
  it("should add and query members", () => {
    p.db.dbCreateChannel("#room", "alice");
    p.db.dbAddChannelMember("#room", "alice");
    p.db.dbAddChannelMember("#room", "bob");
    const channels = p.db.dbGetUserChannels("alice");
    expect(channels).toContain("#room");
  });

  it("should ignore duplicate member adds", () => {
    p.db.dbCreateChannel("#room", "alice");
    p.db.dbAddChannelMember("#room", "alice");
    p.db.dbAddChannelMember("#room", "alice"); // should not throw
    const channels = p.db.dbGetUserChannels("alice");
    expect(channels.filter((c) => c === "#room")).toHaveLength(1);
  });

  it("should remove a member", () => {
    p.db.dbCreateChannel("#room", "alice");
    p.db.dbAddChannelMember("#room", "alice");
    p.db.dbRemoveChannelMember("#room", "alice");
    expect(p.db.dbGetUserChannels("alice")).not.toContain("#room");
  });

  it("should remove all members of a channel", () => {
    p.db.dbCreateChannel("#room", "alice");
    p.db.dbAddChannelMember("#room", "alice");
    p.db.dbAddChannelMember("#room", "bob");
    p.db.dbRemoveAllMembersOfChannel("#room");
    expect(p.db.dbGetUserChannels("alice")).not.toContain("#room");
    expect(p.db.dbGetUserChannels("bob")).not.toContain("#room");
  });
});

describe("messages", () => {
  function makeMsg(overrides: Partial<Message> = {}): Message {
    return {
      id: `msg-${Math.random().toString(36).slice(2)}`,
      from: "alice",
      to: "@all",
      content: "hello",
      channel: "#all",
      timestamp: Date.now(),
      ...overrides,
    };
  }

  it("should save and retrieve channel messages", () => {
    const msg = makeMsg();
    p.db.dbSaveMessage(msg);
    const messages = p.db.dbGetChannelMessages("#all");
    expect(messages).toHaveLength(1);
    expect(messages[0].id).toBe(msg.id);
  });

  it("should retrieve recent messages across channels", () => {
    p.db.dbCreateChannel("#other", "alice");
    p.db.dbSaveMessage(makeMsg({ channel: "#all" }));
    p.db.dbSaveMessage(makeMsg({ channel: "#other" }));
    const messages = p.db.dbGetRecentMessages();
    expect(messages.length).toBeGreaterThanOrEqual(2);
  });

  it("should delete channel messages", () => {
    p.db.dbSaveMessage(makeMsg());
    p.db.dbDeleteChannelMessages("#all");
    expect(p.db.dbGetChannelMessages("#all")).toHaveLength(0);
  });

  it("should respect limit parameter", () => {
    for (let i = 0; i < 5; i++) {
      p.db.dbSaveMessage(makeMsg({ timestamp: Date.now() + i }));
    }
    expect(p.db.dbGetChannelMessages("#all", 3)).toHaveLength(3);
  });

  it("should return the newest messages in chronological order when limited", () => {
    p.db.dbCreateChannel("#other", "alice");
    for (let i = 0; i < 5; i++) {
      p.db.dbSaveMessage(makeMsg({ id: `all-${i}`, timestamp: i }));
      p.db.dbSaveMessage(makeMsg({ id: `other-${i}`, channel: "#other", timestamp: 100 + i }));
    }
    expect(p.db.dbGetChannelMessages("#all", 3).map((m) => m.id)).toEqual(["all-2", "all-3", "all-4"]);
    expect(p.db.dbGetRecentMessages(3).map((m) => m.id)).toEqual(["other-2", "other-3", "other-4"]);
  });

  it("should page back through a channel with before", () => {
    for (let i = 0; i < 5; i++) {
      p.db.dbSaveMessage(makeMsg({ id: `page-${i}`, timestamp: 1000 + i }));
    }
    expect(p.db.dbGetChannelMessages("#all", 2).map((m) => m.id)).toEqual(["page-3", "page-4"]);
    expect(p.db.dbGetChannelMessages("#all", 2, { timestamp: 1003 }).map((m) => m.id)).toEqual(["page-1", "page-2"]);
    expect(p.db.dbGetChannelMessages("#all", 2, { timestamp: 1001 }).map((m) => m.id)).toEqual(["page-0"]);
  });

  it("should page through equal timestamps in insertion order without gaps", () => {
    for (let i = 0; i < 5; i++) {
      p.db.dbSaveMessage(makeMsg({ id: `tie-${i}`, timestamp: 5000 }));
    }
    const newest = p.db.dbGetChannelMessages("#all", 2);
    expect(newest.map((m) => m.id)).toEqual(["tie-3", "tie-4"]);
    const older = p.db.dbGetChannelMessages("#all", 2, { timestamp: newest[0].timestamp, seq: newest[0].seq });
    expect(older.map((m) => m.id)).toEqual(["tie-1", "tie-2"]);
    const oldest = p.db.dbGetChannelMessages("#all", 2, { timestamp: older[0].timestamp, seq: older[0].seq });
    expect(oldest.map((m) => m.id)).toEqual(["tie-0"]);
  });

  it("should prune #all channel beyond 200 messages", () => {
    for (let i = 0; i < 210; i++) {
      p.db.dbSaveMessage(
        makeMsg({
          id: `prune-${i}`,
          timestamp: i,
        }),
      );
    }
    // After pruning, should have at most 200
    const messages = p.db.dbGetChannelMessages("#all", 500);
    expect(messages.length).toBeLessThanOrEqual(200);
  });
});

describe("read cursors", () => {
  it("should update and query unread counts", () => {
    p.db.dbSaveMessage({
      id: "m1",
      from: "alice",
      to: "@all",
      content: "hello",
      channel: "#all",
      timestamp: 1000,
    });
    p.db.dbSaveMessage({
      id: "m2",
      from: "alice",
      to: "@all",
      content: "world",
      channel: "#all",
      timestamp: 2000,
    });
    p.db.dbUpdateReadCursor("bob", "#all", 1000);
    const counts = p.db.dbGetUnreadCounts("bob");
    expect(counts["#all"]).toBe(1); // m2 is unread
  });

  it("should use MAX for cursor updates (no backwards)", () => {
    p.db.dbUpdateReadCursor("bob", "#all", 2000);
    p.db.dbUpdateReadCursor("bob", "#all", 1000); // should not go backwards
    p.db.dbSaveMessage({
      id: "m1",
      from: "alice",
      to: "@all",
      content: "hello",
      channel: "#all",
      timestamp: 1500,
    });
    const counts = p.db.dbGetUnreadCounts("bob");
    expect(counts["#all"]).toBeUndefined(); // 1500 < 2000 so no unread
  });

  it("should delete read cursors for a channel", () => {
    p.db.dbUpdateReadCursor("bob", "#all", 1000);
    p.db.dbDeleteReadCursorsForChannel("#all");
    // After deleting cursors, all messages are unread
    p.db.dbSaveMessage({
      id: "m1",
      from: "alice",
      to: "@all",
      content: "hello",
      channel: "#all",
      timestamp: 2000,
    });
    const counts = p.db.dbGetUnreadCounts("bob");
    expect(counts["#all"]).toBe(1);
  });
});

describe("agent configs", () => {
  it("should create and retrieve an agent config", () => {
    const config = p.db.dbCreateAgentConfig("a1", "my-agent", "/tmp", "echo hi", false);
    expect(config.id).toBe("a1");
    expect(config.name).toBe("my-agent");
    expect(config.work_dir).toBe("/tmp");
    expect(config.command).toBe("echo hi");
    expect(config.auto_start).toBe(0);

    const retrieved = p.db.dbGetAgentConfig("a1");
    expect(retrieved).toBeDefined();
    expect(retrieved!.name).toBe("my-agent");
  });

  it("should list agent configs in creation order", () => {
    p.db.dbCreateAgentConfig("b1", "agent-b", "/tmp", "echo b", false);
    p.db.dbCreateAgentConfig("b2", "agent-c", "/tmp", "echo c", true);
    const list = p.db.dbListAgentConfigs();
    expect(list.length).toBeGreaterThanOrEqual(2);
  });

  it("should update an agent config", () => {
    p.db.dbCreateAgentConfig("u1", "update-me", "/tmp", "echo old", false);
    p.db.dbUpdateAgentConfig("u1", { name: "updated", command: "echo new", autoStart: true });
    const config = p.db.dbGetAgentConfig("u1");
    expect(config!.name).toBe("updated");
    expect(config!.command).toBe("echo new");
    expect(config!.auto_start).toBe(1);
  });

  it("should delete an agent config", () => {
    p.db.dbCreateAgentConfig("d1", "delete-me", "/tmp", "echo del", false);
    expect(p.db.dbDeleteAgentConfig("d1")).toBe(true);
    expect(p.db.dbGetAgentConfig("d1")).toBeUndefined();
  });

  it("should return false when deleting non-existent config", () => {
    expect(p.db.dbDeleteAgentConfig("nope")).toBe(false);
  });

  it("should enforce unique name constraint", () => {
    p.db.dbCreateAgentConfig("n1", "unique-name", "/tmp", "echo 1", false);
    expect(() => p.db.dbCreateAgentConfig("n2", "unique-name", "/tmp", "echo 2", false)).toThrow();
  });
});
