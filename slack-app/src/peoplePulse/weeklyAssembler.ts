import type { DepartmentInsightResult } from "./claudeInsights.js";
import type { PeoplePulseConfig } from "./config.js";
import type { CollectionResult } from "./slackCollector.js";
import type {
  CapacitySignal,
  DepartmentCoverage,
  EvidenceReference,
  PeopleMoment,
  RecurringWorkArea,
  TaskObservation,
  WeeklySnapshot,
  WorkSignal
} from "./schemas.js";
import { weeklySnapshotSchema } from "./schemas.js";
import { sha256 } from "./sanitize.js";
import { buildInsufficientEvidenceSignal } from "./signals.js";

export interface WeeklyAssemblyInput {
  weekStart: string;
  generatedAt: Date;
  config: PeoplePulseConfig;
  collection: CollectionResult;
  observations: TaskObservation[];
  evidence: EvidenceReference[];
  signals: WorkSignal[];
  capacitySignals: CapacitySignal[];
  peopleMoments: PeopleMoment[];
  departmentInsights: DepartmentInsightResult[];
  headcountByDepartment: ReadonlyMap<string, number>;
}

export function assembleWeeklySnapshot(input: WeeklyAssemblyInput): WeeklySnapshot {
  const departments = [...new Set(input.collection.channels.map((channel) => channel.scope.department))].sort();
  const enrichedSignals = input.signals.map((signal) => enrichSignal(signal, input.departmentInsights));
  for (const department of departments) {
    if (!enrichedSignals.some((signal) => signal.departments.includes(department))) {
      enrichedSignals.push(buildInsufficientEvidenceSignal(department, input.generatedAt.toISOString()));
    }
  }
  const departmentCoverage = buildDepartmentCoverage(
    departments,
    input.collection,
    enrichedSignals,
    input.peopleMoments,
    input.headcountByDepartment
  );
  const usage = input.departmentInsights.reduce(
    (total, result) => ({
      inputTokens: total.inputTokens + result.usage.inputTokens,
      outputTokens: total.outputTokens + result.usage.outputTokens,
      cost: total.cost + result.usage.costEstimateUsd
    }),
    { inputTokens: 0, outputTokens: 0, cost: 0 }
  );
  const model = [...new Set(input.departmentInsights.map((result) => result.usage.model))].join(", ");
  const semantic = {
    schemaVersion: 3 as const,
    weekStart: input.weekStart,
    modes: input.config.modes,
    summary: buildSummary(enrichedSignals, input.capacitySignals, departments.length),
    departmentCoverage,
    signals: enrichedSignals,
    capacitySignals: input.capacitySignals,
    peopleMoments: input.peopleMoments,
    activity: {
      weekLabels: weekLabels(input.weekStart),
      series: input.collection.channels
        .map((channel) => ({
          department: channel.scope.department,
          indexedValues: indexActivity(channel.weeklyMessageCounts)
        }))
        .sort((left, right) => left.department.localeCompare(right.department))
    },
    recurringWorkAreas: buildRecurringWorkAreas(input.observations),
    evidence: [...input.evidence].sort((left, right) => left.id.localeCompare(right.id)),
    audit: {
      departments: departments.length,
      channelsRead: input.collection.channels.length,
      messagesRead: input.collection.messagesRead,
      taskObservations: input.observations.length,
      signals: enrichedSignals.length,
      model: model || "none",
      tokensIn: usage.inputTokens,
      tokensOut: usage.outputTokens,
      costEstimateUsd: Math.round(usage.cost * 1_000_000) / 1_000_000,
      status: "complete" as const,
      errorCode: ""
    }
  };
  const outputHash = sha256(stableStringify(semantic));
  return weeklySnapshotSchema.parse({
    ...semantic,
    generatedAt: input.generatedAt.toISOString(),
    runId: `pp_${input.weekStart.replace(/-/g, "")}_${outputHash.slice(0, 12)}`,
    outputHash
  });
}

