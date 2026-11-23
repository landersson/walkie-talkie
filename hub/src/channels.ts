import type { ProjectDB } from "./db.js";

/** Channel names start with "#"; accept them without it too */
export function channelName(name: string): string {
  return name.startsWith("#") ? name : `#${name}`;
}

export function createChannels(db: ProjectDB) {
  const { dbAddChannelMember, dbGetChannel, dbRemoveAllMembersOfChannel, dbRemoveChannelMember } = db;
  const channelMembers = new Map<string, Set<string>>([["#all", new Set()]]);

  function joinChannel(channel: string, userName: string): void {
    const dbChannel = dbGetChannel(channel);
    if (!dbChannel) {
      throw new Error(`Channel "${channel}" does not exist`);
    }
    let members = channelMembers.get(channel);
    if (!members) {
      members = new Set();
      channelMembers.set(channel, members);
    }
    members.add(userName);
    dbAddChannelMember(channel, userName);
  }

  function leaveChannel(channel: string, userName: string): void {
    const members = channelMembers.get(channel);
    if (members) {
      members.delete(userName);
    }
    dbRemoveChannelMember(channel, userName);
  }

  function removeUserFromAllChannels(userName: string): void {
    for (const members of channelMembers.values()) {
      members.delete(userName);
    }
  }

  function getChannelMembers(channel: string): string[] {
    const members = channelMembers.get(channel);
    return members ? Array.from(members) : [];
  }

  function getUserChannels(userName: string): string[] {
    const result: string[] = [];
    for (const [channel, members] of channelMembers) {
      if (members.has(userName)) {
        result.push(channel);
      }
    }
    return result;
  }

  function isChannelMember(channel: string, userName: string): boolean {
    const members = channelMembers.get(channel);
    return members ? members.has(userName) : false;
  }

  function getChannelMemberCounts(): Map<string, number> {
    const counts = new Map<string, number>();
    for (const [channel, members] of channelMembers) {
      counts.set(channel, members.size);
    }
    return counts;
  }

  function ensureChannelMembership(channel: string): void {
    if (!channelMembers.has(channel)) {
      channelMembers.set(channel, new Set());
    }
  }

  function removeChannel(channel: string): void {
    channelMembers.delete(channel);
    dbRemoveAllMembersOfChannel(channel);
  }

  return {
    joinChannel,
    leaveChannel,
    removeUserFromAllChannels,
    getChannelMembers,
    getUserChannels,
    isChannelMember,
    getChannelMemberCounts,
    ensureChannelMembership,
    removeChannel,
  };
}

export type Channels = ReturnType<typeof createChannels>;
