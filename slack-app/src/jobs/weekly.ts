import type { WebClient } from "@slack/web-api";
import type { AppConfig } from "../config.js";
import { findUpcomingAnniversaries } from "../domain/anniversaries.js";
import type { QueueRecord, QueueStore } from "../domain/types.js";
import { reviewBlocks } from "../slack/blocks.js";
import type { ClaudeDraftService } from "../services/claude.js";
import type { SlackHistoryService } from "../services/slackHistory.js";

export interface WeeklySummary { found: number; created: number; refreshed: number; skippedExisting: number; skippedFinal: number; errors: number; }

export async function runWeeklyJob(deps: {
  config: AppConfig;
  store: QueueStore;
  client: WebClient;
  claude: ClaudeDraftService;
  history: SlackHistoryService;
  now?: Date;
}): Promise<WeeklySummary> {
  const { config, store, client, claude, history } = deps;
  await store.ensureReady();
  const employees = await store.listEmployees();
  const anniversaries = findUpcomingAnniversaries(employees, deps.now ?? new Date(), config.WEEKLY_LOOKAHEAD_DAYS);
  const summary: WeeklySummary = { found: anniversaries.length, created: 0, refreshed: 0, skippedExisting: 0, skippedFinal: 0, errors: 0 };

  for (const anniversary of anniversaries) {
    const existing = await store.getQueue(anniversary.queueId);
    if (existing && ["Posted", "Dry Run Approved", "Skipped"].includes(existing.status)) {
      summary.skippedFinal += 1;
      continue;
    }
    if (existing?.reviewMessageTimestamp && existing.status !== "Error") {
      summary.skippedExisting += 1;
      continue;
    }
    try {
      const prior = await history.findPriorMessage(anniversary);
      const drafts = await claude.generate(anniversary, prior);
      const timestamp = new Date().toISOString();
      const record: QueueRecord = {
        queueId: anniversary.queueId,
        employeeId: anniversary.employee.employeeId,
        employeeName: anniversary.employee.displayName,
        slackUserId: anniversary.employee.slackUserId,
        eventDate: anniversary.occurrenceDate,
        year: anniversary.year,
        yearsOfService: anniversary.yearsOfService,
        department: anniversary.employee.department,
        priorMessage: prior.text,
        priorMessageUrl: prior.url,
        priorMessageTimestamp: prior.timestamp,
        variants: drafts.variants,
        selectedVariant: "",
        finalMessage: "",
        status: "Needs Review",
        reviewChannelId: config.SLACK_REVIEW_CHANNEL_ID,
        reviewMessageTimestamp: existing?.reviewMessageTimestamp || "",
        postedChannelId: "",
        postedMessageTimestamp: "",
        postedMessageUrl: "",
        approvedBy: "",
        approvedAt: "",
        createdAt: existing?.createdAt || timestamp,
        updatedAt: timestamp,
        error: drafts.warnings.join(" ")
      };
      await store.upsertQueue(record);
      if (record.reviewMessageTimestamp) {
        await client.chat.update({ channel: record.reviewChannelId, ts: record.reviewMessageTimestamp, text: reviewText(record), blocks: reviewBlocks(record) });
        summary.refreshed += 1;
      } else {
        const message = await client.chat.postMessage({ channel: record.reviewChannelId, text: reviewText(record), blocks: reviewBlocks(record) });
        if (!message.ts) throw new Error("Slack did not return a review message timestamp.");
        record.reviewMessageTimestamp = message.ts;
        summary.created += 1;
      }
      await store.upsertQueue(record);
    } catch (error) {
      summary.errors += 1;
      const message = error instanceof Error ? error.message : "Unknown weekly job error.";
      await client.chat.postMessage({ channel: config.SLACK_REVIEW_CHANNEL_ID, text: `Unable to prepare ${anniversary.employee.displayName}: ${message}` });
    }
  }

  await client.chat.postMessage({
    channel: config.SLACK_REVIEW_CHANNEL_ID,
    text: summary.found
      ? `Weekly anniversary review ready: ${summary.created} created, ${summary.refreshed} refreshed, ${summary.skippedExisting} already awaiting review, ${summary.skippedFinal} already final, ${summary.errors} errors.`
      : `No work anniversaries were found in the next ${config.WEEKLY_LOOKAHEAD_DAYS} days.`
  });
  return summary;
}

function reviewText(record: QueueRecord): string { return `${record.employeeName} has a ${record.yearsOfService}-year work anniversary on ${record.eventDate}. Review three message options.`; }
