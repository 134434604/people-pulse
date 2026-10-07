import { z } from "zod";
import { peoplePulseModesSchema } from "./config.js";

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const isoDateTimeSchema = z.string().datetime({ offset: true });
const nonEmptyText = z.string().trim().min(1);
const boundedSummary = z.string().trim().min(1).max(180);
const slackPermalinkSchema = z.string().url().refine((value) => {
  const url = new URL(value);
  return url.protocol === "https:" && url.hostname.endsWith(".slack.com") && url.pathname.startsWith("/archives/");
}, "Expected an HTTPS Slack archive permalink.");

export const channelScopeSchema = z.object({
  department: nonEmptyText.max(80),
  channelId: z.string().regex(/^C[A-Z0-9-]{2,}$/),
  channelName: z.string().regex(/^#[a-z0-9][a-z0-9-_]*$/),
  conversationType: z.literal("public_channel"),
  mappingSource: z.enum(["auto-convention", "manual"]),
  include: z.boolean(),
  approvedBy: z.string().trim().max(120),
  approvedDate: z.union([isoDateSchema, z.literal("")])
}).strict();

export type ChannelScope = z.infer<typeof channelScopeSchema>;

export const collectionCheckpointSchema = z.object({
  channelId: z.string().regex(/^C[A-Z0-9-]{2,}$/),
  latestCollectedAt: isoDateTimeSchema,
  outputHash: z.string().regex(/^[a-f0-9]{64}$/)
}).strict();
export type CollectionCheckpoint = z.infer<typeof collectionCheckpointSchema>;

export const collectionRunSchema = z.object({
  runId: z.string().regex(/^pp_[a-zA-Z0-9_-]{8,120}$/),
  weekStart: isoDateSchema,
  startedAt: isoDateTimeSchema,
  completedAt: isoDateTimeSchema,
  channelsRead: z.number().int().min(0),
  messagesRead: z.number().int().min(0),
  providerCalls: z.number().int().min(0),
  checkpoints: z.array(collectionCheckpointSchema),
  status: z.enum(["complete", "partial", "failed"]),
  errorCode: z.string().trim().max(120)
}).strict();
export type CollectionRun = z.infer<typeof collectionRunSchema>;

export const auditEventSchema = z.object({
  eventId: z.string().regex(/^audit_[a-f0-9]{16}$/),
  runId: z.string().regex(/^pp_[a-zA-Z0-9_-]{8,120}$/),
  eventType: z.enum(["collection", "ai-summary", "snapshot-write", "decision-record", "decision-restore"]),
  occurredAt: isoDateTimeSchema,
  actorIdHash: z.string().regex(/^[a-f0-9]{64}$/),
  dataMode: z.enum(["TEST", "LIVE"]),
  providerContacted: z.boolean(),
  recordId: z.string().trim().min(1).max(140),
  detailCode: z.string().trim().max(120)
}).strict();
export type AuditEvent = z.infer<typeof auditEventSchema>;

export const rawSlackMessageSchema = z.object({
  channelId: z.string().regex(/^C[A-Z0-9-]{2,}$/),
  timestamp: isoDateTimeSchema,
  threadTimestamp: isoDateTimeSchema.optional(),
  lastReplyAt: isoDateTimeSchema.optional(),
  userId: z.string().trim().min(1).max(80).optional(),
  text: z.string().max(20_000),
  replyCount: z.number().int().min(0).default(0),
  subtype: z.string().trim().max(80).optional(),
  botId: z.string().trim().max(80).optional(),
  appId: z.string().trim().max(80).optional(),
  permalink: slackPermalinkSchema.optional()
}).strict();

export type RawSlackMessage = z.infer<typeof rawSlackMessageSchema>;

export const evidenceReferenceSchema = z.object({
  id: z.string().regex(/^ev_[a-f0-9]{16}$/),
  department: nonEmptyText.max(80),
  channelId: z.string().regex(/^C[A-Z0-9-]{2,}$/),
  channelName: z.string().regex(/^#[a-z0-9][a-z0-9-_]*$/),
  messageTimestamp: isoDateTimeSchema,
  threadTimestamp: isoDateTimeSchema.optional(),
  permalink: slackPermalinkSchema,
  boundedSummary: z.string().max(80),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  observedAt: isoDateTimeSchema
}).strict();

export type EvidenceReference = z.infer<typeof evidenceReferenceSchema>;

export const observationKindSchema = z.enum([
  "waiting-decision",
  "ownership-gap",
  "handoff-gap",
  "recurring-work",
  "coverage-risk"
]);

export const taskObservationSchema = z.object({
  id: z.string().regex(/^obs_[a-f0-9]{16}$/),
  fingerprint: z.string().regex(/^[a-f0-9]{32}$/),
  kind: observationKindSchema,
  taskArea: nonEmptyText.max(80),
  summary: boundedSummary,
  departments: z.array(nonEmptyText.max(80)).min(1).max(8),
  evidenceIds: z.array(z.string().regex(/^ev_[a-f0-9]{16}$/)).min(1).max(20),
  occurredAt: isoDateTimeSchema,
  waitingHours: z.number().min(0).max(100_000),
  dueWindow: z.string().trim().max(80),
  replyCount: z.number().int().min(0).max(100_000),
  ownerState: z.enum(["explicit", "missing", "unknown"]),
  impact: z.enum(["low", "medium", "high"]),
  confidence: z.number().min(0).max(1)
}).strict();

export type TaskObservation = z.infer<typeof taskObservationSchema>;

export const signalAnswerSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{2,40}$/),
  label: nonEmptyText.max(80),
  concludes: z.boolean()
}).strict();

