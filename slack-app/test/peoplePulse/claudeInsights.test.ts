import { describe, expect, it } from "vitest";
import { ClaudeInsightsService } from "../../src/peoplePulse/claudeInsights.js";
import { loadPeoplePulseConfig } from "../../src/peoplePulse/config.js";
import type { DepartmentInsightsInput } from "../../src/peoplePulse/insightsPrompt.js";
import { createSafeLogger } from "../../src/peoplePulse/safeLog.js";

const input: DepartmentInsightsInput = {
  department: "Engineering",
  weekStart: "2026-08-17",
  aggregateStatistics: {
    approvedChannelNames: ["#engineering"],
    approvedChannels: 1,
    headcount: 6,
    uniqueParticipants: 3,
    weeklyMessageCounts: [1, 2, 3, 4, 5, 6, 7, 8]
  },
  taskFacts: [{
    observationId: "obs_0123456789abcdef",
    kind: "waiting-decision",
    taskArea: "Release coordination",
    sanitizedSummary: "A release decision is waiting.",
    occurredAt: "2026-08-18T12:00:00.000Z",
    evidenceIds: ["ev_0123456789abcdef"],
    boundedExcerpt: "Release timing needs a decision."
  }]
};

describe("ClaudeInsightsService", () => {
  it("returns deterministic, evidence-bound MOCK output with zero credentials", async () => {
    const service = new ClaudeInsightsService(
      loadPeoplePulseConfig({ PP_AI_MODE: "MOCK" }),
      createSafeLogger(() => undefined)
    );
    const first = await service.summarizeDepartments([input]);
    const second = await service.summarizeDepartments([input]);
    expect(first).toEqual(second);
    expect(first[0]?.usage).toMatchObject({ inputTokens: 0, outputTokens: 0, costEstimateUsd: 0 });
    expect(first[0]?.insight.assessments[0]?.evidenceIds).toEqual(["ev_0123456789abcdef"]);
  });

  it("forces tool use, temperature 0.3, retries a 429, and records token cost", async () => {
    const requestBodies: unknown[] = [];
    let calls = 0;
    const fakeFetch: typeof fetch = async (_input, init) => {
      requestBodies.push(JSON.parse(String(init?.body)));
      calls += 1;
      if (calls === 1) return new Response("rate limited", { status: 429, headers: { "retry-after": "0" } });
      return new Response(JSON.stringify({
        content: [{
          type: "tool_use",
          name: "record_department_insights",
          input: {
            department: "Engineering",
            executiveSummary: "One cited release decision is waiting.",
            assessments: [{
              observationIds: ["obs_0123456789abcdef"],
              evidenceIds: ["ev_0123456789abcdef"],
              interpretation: "The release workflow may need a named decision owner.",
              confidence: 0.84,
              missingInformation: ["Decision owner"]
            }]
          }
        }],
        usage: { input_tokens: 1_000, output_tokens: 200 }
      }), { status: 200, headers: { "content-type": "application/json" } });
    };
    const sleeps: number[] = [];
    const service = new ClaudeInsightsService(
      loadPeoplePulseConfig({ PP_AI_MODE: "LIVE", PP_MAX_RETRIES: "2" }),
      createSafeLogger(() => undefined),
      { apiKey: "test-key", model: "test-model", fetchImplementation: fakeFetch, sleep: async (ms) => { sleeps.push(ms); } }
    );
    const result = await service.summarizeDepartments([input]);
    expect(calls).toBe(2);
    expect(sleeps).toEqual([500]);
    expect(requestBodies[0]).toMatchObject({
      temperature: 0.3,
      tool_choice: { type: "tool", name: "record_department_insights" }
    });
    expect(result[0]?.usage).toMatchObject({ inputTokens: 1_000, outputTokens: 200, costEstimateUsd: 0.006 });
  });

  it("rejects evidence identifiers that were not in the request", async () => {
    const fakeFetch: typeof fetch = async () => new Response(JSON.stringify({
      content: [{
        type: "tool_use",
        name: "record_department_insights",
        input: {
          department: "Engineering",
          executiveSummary: "Unbound response.",
          assessments: [{
            observationIds: ["obs_ffffffffffffffff"],
            evidenceIds: ["ev_ffffffffffffffff"],
            interpretation: "Unsupported.",
            confidence: 0.5,
            missingInformation: []
          }]
        }
      }],
      usage: { input_tokens: 1, output_tokens: 1 }
    }), { status: 200 });
    const service = new ClaudeInsightsService(
      loadPeoplePulseConfig({ PP_AI_MODE: "LIVE" }),
      createSafeLogger(() => undefined),
      { apiKey: "test-key", model: "test-model", fetchImplementation: fakeFetch }
    );
    await expect(service.summarizeDepartments([input])).rejects.toThrow("unknown observation ID");
  });
});
