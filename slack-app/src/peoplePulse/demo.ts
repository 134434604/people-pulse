import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { z } from "zod";
import { appendRunAuditIdempotent, writeWeeklyArtifact } from "./artifactStore.js";
import { buildCapacitySignals } from "./capacity.js";
import { ClaudeInsightsService } from "./claudeInsights.js";
import { loadPeoplePulseConfig } from "./config.js";
import { extractTaskObservations } from "./extractObservations.js";
import { FixtureSlackTransport } from "./fixtureTransport.js";
import type { DepartmentInsightsInput } from "./insightsPrompt.js";
import { createSafeLogger } from "./safeLog.js";
import { channelScopeSchema, peopleMomentSchema } from "./schemas.js";
import { collectApprovedChannels } from "./slackCollector.js";
import { buildWorkSignals } from "./signals.js";
import { assembleWeeklySnapshot } from "./weeklyAssembler.js";

const demoDataSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  generatedAt: z.string().datetime({ offset: true }),
  scopes: z.array(channelScopeSchema).min(4),
  headcount: z.record(z.string(), z.number().int().min(0)),
  peopleMoments: z.array(peopleMomentSchema)
}).strict();

export interface PeoplePulseDemoOptions {
  repositoryRoot?: string;
  outputDirectory?: string;
  auditPath?: string;
  writeArtifacts?: boolean;
}

export async function runPeoplePulseDemo(options: PeoplePulseDemoOptions = {}) {
  const repositoryRoot = options.repositoryRoot ?? fileURLToPath(new URL("../../../", import.meta.url));
  const fixtureDirectory = join(repositoryRoot, "slack-app", "test", "fixtures", "people-pulse");
  const demoData = demoDataSchema.parse(JSON.parse(await readFile(join(fixtureDirectory, "demo-data.json"), "utf8")));
  const headcountByDepartment = new Map(Object.entries(demoData.headcount));
  const config = loadPeoplePulseConfig({
    PP_DATA_MODE: "TEST",
    PP_SLACK_READ_MODE: "MOCK",
    PP_AI_MODE: "MOCK",
    PP_NOTIFY_MODE: "OFF",
    PP_REQUEST_SPACING_MS: "0"
  });
  const logger = createSafeLogger();
  const transport = await FixtureSlackTransport.fromFile(join(fixtureDirectory, "slack-week-2026-08-17.json"));
  const collection = await collectApprovedChannels(transport, demoData.scopes, config, {
    now: new Date(demoData.generatedAt),
    headcountByDepartment,
    sleep: async () => undefined
  });
  logger.info("people_pulse_collection_complete", {
    runWeek: demoData.weekStart,
    channelsRead: collection.channels.length,
    messagesRead: collection.messagesRead,
    providerCalls: collection.providerCalls
  });

  const extracted = extractTaskObservations(collection, new Date(demoData.generatedAt), config);
  const signals = buildWorkSignals(extracted.observations);
  const capacitySignals = buildCapacitySignals(extracted.observations, config);
  const insightInputs = buildInsightInputs(demoData.weekStart, collection, extracted.observations, extracted.evidence, headcountByDepartment);
  const departmentInsights = await new ClaudeInsightsService(config, logger).summarizeDepartments(insightInputs);
  const snapshot = assembleWeeklySnapshot({
    weekStart: demoData.weekStart,
    generatedAt: new Date(demoData.generatedAt),
    config,
    collection,
    observations: extracted.observations,
    evidence: extracted.evidence,
    signals,
    capacitySignals,
    peopleMoments: demoData.peopleMoments,
    departmentInsights,
    headcountByDepartment
  });

  if (options.writeArtifacts === false) return { snapshot, artifactChanged: false, auditChanged: false };
  const outputDirectory = options.outputDirectory ?? join(repositoryRoot, "insights");
  const auditPath = options.auditPath ?? join(repositoryRoot, "data", "insights-runs.json");
  const artifact = await writeWeeklyArtifact(outputDirectory, snapshot);
  const auditChanged = await appendRunAuditIdempotent(auditPath, artifact.snapshot);
  logger.info("people_pulse_snapshot_complete", {
    runId: artifact.snapshot.runId,
    outputHash: artifact.snapshot.outputHash,
    artifactChanged: artifact.changed,
    auditChanged
  });
  return { snapshot: artifact.snapshot, artifactChanged: artifact.changed, auditChanged, artifactPath: artifact.path, auditPath };
}

function buildInsightInputs(
  weekStart: string,
  collection: Awaited<ReturnType<typeof collectApprovedChannels>>,
  observations: ReturnType<typeof extractTaskObservations>["observations"],
  evidence: ReturnType<typeof extractTaskObservations>["evidence"],
  headcountByDepartment: ReadonlyMap<string, number>
): DepartmentInsightsInput[] {
  const evidenceById = new Map(evidence.map((item) => [item.id, item]));
  return collection.channels.map((channel) => ({
    department: channel.scope.department,
    weekStart,
    aggregateStatistics: {
      approvedChannelNames: [channel.scope.channelName],
      approvedChannels: 1,
      headcount: headcountByDepartment.get(channel.scope.department) ?? 0,
      uniqueParticipants: channel.uniqueParticipantCount,
      weeklyMessageCounts: channel.weeklyMessageCounts
    },
    taskFacts: observations
      .filter((observation) => observation.departments.includes(channel.scope.department))
      .map((observation) => ({
        observationId: observation.id,
        kind: observation.kind,
        taskArea: observation.taskArea,
        sanitizedSummary: observation.summary,
        occurredAt: observation.occurredAt,
        evidenceIds: observation.evidenceIds,
        boundedExcerpt: evidenceById.get(observation.evidenceIds[0] ?? "")?.boundedSummary ?? "Evidence available through an authorized source link."
      }))
  }));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = await runPeoplePulseDemo();
  console.log(`People Pulse demo ready: ${result.snapshot.runId}`);
}
