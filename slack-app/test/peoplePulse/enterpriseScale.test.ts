import { describe, expect, it } from "vitest";
import { loadPeoplePulseConfig } from "../../src/peoplePulse/config.js";
import type { ChannelScope, RawSlackMessage } from "../../src/peoplePulse/schemas.js";
import { collectApprovedChannels, type SlackReadTransport } from "../../src/peoplePulse/slackCollector.js";

describe("People Pulse configurable enterprise collection budget", () => {
  it("collects 12 departments x 10 approved public channels with one read per channel", async () => {
    const scopes: ChannelScope[] = [];
    for (let departmentIndex = 1; departmentIndex <= 12; departmentIndex += 1) {
      for (let channelIndex = 1; channelIndex <= 10; channelIndex += 1) {
        const channelId = `CD${String(departmentIndex).padStart(2, "0")}C${String(channelIndex).padStart(2, "0")}`;
        scopes.push({
          department: `Department ${departmentIndex}`,
          channelId,
          channelName: `#department-${departmentIndex}-channel-${channelIndex}`,
          conversationType: "public_channel",
          mappingSource: "manual",
          include: true,
          approvedBy: "Scale Test Executive",
          approvedDate: "2026-08-01"
        });
      }
    }
    let calls = 0;
    const transport: SlackReadTransport = {
      async history(input) {
        calls += 1;
        const message: RawSlackMessage = {
          channelId: input.channelId,
          timestamp: "2026-08-18T12:00:00.000Z",
          userId: "USCALE001",
          text: "Routine team update with no task exception.",
          replyCount: 0,
          permalink: `https://acme.slack.com/archives/${input.channelId}/p202608181200`
        };
        return { messages: [message] };
      },
      async replies() { return { messages: [] }; }
    };
    const result = await collectApprovedChannels(transport, scopes, loadPeoplePulseConfig({ PP_REQUEST_SPACING_MS: "0" }), {
      now: new Date("2026-08-20T20:00:00.000Z"),
      headcountByDepartment: new Map(Array.from({ length: 12 }, (_, index) => [`Department ${index + 1}`, 20])),
      sleep: async () => undefined
    });
    expect(result.channels).toHaveLength(120);
    expect(result.messagesRead).toBe(120);
    expect(result.providerCalls).toBe(120);
    expect(calls).toBe(120);
    expect(Object.keys(result.checkpoints)).toHaveLength(120);
  });
});