function enrichSignal(signal: WorkSignal, insights: readonly DepartmentInsightResult[]): WorkSignal {
  const matching = insights
    .flatMap((result) => result.insight.assessments)
    .find((assessment) => assessment.observationIds.some((id) => signal.observationIds.includes(id)));
  if (!matching) return signal;
  return {
    ...signal,
    interpretation: matching.interpretation,
    confidence: Math.round(((signal.confidence + matching.confidence) / 2) * 100) / 100,
    missingInformation: [...new Set([...signal.missingInformation, ...matching.missingInformation])].slice(0, 8)
  };
}

function buildDepartmentCoverage(
  departments: readonly string[],
  collection: CollectionResult,
  signals: readonly WorkSignal[],
  peopleMoments: readonly PeopleMoment[],
  headcountByDepartment: ReadonlyMap<string, number>
): DepartmentCoverage[] {
  return departments.map((department) => {
    const channel = collection.channels.find((candidate) => candidate.scope.department === department);
    const counts = channel?.weeklyMessageCounts ?? Array.from({ length: 8 }, () => 0);
    const current = counts.at(-1) ?? 0;
    const baselineValues = counts.slice(0, -1);
    const baseline = baselineValues.length > 0
      ? baselineValues.reduce((sum, count) => sum + count, 0) / baselineValues.length
      : 0;
    const departmentSignals = signals.filter((signal) => signal.departments.includes(department));
    return {
      department,
      headcount: headcountByDepartment.get(department) ?? 0,
      participationVsUsual: activityLabel(current, baseline),
      waitingForFollowUp: departmentSignals.filter((signal) => signal.urgency !== "monitor").length,
      peopleMoments: peopleMoments.filter((moment) => moment.department === department).length,
      whatToKnow: departmentSignals[0]?.headline ?? "No cited task-flow issue requires executive attention this week."
    };
  });
}

function activityLabel(current: number, baseline: number): DepartmentCoverage["participationVsUsual"] {
  if (baseline === 0) return current === 0 ? "unknown" : "higher";
  const ratio = current / baseline;
  if (ratio < 0.75) return "lower";
  if (ratio <= 1.15) return "usual";
  if (ratio <= 1.5) return "slightly-higher";
  return "higher";
}

function indexActivity(values: readonly number[]): number[] {
  const nonZero = values.filter((value) => value > 0);
  const baseline = nonZero.length > 0 ? nonZero.reduce((sum, value) => sum + value, 0) / nonZero.length : 0;
  return values.map((value) => baseline > 0 ? Math.min(200, Math.round((value / baseline) * 100)) : 0);
}

function buildRecurringWorkAreas(observations: readonly TaskObservation[]): RecurringWorkArea[] {
  const groups = new Map<string, TaskObservation[]>();
  for (const observation of observations.filter((item) => item.kind === "recurring-work")) {
    const group = groups.get(observation.taskArea) ?? [];
    group.push(observation);
    groups.set(observation.taskArea, group);
  }
  return [...groups.entries()]
    .map(([name, group]) => ({
      name,
      count: group.length,
      departments: [...new Set(group.flatMap((observation) => observation.departments))]
    }))
    .sort((left, right) => right.count - left.count);
}

function buildSummary(signals: readonly WorkSignal[], capacitySignals: readonly CapacitySignal[], departments: number): string {
  const immediate = signals.filter((signal) => signal.urgency === "today").length;
  return `${departments} departments reviewed. ${immediate} cited item${immediate === 1 ? "" : "s"} need attention today; ${capacitySignals.length} sustained capacity pattern${capacitySignals.length === 1 ? "" : "s"} need review.`;
}

function weekLabels(weekStart: string): string[] {
  const current = new Date(`${weekStart}T00:00:00.000Z`);
  return Array.from({ length: 8 }, (_, index) => {
    const date = new Date(current);
    date.setUTCDate(current.getUTCDate() - (7 - index) * 7);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  });
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
