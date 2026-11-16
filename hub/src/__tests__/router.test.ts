import { beforeEach, describe, expect, it } from "vitest";
import { createProject, type Project } from "../project.js";

let p: Project;

beforeEach(() => {
  p = createProject("test", ":memory:");
});

describe("queue management", () => {
  it("should create and drain a queue", () => {
    p.router.ensureQueue("alice");
    const msgs = p.router.drainQueue("alice");
    expect(msgs).toEqual([]);
  });

  it("should return empty array for non-existent queue", () => {
    expect(p.router.drainQueue("nobody")).toEqual([]);
  });

  it("should remove a queue", () => {
    p.router.ensureQueue("alice");
    p.router.removeQueue("alice");
    expect(p.router.drainQueue("alice")).toEqual([]);
  });
});

describe("routeMessage", () => {
  it("should broadcast @all to all channel members except sender", () => {
    const alice = p.auth.registerUser("alice");
    const bob = p.auth.registerUser("bob");
    p.router.ensureQueue(alice.name);
    p.router.ensureQueue(bob.name);
    p.channels.joinChannel("#all", "alice");
    p.channels.joinChannel("#all", "bob");

    const msg = p.router.routeMessage("alice", "@all", "hello");
    expect(msg.from).toBe("alice");
    expect(msg.to).toBe("@all");
    expect(msg.channel).toBe("#all");

    // Bob should have the message queued
    const bobMsgs = p.router.drainQueue("bob");
    expect(bobMsgs).toHaveLength(1);
    expect(bobMsgs[0].content).toBe("hello");

    // Alice (sender) should NOT have it
    const aliceMsgs = p.router.drainQueue("alice");
    expect(aliceMsgs).toHaveLength(0);
  });

  it("should deliver DM to target user", () => {
    p.auth.registerUser("alice");
    p.auth.registerUser("bob");
    p.router.ensureQueue("alice");
    p.router.ensureQueue("bob");
    p.channels.joinChannel("#all", "alice");
    p.channels.joinChannel("#all", "bob");

    const msg = p.router.routeMessage("alice", "@bob", "hi bob");
    expect(msg.to).toBe("bob");

    const bobMsgs = p.router.drainQueue("bob");
    expect(bobMsgs).toHaveLength(1);
  });

  it("should throw when target user is not registered", () => {
    p.auth.registerUser("alice");
    p.router.ensureQueue("alice");
    p.channels.joinChannel("#all", "alice");

    expect(() => p.router.routeMessage("alice", "@nobody", "hi")).toThrow("not connected");
  });

  it("should throw when target is not in the channel", () => {
    p.auth.registerUser("alice");
    p.auth.registerUser("bob");
    p.router.ensureQueue("alice");
    p.channels.joinChannel("#all", "alice");
    // bob not joined to #all

    expect(() => p.router.routeMessage("alice", "@bob", "hi")).toThrow("not a member");
  });

  it("should route messages in custom channels", () => {
    p.auth.registerUser("alice");
    p.auth.registerUser("bob");
    p.router.ensureQueue("alice");
    p.router.ensureQueue("bob");
    p.db.dbCreateChannel("#room", "alice");
    p.channels.joinChannel("#room", "alice");
    p.channels.joinChannel("#room", "bob");

    const msg = p.router.routeMessage("alice", "@all", "room msg", "#room");
    expect(msg.channel).toBe("#room");

    const bobMsgs = p.router.drainQueue("bob");
    expect(bobMsgs).toHaveLength(1);
    expect(bobMsgs[0].channel).toBe("#room");
  });

  it("should include image in routed message", () => {
    p.auth.registerUser("alice");
    p.auth.registerUser("bob");
    p.router.ensureQueue("alice");
    p.router.ensureQueue("bob");
    p.channels.joinChannel("#all", "alice");
    p.channels.joinChannel("#all", "bob");

    const image = { data: "iVBORw0KGgo=", mimeType: "image/png" };
    const msg = p.router.routeMessage("alice", "@all", "check this", "#all", image);
    expect(msg.image).toEqual(image);

    const bobMsgs = p.router.drainQueue("bob");
    expect(bobMsgs).toHaveLength(1);
    expect(bobMsgs[0].image).toEqual(image);
  });
});

describe("routeMessage with humans", () => {
  it("should not queue messages for humans who are channel members", () => {
    p.auth.registerUser("agent1");
    p.auth.registerUser("op", "human");
    p.channels.joinChannel("#all", "agent1");
    p.channels.joinChannel("#all", "op");
    p.router.routeMessage("agent1", "@all", "hello", "#all");
    p.router.routeMessage("agent1", "@op", "direct", "#all");
    expect(p.router.drainQueue("op")).toEqual([]);
  });

  it("should tag messages with the sender's role", () => {
    p.auth.registerUser("agent1");
    p.auth.registerUser("op", "human");
    p.channels.joinChannel("#all", "agent1");
    expect(p.router.routeMessage("op", "@all", "do it", "#all").fromRole).toBe("human");
    expect(p.router.drainQueue("agent1")[0].fromRole).toBe("human");
    expect(p.router.routeMessage("agent1", "@op", "done", "#all").fromRole).toBe("agent");
  });
});
