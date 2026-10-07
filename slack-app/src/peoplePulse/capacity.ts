import type { PeoplePulseConfig } from "./config.js";
import type { CapacitySignal, TaskObservation } from "./schemas.js";
import { deterministicId } from "./sanitize.js";

const INTERVENTIONS: CapacitySignal["interventions"] = [
  "Clarify ownership",
  "Improve the process or SOP",
  "Automate or add tooling",
  "Rebalance responsibilities",
  "Add temporary capacity",
  "Explore a role hypothesis"
];

export function buildCapacitySignals(
  observations: readonly TaskObservation[],
  config: PeoplePulseConfig
): CapacitySignal[] {
  const groups = new Map<string, TaskObservation[]>();
  for (const observation of observations) {
    if (observation.kind !== "recurring-work" && observation.kind !== "coverage-risk" && observation.kind !== "handoff-gap") continue;
    const group = groups.get(observation.taskArea) ?? [];
    group.push(observation);
    groups.set(observation.taskArea, group);
  }

  const results: CapacitySignal[] = [];
  for (const [taskArea, group] of groups) {
    const weeks = new Set(group.map((observation) => weekStart(observation.occurredAt)));
    if (group.length < config.capacityMinimumOccurrences || weeks.size < config.capacityMinimumWeeks) continue;
    const departments = [...new Set(group.flatMap((observation) => observation.departments))];
    const evidenceIds = [...new Set(group.flatMap((observation) => observation.evidenceIds))];
    results.push({
      id: deterministicId("cap", taskArea),
      taskArea,
      departments,
      headline: `Sustained capacity pattern · ${taskArea}`,
      evidenceIds,
      observationIds: group.map((observation) => observation.id),
      weeksObserved: weeks.size,
      occurrenceCount: group.length,
      operationalImpact: `${group.length} task-level observations appeared across ${weeks.size} weeks and may be constraining flow.`,
      temporarySpikeAssessment: "The pattern spans multiple weeks, so it should be reviewed before treating it as a temporary spike.",
      interventions: INTERVENTIONS,
      roleHypothesis: `After process, automation, and rebalancing options are reviewed, explore whether sustained ${taskArea.toLowerCase()} ownership warrants a role hypothesis.`,
      confidence: Math.min(0.95, Math.round((0.65 + Math.min(weeks.size, 6) * 0.05) * 100) / 100),
      status: "review"
    });
  }

  return results.sort((left, right) => right.occurrenceCount - left.occurrenceCount);
}

function weekStart(value: string): string {
  const date = new Date(value);
  const day = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - ((day + 6) % 7));
  return date.toISOString().slice(0, 10);
}