export const workSignalTypeSchema = z.enum([
  "waiting-decision",
  "ownership-gap",
  "handoff-gap",
  "recurring-work",
  "coverage-risk",
  "people-moment",
  "insufficient-evidence"
]);

export const workSignalSchema = z.object({
  id: z.string().regex(/^sig_[a-f0-9]{16}$/),
  type: workSignalTypeSchema,
  headline: nonEmptyText.max(140),
  detail: boundedSummary,
  observationSummary: boundedSummary,
  interpretation: boundedSummary,
  departments: z.array(nonEmptyText.max(80)).min(1).max(8),
  observationIds: z.array(z.string().regex(/^obs_[a-f0-9]{16}$/)).max(100),
  evidenceIds: z.array(z.string().regex(/^ev_[a-f0-9]{16}$/)).max(100),
  weeksObserved: z.number().int().min(1).max(52),
  firstObservedAt: isoDateTimeSchema,
  lastObservedAt: isoDateTimeSchema,
  urgency: z.enum(["today", "this-week", "monitor"]),
  confidence: z.number().min(0).max(1),
  missingInformation: z.array(z.string().trim().min(1).max(140)).max(8),
  suggestedAction: nonEmptyText.max(180),
  question: nonEmptyText.max(180),
  wrongDecisionRisk: nonEmptyText.max(220),
  acceptedAnswers: z.array(signalAnswerSchema).min(2).max(8),
  state: z.enum(["open", "answered", "concluded"]).default("open")
}).strict();

export type WorkSignal = z.infer<typeof workSignalSchema>;

export const capacitySignalSchema = z.object({
  id: z.string().regex(/^cap_[a-f0-9]{16}$/),
  taskArea: nonEmptyText.max(80),
  departments: z.array(nonEmptyText.max(80)).min(1).max(8),
  headline: nonEmptyText.max(140),
  evidenceIds: z.array(z.string().regex(/^ev_[a-f0-9]{16}$/)).min(1).max(200),
  observationIds: z.array(z.string().regex(/^obs_[a-f0-9]{16}$/)).min(1).max(200),
  weeksObserved: z.number().int().min(2).max(52),
  occurrenceCount: z.number().int().min(2).max(10_000),
  operationalImpact: boundedSummary,
  temporarySpikeAssessment: boundedSummary,
  interventions: z.tuple([
    z.literal("Clarify ownership"),
    z.literal("Improve the process or SOP"),
    z.literal("Automate or add tooling"),
    z.literal("Rebalance responsibilities"),
    z.literal("Add temporary capacity"),
    z.literal("Explore a role hypothesis")
  ]),
  roleHypothesis: z.string().trim().min(1).max(180),
  confidence: z.number().min(0).max(1),
  status: z.enum(["monitor", "review"])
}).strict();

export type CapacitySignal = z.infer<typeof capacitySignalSchema>;

