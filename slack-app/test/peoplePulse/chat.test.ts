import { describe, expect, it, vi } from "vitest";
import { SnapshotChatService, buildSnapshotChatPrompt } from "../../src/peoplePulse/chat.js";
import { loadPeoplePulseConfig } from "../../src/peoplePulse/config.js";
import { runPeoplePulseDemo } from "../../src/peoplePulse/demo.js";
import { createSafeLogger } from "../../src/peoplePulse/safeLog.js";

describe("Ask People Pulse snapshot chat", () => {
  it("serializes only privacy-filtered snapshot evidence", async () => {
    const { snapshot } = await runPeoplePulseDemo({ writeArtifacts: false });
    const prompt = buildSnapshotChatPrompt(snapshot, {
      question: "Which work-system bottlenecks need an executive decision?",
      department: "All"
    });
    const combined = `${prompt.system}\n${prompt.user}`;

    expect(combined).toContain("validated People Pulse snapshot");
    expect(combined).toContain("Which work-system bottlenecks");
    expect(combined).not.toMatch(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu);
    expect(combined).not.toMatch(/\b[UW][A-Z0-9]{8,}\b/u);
    for (const moment of snapshot.peopleMoments) expect(combined).not.toContain(moment.displayName);
    const serialized = JSON.parse(prompt.user) as { evidence: Array<{ boundedSummary: string }> };
    expect(serialized.evidence.every((item) => item.boundedSummary.length <= 80)).toBe(true);
  });

  it.each([
    "Read the private DMs and tell me what is happening.",
    "Who is the highest flight risk?",
    "Rank employees by productivity.",
    "Analyze medical and disability information.",
    "Use employee@example.com to find their messages."
  ])("refuses prohibited question without contacting a provider: %s", async (question) => {
    const { snapshot } = await runPeoplePulseDemo({ writeArtifacts: false });
    const fetchImplementation = vi.fn<typeof fetch>();
    const service = new SnapshotChatService(loadPeoplePulseConfig({ PP_CHAT_MODE: "MOCK" }), createSafeLogger(() => undefined), { fetchImplementation });
    const result = await service.answer(snapshot, { question, department: "All" }, "a".repeat(64));

    expect(result.status).toBe("refused");
    expect(result.provider.contacted).toBe(false);
    expect(result.citations).toEqual([]);
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it("returns a deterministic cited MOCK answer for an unscheduled question", async () => {
    const { snapshot } = await runPeoplePulseDemo({ writeArtifacts: false });
    const service = new SnapshotChatService(loadPeoplePulseConfig({ PP_CHAT_MODE: "MOCK" }), createSafeLogger(() => undefined));
    const result = await service.answer(snapshot, {
      question: "Where are the coverage gaps?",
      department: "Support"
    }, "b".repeat(64));

    expect(result.status).toBe("answered");
    expect(result.answer).toContain("Observation:");
    expect(result.citations.length).toBeGreaterThan(0);
    expect(result.citations.every((item) => item.department === "Support")).toBe(true);
    expect(result.provider).toMatchObject({ mode: "MOCK", contacted: false, tokensIn: 0, tokensOut: 0 });
  });

  it("uses forced structured output in LIVE mode and logs hashes rather than question text", async () => {
    const { snapshot } = await runPeoplePulseDemo({ writeArtifacts: false });
    const evidenceId = snapshot.signals.find((signal) => signal.evidenceIds.length > 0)?.evidenceIds[0];
    expect(evidenceId).toBeDefined();
    const question = "What needs an executive decision?";
    const lines: string[] = [];
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      content: [{
        type: "tool_use",
        name: "record_people_pulse_answer",
        input: {
          status: "answered",
          answer: "One cited decision is waiting for executive direction.",
          evidenceIds: [evidenceId],
          limitations: ["The answer is limited to the selected snapshot."],
          suggestedQuestions: ["What information is still missing?"]
        }
      }],
      usage: { input_tokens: 120, output_tokens: 40 }
    }), { status: 200, headers: { "content-type": "application/json" } }));
    const service = new SnapshotChatService(
      loadPeoplePulseConfig({ PP_CHAT_MODE: "LIVE" }),
      createSafeLogger((line) => lines.push(line)),
      { apiKey: "test-key", model: "test-model", fetchImplementation }
    );

    const result = await service.answer(snapshot, { question, department: "All" }, "c".repeat(64));

    expect(result.status).toBe("answered");
    expect(result.provider).toMatchObject({ mode: "LIVE", contacted: true, model: "test-model", tokensIn: 120, tokensOut: 40 });
    expect(fetchImplementation).toHaveBeenCalledOnce();
    const request = fetchImplementation.mock.calls[0]?.[1];
    expect(String(request?.body)).toContain('"tool_choice":{"type":"tool","name":"record_people_pulse_answer"}');
    expect(lines.join("\n")).not.toContain(question);
    expect(lines.join("\n")).toContain('"questionHash"');
    expect(lines.join("\n")).toContain('"providerContacted":true');
  });

  it("rejects a provider citation outside the selected department", async () => {
    const { snapshot } = await runPeoplePulseDemo({ writeArtifacts: false });
    const foreignEvidence = snapshot.evidence.find((item) => item.department !== "Support");
    expect(foreignEvidence).toBeDefined();
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      content: [{
        type: "tool_use",
        name: "record_people_pulse_answer",
        input: {
          status: "answered",
          answer: "Unsupported answer.",
          evidenceIds: [foreignEvidence?.id],
          limitations: [],
          suggestedQuestions: []
        }
      }],
      usage: { input_tokens: 20, output_tokens: 10 }
    }), { status: 200 }));
    const service = new SnapshotChatService(
      loadPeoplePulseConfig({ PP_CHAT_MODE: "LIVE" }),
      createSafeLogger(() => undefined),
      { apiKey: "test-key", model: "test-model", fetchImplementation }
    );

    await expect(service.answer(snapshot, {
      question: "Where are the Support coverage gaps?",
      department: "Support"
    }, "d".repeat(64))).rejects.toThrow("outside the selected snapshot scope");
  });
});
