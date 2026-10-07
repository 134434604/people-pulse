import type { QueueRecord, VariantLabel } from "../domain/types.js";

type Block = any;

export function reviewBlocks(record: QueueRecord): Block[] {
  const prior = record.priorMessageUrl
    ? `<${record.priorMessageUrl}|View prior message> · ${excerpt(record.priorMessage, 240)}`
    : "Prior Slack anniversary message not found. HR should verify before approval.";
  const blocks: Block[] = [
    { type: "header", text: { type: "plain_text", text: `${record.employeeName} · ${record.yearsOfService} years`, emoji: true } },
    { type: "context", elements: [{ type: "mrkdwn", text: `*Anniversary:* ${record.eventDate}   •   *Status:* ${record.status}` }] },
    { type: "section", text: { type: "mrkdwn", text: `*Prior message*\n${prior}` } },
    { type: "divider" }
  ];
  for (const variant of record.variants) {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: `*${variant.label}*\n${escape(variant.message)}` } });
  }
  blocks.push({
    type: "actions",
    block_id: `choose_${record.queueId}`,
    elements: (["Warm", "Professional", "Concise"] as VariantLabel[]).map((label) => ({
      type: "button", text: { type: "plain_text", text: `Choose ${label}` }, action_id: "select_variant", value: `${record.queueId}|${label}`
    }))
  });
  blocks.push({
    type: "actions",
    block_id: `manage_${record.queueId}`,
    elements: [
      { type: "button", text: { type: "plain_text", text: "Regenerate" }, action_id: "regenerate", value: record.queueId },
      { type: "button", text: { type: "plain_text", text: "Skip" }, style: "danger", action_id: "skip", value: record.queueId }
    ]
  });
  blocks.push({ type: "context", elements: [{ type: "mrkdwn", text: "Nothing is posted publicly until HR selects a draft and completes final confirmation." }] });
  return blocks;
}

export function selectedBlocks(record: QueueRecord): Block[] {
  return [
    { type: "header", text: { type: "plain_text", text: `Final review · ${record.employeeName}`, emoji: true } },
    { type: "context", elements: [{ type: "mrkdwn", text: `*${record.yearsOfService}-year anniversary* · ${record.eventDate} · Selected: ${record.selectedVariant || "Edited"}` }] },
    { type: "section", text: { type: "mrkdwn", text: escape(record.finalMessage) } },
    {
      type: "actions",
      block_id: `final_${record.queueId}`,
      elements: [
        { type: "button", text: { type: "plain_text", text: "Approve & Post" }, style: "primary", action_id: "approve_post", value: record.queueId },
        { type: "button", text: { type: "plain_text", text: "Edit" }, action_id: "edit_message", value: record.queueId },
        { type: "button", text: { type: "plain_text", text: "Back" }, action_id: "back_to_variants", value: record.queueId },
        { type: "button", text: { type: "plain_text", text: "Skip" }, style: "danger", action_id: "skip", value: record.queueId }
      ]
    },
    { type: "context", elements: [{ type: "mrkdwn", text: "Approve & Post opens a second confirmation. The app never bulk-posts messages." }] }
  ];
}

export function statusBlocks(record: QueueRecord): Block[] {
  const destination = record.postedMessageUrl ? `<${record.postedMessageUrl}|View posted message>` : "No public Slack message was created.";
  return [
    { type: "header", text: { type: "plain_text", text: `${record.employeeName} · ${record.status}`, emoji: true } },
    { type: "section", text: { type: "mrkdwn", text: escape(record.finalMessage || "No message selected.") } },
    { type: "context", elements: [{ type: "mrkdwn", text: `${destination}${record.approvedBy ? ` · Approved by <@${record.approvedBy}>` : ""}` }] }
  ];
}

export function editModal(record: QueueRecord): any {
  return {
    type: "modal",
    callback_id: "edit_message_modal",
    private_metadata: record.queueId,
    title: { type: "plain_text", text: "Edit message" },
    submit: { type: "plain_text", text: "Save" },
    close: { type: "plain_text", text: "Cancel" },
    blocks: [{
      type: "input", block_id: "message", label: { type: "plain_text", text: "Final Slack message" },
      element: { type: "plain_text_input", action_id: "value", multiline: true, initial_value: record.finalMessage }
    }]
  };
}

export function confirmationModal(record: QueueRecord, dryRun: boolean): any {
  return {
    type: "modal",
    callback_id: "confirm_post_modal",
    private_metadata: record.queueId,
    title: { type: "plain_text", text: dryRun ? "Dry-run approval" : "Confirm public post" },
    submit: { type: "plain_text", text: dryRun ? "Confirm test" : "Post" },
    close: { type: "plain_text", text: "Cancel" },
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: `*${escape(record.employeeName)}*\n${escape(record.finalMessage)}` } },
      { type: "input", block_id: "confirmation", label: { type: "plain_text", text: dryRun ? "Type TEST to confirm" : "Type POST to confirm" }, element: { type: "plain_text_input", action_id: "value" } }
    ]
  };
}

function escape(value: string): string { return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function excerpt(value: string, length: number): string { const clean = escape(value).replace(/\s+/g, " ").trim(); return clean.length > length ? `${clean.slice(0, length - 1)}…` : clean; }
