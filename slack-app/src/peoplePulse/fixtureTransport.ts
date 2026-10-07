import { readFile } from "node:fs/promises";
import { z } from "zod";
import type { SlackPage, SlackReadTransport } from "./slackCollector.js";
import { rawSlackMessageSchema } from "./schemas.js";

const fixtureChannelSchema = z.object({
  historyPages: z.array(z.object({
    messages: z.array(rawSlackMessageSchema),
    nextCursor: z.string().optional()
  }).strict()),
  replyPages: z.record(z.string(), z.array(z.object({
    messages: z.array(rawSlackMessageSchema),
    nextCursor: z.string().optional()
  }).strict()))
}).strict();

const fixtureSchema = z.object({
  channels: z.record(z.string(), fixtureChannelSchema)
}).strict();

type Fixture = z.infer<typeof fixtureSchema>;

export class FixtureSlackTransport implements SlackReadTransport {
  private readonly historyIndexes = new Map<string, number>();
  private readonly replyIndexes = new Map<string, number>();

  constructor(private readonly fixture: Fixture) {}

  static async fromFile(path: string): Promise<FixtureSlackTransport> {
    const fixture = fixtureSchema.parse(JSON.parse(await readFile(path, "utf8")));
    return new FixtureSlackTransport(fixture);
  }

  async history(input: { channelId: string; cursor?: string }): Promise<SlackPage> {
    const channel = this.fixture.channels[input.channelId];
    if (!channel) throw new Error(`Fixture channel not found: ${input.channelId}`);
    const index = input.cursor ? Number(input.cursor) : (this.historyIndexes.get(input.channelId) ?? 0);
    const page = channel.historyPages[index];
    if (!page) return { messages: [] };
    this.historyIndexes.set(input.channelId, index + 1);
    return page;
  }

  async replies(input: { channelId: string; threadTimestamp: string; cursor?: string }): Promise<SlackPage> {
    const channel = this.fixture.channels[input.channelId];
    if (!channel) throw new Error(`Fixture channel not found: ${input.channelId}`);
    const pages = channel.replyPages[input.threadTimestamp] ?? [];
    const key = `${input.channelId}:${input.threadTimestamp}`;
    const index = input.cursor ? Number(input.cursor) : (this.replyIndexes.get(key) ?? 0);
    const page = pages[index];
    if (!page) return { messages: [] };
    this.replyIndexes.set(key, index + 1);
    return page;
  }
}
