import type { PeoplePulseConfig } from "./config.js";
import { assertApprovedPublicChannel } from "./channelGuard.js";
import type { ChannelScope, RawSlackMessage } from "./schemas.js";
import { rawSlackMessageSchema } from "./schemas.js";

export interface SlackPage {
  messages: RawSlackMessage[];
  nextCursor?: string;
}

export interface SlackReadTransport {
  history(input: { channelId: string; cursor?: string; oldest: string; latest: string }): Promise<SlackPage>;
  replies(input: { channelId: string; threadTimestamp: string; cursor?: string }): Promise<SlackPage>;
}

export interface CollectedChannel {
  scope: ChannelScope;
  messages: RawSlackMessage[];
  weeklyMessageCounts: number[];
  uniqueParticipantCount: number;
  participationPercent: number | null;
}

export interface CollectionResult {
  channels: CollectedChannel[];
  messagesRead: number;
  providerCalls: number;
  checkpoints: Record<string, string>;
}

export class SlackRateLimitError extends Error {
  constructor(public readonly retryAfterMs: number) {
    super(`Slack read rate limited for ${retryAfterMs}ms`);
    this.name = "SlackRateLimitError";
  }
}

export interface CollectorOptions {
  now: Date;
  headcountByDepartment: ReadonlyMap<string, number>;
  oldestByChannel?: ReadonlyMap<string, string>;
  sleep?: (milliseconds: number) => Promise<void>;
}

export async function collectApprovedChannels(
  transport: SlackReadTransport,
  scopes: readonly ChannelScope[],
  config: PeoplePulseConfig,
  options: CollectorOptions
): Promise<CollectionResult> {
  if (config.modes.slackRead !== "MOCK" && config.modes.slackRead !== "LIVE") {
    throw new Error("Unsupported Slack read mode");
  }

  const sleep = options.sleep ?? defaultSleep;
  const range = eightWeekRange(options.now);
  const included = scopes.filter((scope) => scope.include);
  const includedIds = new Set<string>();
  for (const scope of included) {
    if (includedIds.has(scope.channelId)) {
      throw new Error(`People Pulse channel scope contains a duplicate included channel: ${scope.channelId}`);
    }
    includedIds.add(scope.channelId);
    assertApprovedPublicChannel(scope.channelId, scopes);
  }
  const channels: CollectedChannel[] = [];
  let providerCalls = 0;

  for (const candidate of included) {
    const scope = assertApprovedPublicChannel(candidate.channelId, scopes);
    const messages: RawSlackMessage[] = [];
    let cursor: string | undefined;
    let pageCount = 0;

    do {
      if (providerCalls > 0) await sleep(config.requestSpacingMs);
      const page = await withRateLimitRetry(async () => {
        assertApprovedPublicChannel(scope.channelId, scopes);
        providerCalls += 1;
        return transport.history({
          channelId: scope.channelId,
          cursor,
          oldest: options.oldestByChannel?.get(scope.channelId) ?? range.start.toISOString(),
          latest: range.end.toISOString()
        });
      }, config.maximumRetries, config.requestSpacingMs, sleep);
      messages.push(...filterHumanMessages(page.messages));
      cursor = page.nextCursor;
      pageCount += 1;
      if (cursor && pageCount >= config.maximumHistoryPages) {
        throw new Error(`Slack history page limit exceeded for ${scope.channelId}`);
      }
    } while (cursor);

    const parentThreads = messages.filter((message) => message.replyCount > 0 && !message.threadTimestamp);
    for (const parent of parentThreads) {
      let replyCursor: string | undefined;
      let replyPages = 0;
      do {
        if (providerCalls > 0) await sleep(config.requestSpacingMs);
        const page = await withRateLimitRetry(async () => {
          assertApprovedPublicChannel(scope.channelId, scopes);
          providerCalls += 1;
          return transport.replies({
            channelId: scope.channelId,
            threadTimestamp: parent.timestamp,
            cursor: replyCursor
          });
        }, config.maximumRetries, config.requestSpacingMs, sleep);
        const replies = filterHumanMessages(page.messages).filter((message) => message.timestamp !== parent.timestamp);
        messages.push(...replies);
        replyCursor = page.nextCursor;
        replyPages += 1;
        if (replyCursor && replyPages >= config.maximumHistoryPages) {
          throw new Error(`Slack reply page limit exceeded for ${scope.channelId}`);
        }
      } while (replyCursor);
    }

    const oldest = Date.parse(options.oldestByChannel?.get(scope.channelId) ?? range.start.toISOString());
    const latest = range.end.getTime();
    const deduplicated = deduplicateMessages(messages).filter((message) => {
      const timestamp = Date.parse(message.timestamp);
      return timestamp >= oldest && timestamp <= latest;
    });
    const uniqueParticipants = new Set(
      deduplicated.map((message) => message.userId).filter((userId): userId is string => Boolean(userId))
    );
    const headcount = options.headcountByDepartment.get(scope.department) ?? 0;
    channels.push({
      scope,
      messages: deduplicated,
      weeklyMessageCounts: countByWeek(deduplicated, range.start),
      uniqueParticipantCount: uniqueParticipants.size,
      participationPercent: headcount > 0 ? Math.min(100, Math.round((uniqueParticipants.size / headcount) * 100)) : null
    });
  }

  return {
    channels,
    messagesRead: channels.reduce((total, channel) => total + channel.messages.length, 0),
    providerCalls,
    checkpoints: Object.fromEntries(channels.map((channel) => [
      channel.scope.channelId,
      channel.messages.at(-1)?.timestamp ?? (options.oldestByChannel?.get(channel.scope.channelId) ?? range.start.toISOString())
    ]))
  };
}

