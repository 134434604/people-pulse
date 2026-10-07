import { App } from "@slack/bolt";
import type { AppConfig } from "../config.js";
import type { Anniversary, QueueRecord, QueueStore, VariantLabel } from "../domain/types.js";
import { confirmationModal, editModal, reviewBlocks, selectedBlocks, statusBlocks } from "./blocks.js";
import type { ClaudeDraftService } from "../services/claude.js";

export function createSlackApp(config: AppConfig, store: QueueStore, claude: ClaudeDraftService): App {
  const app = new App({ token: config.SLACK_BOT_TOKEN, signingSecret: config.SLACK_SIGNING_SECRET! });
  const locks = new Set<string>();

  function authorized(userId: string): boolean { return config.approverIds.has(userId); }
  async function deny(respond?: (message: string) => Promise<unknown>): Promise<void> { if (respond) await respond("You are not authorized to approve HR anniversary messages."); }
  async function updateReview(record: QueueRecord, blocks: any[]): Promise<void> {
    await app.client.chat.update({ channel: record.reviewChannelId, ts: record.reviewMessageTimestamp, text: `${record.employeeName}: ${record.status}`, blocks });
  }

  app.action({ action_id: "select_variant" }, async ({ ack, body, action, respond }) => {
    await ack();
    if (!authorized(body.user.id)) return deny(respond);
    const [queueId, label] = String("value" in action ? action.value : "").split("|") as [string, VariantLabel];
    const record = await required(store, queueId);
    if (final(record)) { await respond("This anniversary is already final and cannot be changed."); return; }
    const selected = record.variants.find((variant) => variant.label === label);
    if (!selected) { await respond("The selected draft no longer exists. Refresh the weekly review."); return; }
    record.selectedVariant = label;
    record.finalMessage = selected.message;
    record.status = "Selected";
    record.updatedAt = new Date().toISOString();
    await store.upsertQueue(record);
    await updateReview(record, selectedBlocks(record));
  });

  app.action({ action_id: "back_to_variants" }, async ({ ack, body, action, respond }) => {
    await ack();
    if (!authorized(body.user.id)) return deny(respond);
    const record = await required(store, String("value" in action ? action.value : ""));
    if (final(record)) { await respond("This anniversary is already final."); return; }
    record.status = "Needs Review";
    record.updatedAt = new Date().toISOString();
    await store.upsertQueue(record);
    await updateReview(record, reviewBlocks(record));
  });

  app.action({ action_id: "skip" }, async ({ ack, body, action, respond }) => {
    await ack();
    if (!authorized(body.user.id)) return deny(respond);
    const record = await required(store, String("value" in action ? action.value : ""));
    if (record.status === "Posted") { await respond("This message was already posted."); return; }
    record.status = "Skipped";
    record.approvedBy = body.user.id;
    record.approvedAt = new Date().toISOString();
    record.updatedAt = record.approvedAt;
    await store.upsertQueue(record);
    await updateReview(record, statusBlocks(record));
  });

  app.action({ action_id: "edit_message" }, async ({ ack, body, action, client, respond }) => {
    await ack();
    if (!authorized(body.user.id)) return deny(respond);
    const record = await required(store, String("value" in action ? action.value : ""));
    if (final(record)) { await respond("This anniversary is already final."); return; }
    if (!("trigger_id" in body)) { await respond("Slack did not provide a modal trigger."); return; }
    await client.views.open({ trigger_id: body.trigger_id, view: editModal(record) });
  });

  app.view("edit_message_modal", async ({ ack, body, view }) => {
    if (!authorized(body.user.id)) return ack({ response_action: "errors", errors: { message: "You are not authorized." } });
    const value = view.state.values.message?.value?.value?.trim() || "";
    if (value.length < 10) return ack({ response_action: "errors", errors: { message: "Enter a complete message." } });
    await ack();
    const record = await required(store, view.private_metadata);
    if (final(record)) return;
    record.finalMessage = value;
    record.selectedVariant = "";
    record.status = "Selected";
    record.updatedAt = new Date().toISOString();
    await store.upsertQueue(record);
    await updateReview(record, selectedBlocks(record));
  });

  app.action({ action_id: "regenerate" }, async ({ ack, body, action, respond }) => {
    await ack();
    if (!authorized(body.user.id)) return deny(respond);
    const queueId = String("value" in action ? action.value : "");
    if (locks.has(queueId)) { await respond("Regeneration is already running."); return; }
    locks.add(queueId);
    try {
      const record = await required(store, queueId);
      if (final(record)) { await respond("This anniversary is already final."); return; }
      const anniversary = recordToAnniversary(record);
      const drafts = await claude.generate(anniversary, { found: Boolean(record.priorMessage), text: record.priorMessage, url: record.priorMessageUrl, timestamp: record.priorMessageTimestamp }, "Use fresh wording and structures.");
      record.variants = drafts.variants;
      record.selectedVariant = "";
      record.finalMessage = "";
      record.status = "Needs Review";
      record.error = drafts.warnings.join(" ");
      record.updatedAt = new Date().toISOString();
      await store.upsertQueue(record);
      await updateReview(record, reviewBlocks(record));
    } catch (error) {
      await respond(`Regeneration failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      locks.delete(queueId);
    }
  });

  app.action({ action_id: "approve_post" }, async ({ ack, body, action, client, respond }) => {
    await ack();
    if (!authorized(body.user.id)) return deny(respond);
    const record = await required(store, String("value" in action ? action.value : ""));
    if (final(record)) { await respond("This anniversary is already final."); return; }
    if (!("trigger_id" in body)) { await respond("Slack did not provide a modal trigger."); return; }
    await client.views.open({ trigger_id: body.trigger_id, view: confirmationModal(record, config.DRY_RUN) });
  });

  app.view("confirm_post_modal", async ({ ack, body, view, client }) => {
    if (!authorized(body.user.id)) return ack({ response_action: "errors", errors: { confirmation: "You are not authorized." } });
    const expected = config.DRY_RUN ? "TEST" : "POST";
    const confirmation = view.state.values.confirmation?.value?.value?.trim().toUpperCase();
    if (confirmation !== expected) return ack({ response_action: "errors", errors: { confirmation: `Type ${expected} exactly.` } });
    const queueId = view.private_metadata;
    if (locks.has(queueId)) return ack({ response_action: "errors", errors: { confirmation: "This message is already being processed." } });
    locks.add(queueId);
    try {
      const record = await required(store, queueId);
      if (final(record)) return ack({ response_action: "errors", errors: { confirmation: "This anniversary is already final." } });
      await ack();
      const timestamp = new Date().toISOString();
      if (config.DRY_RUN) {
        record.status = "Dry Run Approved";
      } else {
        const posted = await client.chat.postMessage({ channel: config.SLACK_CELEBRATION_CHANNEL_ID, text: record.finalMessage });
        if (!posted.ts) throw new Error("Slack did not return a posted message timestamp.");
        const permalink = await client.chat.getPermalink({ channel: config.SLACK_CELEBRATION_CHANNEL_ID, message_ts: posted.ts });
        record.status = "Posted";
        record.postedChannelId = config.SLACK_CELEBRATION_CHANNEL_ID;
        record.postedMessageTimestamp = posted.ts;
        record.postedMessageUrl = permalink.permalink || "";
      }
      record.approvedBy = body.user.id;
      record.approvedAt = timestamp;
      record.updatedAt = timestamp;
      await store.upsertQueue(record);
      await store.appendHistory(record);
      await updateReview(record, statusBlocks(record));
    } finally {
      locks.delete(queueId);
    }
  });

  return app;
}

async function required(store: QueueStore, queueId: string): Promise<QueueRecord> {
  const record = await store.getQueue(queueId);
  if (!record) throw new Error("Review queue record not found.");
  return record;
}
function final(record: QueueRecord): boolean { return ["Posted", "Dry Run Approved", "Skipped"].includes(record.status); }
function recordToAnniversary(record: QueueRecord): Anniversary {
  const [firstName, ...rest] = record.employeeName.split(" ");
  return {
    queueId: record.queueId, occurrenceDate: record.eventDate, year: record.year, yearsOfService: record.yearsOfService,
    employee: { employeeId: record.employeeId, active: true, firstName: firstName || record.employeeName, lastName: rest.join(" "), preferredName: firstName || record.employeeName, displayName: record.employeeName, hireDate: "", department: record.department, slackUserId: record.slackUserId, toneNotes: "" }
  };
}
