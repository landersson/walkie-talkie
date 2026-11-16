import { beforeEach, describe, expect, it } from "vitest";
import { createProject, type Project } from "../project.js";

let p: Project;

beforeEach(() => {
  p = createProject("test", ":memory:");
});

describe("joinChannel", () => {
  it("should add a user to an existing channel", () => {
    p.channels.joinChannel("#all", "alice");
    expect(p.channels.getChannelMembers("#all")).toContain("alice");
  });

  it("should throw when joining a non-existent channel", () => {
    expect(() => p.channels.joinChannel("#nope", "alice")).toThrow("does not exist");
  });
});

describe("leaveChannel", () => {
  it("should remove a user from a channel", () => {
    p.channels.joinChannel("#all", "alice");
    p.channels.leaveChannel("#all", "alice");
    expect(p.channels.getChannelMembers("#all")).not.toContain("alice");
  });
});

describe("isChannelMember", () => {
  it("should return true for members", () => {
    p.channels.joinChannel("#all", "alice");
    expect(p.channels.isChannelMember("#all", "alice")).toBe(true);
  });

  it("should return false for non-members", () => {
    expect(p.channels.isChannelMember("#all", "nobody")).toBe(false);
  });
});

describe("removeUserFromAllChannels", () => {
  it("should remove user from every channel", () => {
    p.db.dbCreateChannel("#room", "alice");
    p.channels.joinChannel("#all", "alice");
    p.channels.joinChannel("#room", "alice");
    p.channels.removeUserFromAllChannels("alice");
    expect(p.channels.isChannelMember("#all", "alice")).toBe(false);
    expect(p.channels.isChannelMember("#room", "alice")).toBe(false);
  });
});

describe("getUserChannels", () => {
  it("should return all channels a user belongs to", () => {
    p.db.dbCreateChannel("#room", "alice");
    p.channels.joinChannel("#all", "alice");
    p.channels.joinChannel("#room", "alice");
    const channels = p.channels.getUserChannels("alice");
    expect(channels).toContain("#all");
    expect(channels).toContain("#room");
  });
});

describe("removeChannel", () => {
  it("should remove the channel from in-memory state", () => {
    p.db.dbCreateChannel("#temp", "alice");
    p.channels.ensureChannelMembership("#temp");
    p.channels.joinChannel("#temp", "alice");
    p.channels.removeChannel("#temp");
    expect(p.channels.getChannelMembers("#temp")).toEqual([]);
  });
});
