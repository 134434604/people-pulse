import type { PeoplePulseConfig } from "./config.js";
import type { CollectionResult } from "./slackCollector.js";
import type { EvidenceReference, TaskObservation } from "./schemas.js";
import { boundedEvidenceSummary, deterministicId, sanitizeSlackText, sha256 } from "./sanitize.js";

export interface ObservationExtractionResult {
  observations: TaskObservation[];
  evidence: EvidenceReference[];
}

interface Rule {
  kind: TaskObservation["kind"];
  pattern: RegExp;
  summary: string;
  ownerState: TaskObservation["ownerState"];
}

const RULES: readonly Rule[] = [
  {
    kind: "waiting-decision",
    pattern: /\b(need(?:s)? (?:a )?(?:decision|approval|sign-?off)|waiting (?:for|on) (?:a )?(?:decision|approval)|please (?:approve|confirm|choose)|blocked until .*?(?:approve|confirm|choose))\b/i,
    summary: "A task is waiting for a decision or approval.",
    ownerState: "unknown"
  },
  {
    kind: "ownership-gap",
    pattern: /\b(no owner|need(?:s)? an owner|who owns|ownership (?:is )?(?:unclear|missing)|unassigned)\b/i,
    summary: "A task has no clearly stated owner.",
    ownerState: "missing"
  },
  {
    kind: "handoff-gap",
    pattern: /\b(handoff|hand-off|blocked by|waiting on|stuck between|passed (?:to|between))\b/i,
    summary: "A cross-team handoff may be blocking progress.",
    ownerState: "unknown"
  },
  {
    kind: "recurring-work",
    pattern: /\b(every week|each week|every month|each time|again this week|recurring|repeatedly|manual(?:ly)? every|repeat this)\b/i,
    summary: "A repeatable task may benefit from a clearer process or automation.",
    ownerState: "unknown"
  },
  {
    kind: "coverage-risk",
    pattern: /\b(only person|single point|no backup|need(?:s)? backup|coverage gap|no coverage|while .*? out|out of office)\b/i,
    summary: "A task or workflow may lack backup coverage.",
    ownerState: "explicit"
  }
];