function filterHumanMessages(messages: readonly RawSlackMessage[]): RawSlackMessage[] {
  return messages
    .map((message) => rawSlackMessageSchema.parse(message))
    .filter((message) => !message.botId && !message.appId)
    .filter((message) => !message.subtype || message.subtype === "thread_broadcast")
    .filter((message) => message.text.trim().length > 0);
}

function deduplicateMessages(messages: readonly RawSlackMessage[]): RawSlackMessage[] {
  const byIdentity = new Map<string, RawSlackMessage>();
  for (const message of messages) {
    byIdentity.set(`${message.channelId}:${message.timestamp}`, message);
  }
  return [...byIdentity.values()].sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}

function countByWeek(messages: readonly RawSlackMessage[], start: Date): number[] {
  const counts = Array.from({ length: 8 }, () => 0);
  for (const message of messages) {
    const week = Math.floor((Date.parse(message.timestamp) - start.getTime()) / (7 * 24 * 60 * 60 * 1_000));
    if (week >= 0 && week < counts.length) counts[week] = (counts[week] ?? 0) + 1;
  }
  return counts;
}

function eightWeekRange(now: Date): { start: Date; end: Date } {
  const end = new Date(now);
  const startOfCurrentWeek = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  const day = startOfCurrentWeek.getUTCDay();
  startOfCurrentWeek.setUTCDate(startOfCurrentWeek.getUTCDate() - ((day + 6) % 7));
  const start = new Date(startOfCurrentWeek);
  start.setUTCDate(start.getUTCDate() - 7 * 7);
  return { start, end };
}

async function withRateLimitRetry<T>(
  operation: () => Promise<T>,
  maximumRetries: number,
  minimumSpacingMs: number,
  sleep: (milliseconds: number) => Promise<void>
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await operation();
    } catch (error: unknown) {
      if (!(error instanceof SlackRateLimitError) || attempt >= maximumRetries) throw error;
      const exponentialBackoff = minimumSpacingMs * 2 ** attempt;
      await sleep(Math.max(error.retryAfterMs, exponentialBackoff));
      attempt += 1;
    }
  }
}

async function defaultSleep(milliseconds: number): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}
