import { describe, expect, it, vi } from "vitest";
import type { AppConfig } from "../src/config.js";
import type { Employee, QueueRecord, QueueStore } from "../src/domain/types.js";
import { runWeeklyJob } from "../src/jobs/weekly.js";

class MemoryStore implements QueueStore {
  records = new Map<string, QueueRecord>();
  constructor(private readonly employees: Employee[]) {}
  async ensureReady() {}
  async listEmployees() { return this.employees; }
  async getQueue(id: string) { return this.records.get(id) ?? null; }
  async upsertQueue(record: QueueRecord) { this.records.set(record.queueId, structuredClone(record)); }
  async appendHistory() {}
}

const config = {
  DRY_RUN: true, WEEKLY_LOOKAHEAD_DAYS: 7, SLACK_REVIEW_CHANNEL_ID: "C-REVIEW", SLACK_CELEBRATION_CHANNEL_ID: "C-PUBLIC"
} as AppConfig;

describe("weekly job", () => {
  it("creates private review cards without posting to the celebration channel", async () => {
    const store = new MemoryStore([{
      employeeId: "E-1", active: true, firstName: "Jordan", lastName: "Lee", preferredName: "Jordan", displayName: "Jordan Lee",
      hireDate: "2021-07-20", department: "People", slackUserId: "U1", toneNotes: ""
    }]);
    const postMessage = vi.fn().mockResolvedValue({ ts: "100.1" });
    const summary = await runWeeklyJob({
      config,
      store,
      now: new Date("2026-07-20T12:00:00Z"),
      client: { chat: { postMessage, update: vi.fn() } } as any,
      history: { findPriorMessage: vi.fn().mockResolvedValue({ found: true, text: "Last year's wording", url: "https://slack.test/old", timestamp: "1" }) } as any,
      claude: { generate: vi.fn().mockResolvedValue({ variants: [
        { label: "Warm", message: "Warm message" }, { label: "Professional", message: "Professional message" }, { label: "Concise", message: "Concise message" }
      ], warnings: [] }) } as any
    });
    expect(summary).toMatchObject({ found: 1, created: 1, errors: 0 });
    expect(store.records.get("E-1_ANNIVERSARY_2026")?.reviewMessageTimestamp).toBe("100.1");
    expect(postMessage.mock.calls.some(([arg]) => arg.channel === "C-PUBLIC")).toBe(false);
  });

  it("does not regenerate or duplicate an existing review card", async () => {
    const store = new MemoryStore([{
      employeeId: "E-1", active: true, firstName: "Jordan", lastName: "Lee", preferredName: "Jordan", displayName: "Jordan Lee",
      hireDate: "2021-07-20", department: "People", slackUserId: "U1", toneNotes: ""
    }]);
    store.records.set("E-1_ANNIVERSARY_2026", {
      queueId: "E-1_ANNIVERSARY_2026", employeeId: "E-1", employeeName: "Jordan Lee", slackUserId: "U1", eventDate: "2026-07-20",
      year: 2026, yearsOfService: 5, department: "People", priorMessage: "", priorMessageUrl: "", priorMessageTimestamp: "",
      variants: [], selectedVariant: "", finalMessage: "", status: "Needs Review", reviewChannelId: "C-REVIEW", reviewMessageTimestamp: "100.1",
      postedChannelId: "", postedMessageTimestamp: "", postedMessageUrl: "", approvedBy: "", approvedAt: "", createdAt: "x", updatedAt: "x", error: ""
    });
    const generate = vi.fn();
    const summary = await runWeeklyJob({
      config, store, now: new Date("2026-07-20T12:00:00Z"), client: { chat: { postMessage: vi.fn().mockResolvedValue({ ts: "summary" }) } } as any,
      history: { findPriorMessage: vi.fn() } as any, claude: { generate } as any
    });
    expect(summary.skippedExisting).toBe(1);
    expect(generate).not.toHaveBeenCalled();
  });
});
