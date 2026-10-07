import type { WebClient } from "@slack/web-api";
import { SlackRateLimitError, type SlackPage, type SlackReadTransport } from "./slackCollector.js";
import type { RawSlackMessage } from "./schemas.js";

interface ConversationsClient {
  conversations: Pick<WebClient["conversations"], "history" | "replies">;
}

interface SlackMessageLike {
  ts?: string;
  thread_ts?: string;
  latest_reply?: string;
  user?: string;
  text?: string;
  reply_count?: number;
  subtype?: string;
  bot_id?: string;
  app_id?: string;
}

export class SlackWebReadTransport implements SlackReadTransport {
  constructor(
    private readonly client: ConversationsClient,
    private readonly workspaceUrl: string
  ) {
    if (!/^https:\/\/[a-z0-9-]+\.slack\.com$/i.test(workspaceUrl)) {
      throw new Error("People Pulse requires an explicit https://<workspace>.slack.com URL for authorized evidence links.");
    }
  }

  async history(input: { channelId: string; cursor?: string; oldest: string; latest: string }): Promise<SlackPage> {
    try {
      const response = await this.client.conversations.history({
        channel: input.channelId,
        ...(input.cursor ? { cursor: input.cursor } : {}),
        oldest: toSlackTimestamp(input.oldest),
        latest: toSlackTimestamp(input.latest),
        inclusive: true,
        limit: 200
      });
      return {
        messages: mapMessages(input.channelId, response.messages as unknown, this.workspaceUrl),
        nextCursor: response.response_metadata?.next_cursor || undefined
      };
    } catch (error: unknown) {
      throw normalizeSlackError(error);
    }
  }

  async replies(input: { channelId: string; threadTimestamp: string; cursor?: string }): Promise<SlackPage> {
    try {
      const response = await this.client.conversations.replies({
        channel: input.channelId,
        ts: toSlackTimestamp(input.threadTimestamp),
        ...(input.cursor ? { cursor: input.cursor } : {}),
        limit: 200
      });
      return {
        messages: mapMessages(input.channelId, response.messages as unknown, this.workspaceUrl),
        nextCursor: response.response_metadata?.next_cursor || undefined
      };
    } catch (error: unknown) {
      throw normalizeSlackError(error);
    }
  }
}

function mapMessages(channelId: string, value: unknown, workspaceUrl: string): RawSlackMessage[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item: unknown) => {
    if (!item || typeof item !== "object") return [];
    const message = item as SlackMessageLike;
    if (!message.ts) return [];
    return [{
      channelId,
      timestamp: fromSlackTimestamp(message.ts),
      ...(message.thread_ts ? { threadTimestamp: fromSlackTimestamp(message.thread_ts) } : {}),
      ...(message.latest_reply ? { lastReplyAt: fromSlackTimestamp(message.latest_reply) } : {}),
      ...(message.user ? { userId: message.user } : {}),
      text: message.text ?? "",
      replyCount: message.reply_count ?? 0,
      ...(message.subtype ? { subtype: message.subtype } : {}),
      ...(message.bot_id ? { botId: message.bot_id } : {}),
      ...(message.app_id ? { appId: message.app_id } : {}),
      permalink: `${workspaceUrl}/archives/${channelId}/p${message.ts.replace(".", "")}`
    }];
  });
}

function toSlackTimestamp(isoTimestamp: string): string {
  const milliseconds = Date.parse(isoTimestamp);
  if (!Number.isFinite(milliseconds)) throw new Error("Invalid ISO timestamp for Slack read.");
  return (milliseconds / 1_000).toFixed(6);
}

function fromSlackTimestamp(slackTimestamp: string): string {
  const seconds = Number(slackTimestamp);
  if (!Number.isFinite(seconds)) throw new Error("Invalid Slack message timestamp.");
  return new Date(seconds * 1_000).toISOString();
}

function normalizeSlackError(error: unknown): Error {
  if (error && typeof error === "object") {
    const candidate = error as { code?: unknown; retryAfter?: unknown; retry_after?: unknown };
    if (candidate.code === "slack_webapi_rate_limited_error") {
      const seconds = Number(candidate.retryAfter ?? candidate.retry_after ?? 1);
      return new SlackRateLimitError(Math.max(1, Number.isFinite(seconds) ? seconds : 1) * 1_000);
    }
  }
  return error instanceof Error ? error : new Error("Slack read failed.");
}
