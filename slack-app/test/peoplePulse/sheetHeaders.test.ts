import { describe, expect, it } from "vitest";
import { appendMissingHeaders, DEPT_CHANNEL_MAP_HEADERS, INSIGHTS_RUNS_HEADERS } from "../../src/peoplePulse/sheetHeaders.js";

describe("People Pulse sheet bootstrap headers", () => {
  it("preserves existing columns and appends only missing headers", () => {
    const existing = ["Legacy Column", "Department", "Channel ID"];
    const merged = appendMissingHeaders(existing, DEPT_CHANNEL_MAP_HEADERS);
    expect(merged.slice(0, existing.length)).toEqual(existing);
    expect(merged.filter((header) => header === "Department")).toHaveLength(1);
    expect(merged.at(-1)).toBe("Approved Date");
  });

  it("defines the complete audit contract without message bodies or PII", () => {
    expect(INSIGHTS_RUNS_HEADERS).toContain("Output Hash");
    expect(INSIGHTS_RUNS_HEADERS).toContain("Tokens In/Out");
    expect(INSIGHTS_RUNS_HEADERS.join(" ")).not.toMatch(/message body|employee|email|prompt/i);
  });
});