export function extractTaskObservations(
  collection: CollectionResult,
  now: Date,
  config: PeoplePulseConfig
): ObservationExtractionResult {
  const observations: TaskObservation[] = [];
  const evidenceById = new Map<string, EvidenceReference>();

  for (const channel of collection.channels) {
    for (const message of channel.messages) {
      const sanitized = sanitizeSlackText(message.text);
      const taskArea = classifyTaskArea(sanitized);
      const explicitOwner = /\b(owner\s*:|owned by|i(?:'|’)ll own|i will own|responsible\s*:|accountable\s*:)/i.test(sanitized);
      const dueWindow = extractDueWindow(sanitized);
      const permalink = message.permalink ?? buildFallbackPermalink(channel.scope.channelId, message.timestamp);
      const evidence = buildEvidence({
        department: channel.scope.department,
        channelId: channel.scope.channelId,
        channelName: channel.scope.channelName,
        timestamp: message.timestamp,
        threadTimestamp: message.threadTimestamp,
        permalink,
        text: sanitized,
        now,
        maximumCharacters: config.maximumExcerptCharacters
      });

      const matchedKinds = new Set<TaskObservation["kind"]>();
      for (const rule of RULES) {
        if (!rule.pattern.test(sanitized)) continue;
        matchedKinds.add(rule.kind);
        evidenceById.set(evidence.id, evidence);
        observations.push(buildObservation({
          kind: rule.kind,
          summary: rule.summary,
          ownerState: rule.kind === "ownership-gap" ? "missing" : explicitOwner ? "explicit" : rule.ownerState,
          taskArea,
          department: channel.scope.department,
          evidenceId: evidence.id,
          occurredAt: message.timestamp,
          waitingHours: hoursBetween(message.lastReplyAt ?? message.timestamp, now),
          replyCount: message.replyCount,
          dueWindow,
          fingerprintSource: fingerprintTopic(sanitized, taskArea, rule.kind)
        }));
      }

      const lastActivity = message.lastReplyAt ?? message.timestamp;
      const silentHours = hoursBetween(lastActivity, now);
      const isNeedsAttentionThread =
        !message.threadTimestamp &&
        message.replyCount >= config.minimumAttentionReplies &&
        silentHours >= config.attentionAfterHours;
      if (isNeedsAttentionThread && !matchedKinds.has("waiting-decision")) {
        evidenceById.set(evidence.id, evidence);
        observations.push(buildObservation({
          kind: "waiting-decision",
          summary: "An active thread has gone quiet and may need a decision or follow-up.",
          ownerState: "unknown",
          taskArea,
          department: channel.scope.department,
          evidenceId: evidence.id,
          occurredAt: message.timestamp,
          waitingHours: silentHours,
          replyCount: message.replyCount,
          dueWindow,
          fingerprintSource: fingerprintTopic(sanitized, taskArea, "waiting-decision")
        }));
      }
    }
  }

  return {
    observations: deduplicateObservations(observations),
    evidence: [...evidenceById.values()].sort((left, right) => left.messageTimestamp.localeCompare(right.messageTimestamp))
  };
}

function buildEvidence(input: {
  department: string;
  channelId: string;
  channelName: string;
  timestamp: string;
  threadTimestamp?: string;
  permalink: string;
  text: string;
  now: Date;
  maximumCharacters: number;
}): EvidenceReference {
  const identity = `${input.channelId}:${input.timestamp}`;
  return {
    id: deterministicId("ev", identity),
    department: input.department,
    channelId: input.channelId,
    channelName: input.channelName,
    messageTimestamp: input.timestamp,
    ...(input.threadTimestamp ? { threadTimestamp: input.threadTimestamp } : {}),
    permalink: input.permalink,
    boundedSummary: boundedEvidenceSummary(input.text, Math.min(80, input.maximumCharacters)),
    contentHash: sha256(input.text),
    observedAt: input.now.toISOString()
  };
}

function buildObservation(input: {
  kind: TaskObservation["kind"];
  summary: string;
  ownerState: TaskObservation["ownerState"];
  taskArea: string;
  department: string;
  evidenceId: string;
  occurredAt: string;
  waitingHours: number;
  replyCount: number;
  dueWindow: string;
  fingerprintSource: string;
}): TaskObservation {
  const identity = `${input.kind}:${input.evidenceId}:${input.taskArea}`;
  return {
    id: deterministicId("obs", identity),
    fingerprint: sha256(input.fingerprintSource).slice(0, 32),
    kind: input.kind,
    taskArea: input.taskArea,
    summary: input.summary,
    departments: [input.department],
    evidenceIds: [input.evidenceId],
    occurredAt: input.occurredAt,
    waitingHours: Math.max(0, Math.round(input.waitingHours * 10) / 10),
    dueWindow: input.dueWindow,
    replyCount: input.replyCount,
    ownerState: input.ownerState,
    impact: input.waitingHours >= 96 || input.replyCount >= 8 ? "high" : input.waitingHours >= 48 ? "medium" : "low",
    confidence: input.kind === "waiting-decision" && input.replyCount >= 3 ? 0.9 : 0.82
  };
}

function classifyTaskArea(text: string): string {
  const areas: readonly [RegExp, string][] = [
    [/\b(report|spreadsheet|reconcile|reconciliation|forecast|metric)\b/i, "Reporting and reconciliation"],
    [/\b(inventory|stock|warehouse|fulfill|shipment|shipping)\b/i, "Inventory and fulfillment"],
    [/\b(creative|campaign|launch|content|ad copy|promotion)\b/i, "Campaign execution"],
    [/\b(customer|ticket|refund|support|response)\b/i, "Customer care"],
    [/\b(approve|approval|sign-?off|decision|confirm)\b/i, "Approvals and decisions"],
    [/\b(deploy|release|incident|bug|engineering|technical)\b/i, "Product and engineering"],
    [/\b(hire|onboard|training|coverage|backup|out of office)\b/i, "Team coverage"],
    [/\b(vendor|purchase|procurement|invoice)\b/i, "Vendor operations"]
  ];
  return areas.find(([pattern]) => pattern.test(text))?.[1] ?? "Cross-functional operations";
}

function fingerprintTopic(text: string, taskArea: string, kind: TaskObservation["kind"]): string {
  const stableTerms = text
    .toLowerCase()
    .replace(/\b\d+(?:\.\d+)?\b/g, "")
    .replace(/[^a-z ]/g, " ")
    .split(/\s+/)
    .filter((term) => term.length >= 5)
    .filter((term) => !["again", "every", "waiting", "needs", "please", "this", "week"].includes(term))
    .slice(0, 6)
    .sort()
    .join("-");
  return `${kind}:${taskArea}:${stableTerms || "general"}`;
}

function hoursBetween(timestamp: string, now: Date): number {
  return Math.max(0, (now.getTime() - Date.parse(timestamp)) / (60 * 60 * 1_000));
}

function buildFallbackPermalink(channelId: string, timestamp: string): string {
  return `https://slack.example.invalid/archives/${channelId}/p${Date.parse(timestamp)}`;
}

function extractDueWindow(text: string): string {
  const match = text.match(/\b(?:due|deadline|needed|required|complete|decide|decision)\s+(?:by\s+)?(?:today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|end of (?:day|week|month)|[a-z]{3,9}\s+\d{1,2})\b/i);
  return match?.[0]?.slice(0, 80) ?? "";
}

function deduplicateObservations(observations: readonly TaskObservation[]): TaskObservation[] {
  return [...new Map(observations.map((observation) => [observation.id, observation])).values()]
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
}
