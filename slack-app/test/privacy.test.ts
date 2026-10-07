import { describe, expect, it } from "vitest";
import type { AppConfig } from "../src/config.js";
import { buildClaudePrompt } from "../src/services/claude.js";

describe("Claude prompt privacy", () => {
  it("excludes employee IDs, Slack IDs, and tone notes", () => {
    const prompt = buildClaudePrompt({
      DEFAULT_TONE: "Warm", WORD_LIMIT: 70, INCLUDE_DEPARTMENT: false
    } as AppConfig, {
      queueId: "SECRET-ID_ANNIVERSARY_2026", occurrenceDate: "2026-07-20", year: 2026, yearsOfService: 5,
      employee: { employeeId: "SECRET-ID", active: true, firstName: "Jordan", lastName: "Lee", preferredName: "Jordan", displayName: "Jordan Lee", hireDate: "2021-07-20", department: "Secret Department", slackUserId: "U-SECRET", toneNotes: "Private performance detail" }
    }, { found: true, text: "Prior approved message", url: "https://slack.test/secret", timestamp: "1" }, "standard", false);
    expect(prompt).toContain("Jordan");
    expect(prompt).toContain("Prior approved message");
    expect(prompt).not.toContain("SECRET-ID");
    expect(prompt).not.toContain("U-SECRET");
    expect(prompt).not.toContain("Private performance detail");
    expect(prompt).not.toContain("Secret Department");
    expect(prompt).not.toContain("slack.test");
  });
});
