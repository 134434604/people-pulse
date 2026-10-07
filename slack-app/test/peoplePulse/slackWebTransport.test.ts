import { describe, expect, it } from "vitest";
import { SlackRateLimitError } from "../../src/peoplePulse/slackCollector.js";
import { SlackWebReadTransport } from "../../src/peoplePulse/slackWebTransport.js";

describe("SlackWebReadTransport", () => {
  it("maps Slack timestamps and builds authorized public-channel permalinks", async () => {
    const calls: unknown[] = [];
    const client = {
      conversations: {
        history: async (input: unknown) => {
          calls.push(input);
          return {
            messages: [{ ts: "1787068800.000000", user: "U12345678", text: "A task needs approval.", reply_count: 0 }],
            response_metadata: { next_cursor: "next" }
          };
        },
        replies: async () => ({ messages: [], response_metadata: { next_cursor: "" } })
      }
    };
    const transport = new SlackWebReadTransport(client, "https://acme.slack.com");
    const page = await transport.history({
      channelId: "CENG01",
      oldest: "2026-08-17T00:00:00.000Z",
      latest: "2026-08-20T00:00:00.000Z"
    });
    expect(page.nextCursor).toBe("next");
    expect(page.messages[0]).toMatchObject({
      channelId: "CENG01",
      timestamp: "2026-08-18T16:00:00.000Z",
      permalink: "https://acme.slack.com/archives/CENG01/p1787068800000000"
    });
    expect(calls[0]).toMatchObject({ channel: "CENG01", inclusive: true, limit: 200 });
  });

  it("normalizes Slack 429 errors for the collector retry budget", async () => {
    const client = {
      conversations: {
        history: async () => { throw { code: "slack_webapi_rate_limited_error", retryAfter: 3 }; },
        replies: async () => ({ messages: [] })
      }
    };
    const transport = new SlackWebReadTransport(client, "https://acme.slack.com");
    await expect(transport.history({ channelId: "CENG01", oldest: "2026-08-17T00:00:00Z", latest: "2026-08-20T00:00:00Z" }))
      .rejects.toMatchObject({ name: SlackRateLimitError.name, retryAfterMs: 3_000 });
  });
});