export const departmentCoverageSchema = z.object({
  department: nonEmptyText.max(80),
  headcount: z.number().int().min(0).max(100_000),
  participationVsUsual: z.enum(["lower", "usual", "slightly-higher", "higher", "unknown"]),
  waitingForFollowUp: z.number().int().min(0).max(100_000),
  peopleMoments: z.number().int().min(0).max(100_000),
  whatToKnow: z.string().trim().max(180)
}).strict();
export type DepartmentCoverage = z.infer<typeof departmentCoverageSchema>;

export const peopleMomentSchema = z.object({
  id: z.string().regex(/^moment_[a-zA-Z0-9_-]{3,120}$/),
  initials: z.string().trim().min(1).max(4),
  displayName: nonEmptyText.max(80),
  description: nonEmptyText.max(140),
  dateLabel: nonEmptyText.max(40),
  department: nonEmptyText.max(80),
  actionLabel: nonEmptyText.max(60),
  queueUrl: z.string().regex(/^\/queue\/[a-zA-Z0-9_-]+$/)
}).strict();
export type PeopleMoment = z.infer<typeof peopleMomentSchema>;

export const activitySeriesSchema = z.object({
  department: nonEmptyText.max(80),
  indexedValues: z.array(z.number().min(0).max(200)).length(8)
}).strict();
export type ActivitySeries = z.infer<typeof activitySeriesSchema>;

export const recurringWorkAreaSchema = z.object({
  name: nonEmptyText.max(80),
  count: z.number().int().min(0).max(100_000),
  departments: z.array(nonEmptyText.max(80)).min(1).max(8)
}).strict();
export type RecurringWorkArea = z.infer<typeof recurringWorkAreaSchema>;

export const weeklySnapshotSchema = z.object({
  schemaVersion: z.literal(3),
  weekStart: isoDateSchema,
  generatedAt: isoDateTimeSchema,
  runId: z.string().regex(/^pp_[a-zA-Z0-9_-]{8,120}$/),
  outputHash: z.string().regex(/^[a-f0-9]{64}$/),
  modes: peoplePulseModesSchema,
  summary: nonEmptyText.max(220),
  departmentCoverage: z.array(departmentCoverageSchema).min(1).max(50),
  signals: z.array(workSignalSchema).max(500),
  capacitySignals: z.array(capacitySignalSchema).max(100),
  peopleMoments: z.array(peopleMomentSchema).max(500),
  activity: z.object({
    weekLabels: z.array(z.string().trim().min(1).max(20)).length(8),
    series: z.array(activitySeriesSchema).min(1).max(50)
  }).strict(),
  recurringWorkAreas: z.array(recurringWorkAreaSchema).max(20),
  evidence: z.array(evidenceReferenceSchema).max(5_000),
  audit: z.object({
    departments: z.number().int().min(1),
    channelsRead: z.number().int().min(0),
    messagesRead: z.number().int().min(0),
    taskObservations: z.number().int().min(0),
    signals: z.number().int().min(0),
    model: z.string().trim().max(120),
    tokensIn: z.number().int().min(0),
    tokensOut: z.number().int().min(0),
    costEstimateUsd: z.number().min(0),
    status: z.enum(["complete", "partial", "failed"]),
    errorCode: z.string().trim().max(120)
  }).strict()
}).strict();

export type WeeklySnapshot = z.infer<typeof weeklySnapshotSchema>;

export const signalDecisionSchema = z.object({
  id: z.string().regex(/^decision_[a-f0-9]{16}$/),
  signalId: z.string().regex(/^sig_[a-f0-9]{16}$/),
  // Signal IDs are derived from kind:taskArea and therefore recur across weeks; a decision
  // must be scoped to the week whose snapshot it was recorded against, or a conclusion in one
  // week silently marks the same-named signal resolved in every other week.
  week: isoDateSchema,
  answerId: z.string().regex(/^[a-z0-9-]{2,40}$/),
  answerLabel: nonEmptyText.max(80),
  note: z.string().trim().max(1_000),
  decidedBy: nonEmptyText.max(120),
  decidedAt: isoDateTimeSchema,
  composedInstruction: nonEmptyText.max(4_000),
  concludes: z.boolean(),
  restoredAt: isoDateTimeSchema.optional(),
  restoreReason: z.string().trim().max(500).optional()
}).strict();

export type SignalDecision = z.infer<typeof signalDecisionSchema>;
