import type { ChannelScope } from "./schemas.js";

export class ChannelScopeError extends Error {
  constructor(public readonly channelId: string, reason: string) {
    super(`People Pulse channel scope rejected ${channelId}: ${reason}`);
    this.name = "ChannelScopeError";
  }
}

export function assertApprovedPublicChannel(channelId: string, scopes: readonly ChannelScope[]): ChannelScope {
  const scope = scopes.find((candidate) => candidate.channelId === channelId);
  if (!scope) throw new ChannelScopeError(channelId, "not mapped");
  if (scope.conversationType !== "public_channel") throw new ChannelScopeError(channelId, "not public");
  if (!scope.include) throw new ChannelScopeError(channelId, "not included");
  if (!scope.approvedBy || !scope.approvedDate) throw new ChannelScopeError(channelId, "not approved");
  return scope;
}

export function approvedPublicChannels(scopes: readonly ChannelScope[]): ChannelScope[] {
  return scopes.filter((scope) => {
    try {
      assertApprovedPublicChannel(scope.channelId, scopes);
      return true;
    } catch {
      return false;
    }
  });
}
