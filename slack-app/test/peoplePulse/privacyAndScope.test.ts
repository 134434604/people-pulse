import { describe, expect, it } from "vitest";
import { assertApprovedPublicChannel, ChannelScopeError } from "../../src/peoplePulse/channelGuard.js";
import { boundedEvidenceSummary, containsProhibitedIdentifier, sanitizeSlackText } from "../../src/peoplePulse/sanitize.js";
import { createSafeLogger } from "../../src/peoplePulse/safeLog.js";
import type { ChannelScope } from "../../src/peoplePulse/schemas.js";

const approved: ChannelScope = {
  department: "Engineering",
  channelId: "CENG01",
  channelName: "#engineering",
  conversationType: "public_channel",
  mappingSource: "manual",
  include: true,
  approvedBy: "Executive Sponsor",
  approvedDate: "2026-08-01"
};

describe("People Pulse scope and privacy", () => {
  it("accepts only an explicitly approved public channel", () => {
    expect(assertApprovedPublicChannel("CENG01", [approved])).toEqual(approved);
    expect(() => assertApprovedPublicChannel("COTHER1", [approved])).toThrow(ChannelScopeError);
    expect(() => assertApprovedPublicChannel("CENG01", [{ ...approved, include: false }])).toThrow("not included");
    expect(() => assertApprovedPublicChannel("CENG01", [{ ...approved, approvedBy: "" }])).toThrow("not approved");
  });

  it("removes identifiers and bounds evidence to 80 characters", () => {
    const raw = "Please ask alex@example.com or <@U12345678> about U87654321. " + "x".repeat(120);
    const sanitized = sanitizeSlackText(raw);
    const bounded = boundedEvidenceSummary(raw, 80);
    expect(containsProhibitedIdentifier(sanitized)).toBe(false);
    expect(bounded.length).toBeLessThanOrEqual(80);
  });

  it("allows operational counts but rejects content-bearing log fields", () => {
    const lines: string[] = [];
    const logger = createSafeLogger((line) => lines.push(line));
    logger.info("people_pulse_collected", { messagesRead: 12, channelsRead: 4, runId: "pp_demo" });
    expect(lines).toHaveLength(1);
    expect(() => logger.info("unsafe", { message: "private content" })).toThrow("Unsafe People Pulse log field");
  });
});
