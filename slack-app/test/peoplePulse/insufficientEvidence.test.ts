import { describe, expect, it } from "vitest";
import { buildInsufficientEvidenceSignal } from "../../src/peoplePulse/signals.js";
import { workSignalSchema } from "../../src/peoplePulse/schemas.js";

describe("insufficient evidence classification", () => {
  it("makes missing scope explicit without making a department judgment", () => {
    const signal = workSignalSchema.parse(buildInsufficientEvidenceSignal("Finance", "2026-08-20T20:00:00.000Z"));
    expect(signal.type).toBe("insufficient-evidence");
    expect(signal.evidenceIds).toEqual([]);
    expect(signal.interpretation).toContain("evidence limitation");
    expect(signal.interpretation).not.toMatch(/productive|sentiment|performance/i);
  });
});
