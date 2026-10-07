import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildCapacitySignals } from "../../src/peoplePulse/capacity.js";
import { loadPeoplePulseConfig } from "../../src/peoplePulse/config.js";
import { extractTaskObservations } from "../../src/peoplePulse/extractObservations.js";
import { FixtureSlackTransport } from "../../src/peoplePulse/fixtureTransport.js";
import type { ChannelScope } from "../../src/peoplePulse/schemas.js";
import { collectApprovedChannels } from "../../src/peoplePulse/slackCollector.js";
import { buildWorkSignals } from "../../src/peoplePulse/signals.js";

const scopes: ChannelScope[] = [
  approved("Engineering", "CENG01", "#engineering"),
  approved("Marketing", "CMKT01", "#marketing"),
  approved("Sales", "CSALES1", "#sales"),
  approved("Support", "CSUP01", "#support"),
  { ...approved("Finance", "CFIN001", "#finance"), include: false, approvedBy: "", approvedDate: "" }
];

describe("People Pulse fixture collection and deterministic signals", () => {
  it("paginates approved channels, excludes bots, and derives task-level evidence", async () => {
    const fixturePath = fileURLToPath(new URL("../fixtures/people-pulse/slack-week-2026-08-17.json", import.meta.url));
    const transport = await FixtureSlackTransport.fromFile(fixturePath);
    const config = loadPeoplePulseConfig({ PP_REQUEST_SPACING_MS: "0" });
    const sleepCalls: number[] = [];
    const collection = await collectApprovedChannels(transport, scopes, config, {
      now: new Date("2026-08-20T20:00:00.000Z"),
      headcountByDepartment: new Map([
        ["Engineering", 6], ["Marketing", 5], ["Sales", 4], ["Support", 5]
      ]),
      sleep: async (milliseconds) => { sleepCalls.push(milliseconds); }
    });

    expect(collection.channels).toHaveLength(4);
    expect(collection.messagesRead).toBe(15);
    expect(collection.channels.find((channel) => channel.scope.department === "Engineering")?.messages)
      .not.toContainEqual(expect.objectContaining({ botId: "B0000001" }));
    expect(collection.channels.find((channel) => channel.scope.department === "Engineering")?.weeklyMessageCounts)
      .toHaveLength(8);
    expect(collection.providerCalls).toBe(6);
    expect(collection.checkpoints.CMKT01).toBe("2026-08-19T13:00:00.000Z");

    const extracted = extractTaskObservations(collection, new Date("2026-08-20T20:00:00.000Z"), config);
    const signals = buildWorkSignals(extracted.observations);
    const capacity = buildCapacitySignals(extracted.observations, config);

    expect(extracted.observations.length).toBeGreaterThanOrEqual(10);
    expect(extracted.evidence.every((item) => item.boundedSummary.length <= 80)).toBe(true);
    expect(extracted.evidence.some((item) => item.boundedSummary.includes("lunch recommendations"))).toBe(false);
    expect(signals.some((signal) => signal.type === "waiting-decision" && signal.urgency === "today")).toBe(true);
    expect(signals.some((signal) => signal.type === "coverage-risk")).toBe(true);
    expect(capacity).toHaveLength(1);
    expect(capacity[0]).toMatchObject({ taskArea: "Reporting and reconciliation", weeksObserved: 4, occurrenceCount: 4 });
    expect(capacity[0]?.roleHypothesis).toContain("After process, automation, and rebalancing");
  });
});

function approved(department: string, channelId: string, channelName: string): ChannelScope {
  return {
    department,
    channelId,
    channelName,
    conversationType: "public_channel",
    mappingSource: "manual",
    include: true,
    approvedBy: "Executive Sponsor",
    approvedDate: "2026-08-01"
  };
}
