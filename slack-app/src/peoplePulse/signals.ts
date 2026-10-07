import type { TaskObservation, WorkSignal } from "./schemas.js";
import { deterministicId } from "./sanitize.js";

const ANSWERS: Record<TaskObservation["kind"], WorkSignal["acceptedAnswers"]> = {
  "waiting-decision": [
    { id: "decide-now", label: "Decide now", concludes: true },
    { id: "assign-reviewer", label: "Assign a reviewer", concludes: true },
    { id: "need-context", label: "Need more context", concludes: false }
  ],
  "ownership-gap": [
    { id: "assign-owner", label: "Assign an owner", concludes: true },
    { id: "define-scope", label: "Define the scope first", concludes: false },
    { id: "monitor", label: "Monitor this week", concludes: true }
  ],
  "handoff-gap": [
    { id: "name-handoff", label: "Name the handoff owner", concludes: true },
    { id: "schedule-review", label: "Schedule a workflow review", concludes: true },
    { id: "need-context", label: "Need more context", concludes: false }
  ],
  "recurring-work": [
    { id: "document-process", label: "Document the process", concludes: true },
    { id: "assess-automation", label: "Assess automation", concludes: true },
    { id: "monitor", label: "Monitor another week", concludes: true }
  ],
  "coverage-risk": [
    { id: "assign-backup", label: "Assign backup coverage", concludes: true },
    { id: "cross-train", label: "Create a cross-training plan", concludes: true },
    { id: "need-context", label: "Need more context", concludes: false }
  ]
};

export function buildWorkSignals(observations: readonly TaskObservation[]): WorkSignal[] {
  const grouped = new Map<string, TaskObservation[]>();
  for (const observation of observations) {
    const key = `${observation.kind}:${observation.taskArea}`;
    const group = grouped.get(key) ?? [];
    group.push(observation);
    grouped.set(key, group);
  }

  return [...grouped.entries()].map(([key, group]) => {
    const sorted = [...group].sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
    const first = sorted[0];
    const last = sorted.at(-1);
    if (!first || !last) throw new Error(`Empty work-signal group: ${key}`);
    const evidenceIds = unique(sorted.flatMap((observation) => observation.evidenceIds));
    const departments = unique(sorted.flatMap((observation) => observation.departments));
    const weeksObserved = unique(sorted.map((observation) => weekStart(observation.occurredAt))).length;
    const urgency = sorted.some((observation) => observation.impact === "high")
      ? "today"
      : sorted.some((observation) => observation.impact === "medium")
        ? "this-week"
        : "monitor";

    return {
      id: deterministicId("sig", key),
      type: first.kind,
      headline: headline(first.kind, first.taskArea),
      detail: `${first.summary} ${sorted.length} supporting observation${sorted.length === 1 ? "" : "s"} found.`,
      observationSummary: `${sorted.length} task-level observation${sorted.length === 1 ? "" : "s"} in ${first.taskArea.toLowerCase()} are linked to approved-channel evidence.`,
      interpretation: `This may indicate a ${first.kind.replace(/-/g, " ")} in the work system; it is not an employee assessment.`,
      departments,
      observationIds: sorted.map((observation) => observation.id),
      evidenceIds,
      weeksObserved,
      firstObservedAt: first.occurredAt,
      lastObservedAt: last.occurredAt,
      urgency,
      confidence: Math.round((sorted.reduce((sum, observation) => sum + observation.confidence, 0) / sorted.length) * 100) / 100,
      missingInformation: missingInformation(first.kind),
      suggestedAction: suggestedAction(first.kind),
      question: question(first.kind, first.taskArea),
      wrongDecisionRisk: wrongDecisionRisk(first.kind),
      acceptedAnswers: ANSWERS[first.kind],
      state: "open"
    } satisfies WorkSignal;
  }).sort((left, right) => urgencyRank(left.urgency) - urgencyRank(right.urgency) || left.headline.localeCompare(right.headline));
}

export function buildInsufficientEvidenceSignal(department: string, observedAt: string): WorkSignal {
  return {
    id: deterministicId("sig", `insufficient-evidence:${department}`),
    type: "insufficient-evidence",
    headline: `Insufficient task evidence · ${department}`,
    detail: "No approved-channel task observation met the deterministic signal threshold.",
    observationSummary: "The approved scope did not produce a task-level exception for this department.",
    interpretation: "This is an evidence limitation, not proof that work is healthy or unhealthy.",
    departments: [department],
    observationIds: [],
    evidenceIds: [],
    weeksObserved: 1,
    firstObservedAt: observedAt,
    lastObservedAt: observedAt,
    urgency: "monitor",
    confidence: 0,
    missingInformation: ["Whether the approved channels represent the department's task coordination"],
    suggestedAction: "Review channel coverage before drawing a department-level conclusion.",
    question: `Does the approved channel map adequately represent ${department}'s task coordination?`,
    wrongDecisionRisk: "Treating missing evidence as a positive or negative finding can hide an incomplete channel map.",
    acceptedAnswers: [
      { id: "scope-adequate", label: "Scope is adequate", concludes: true },
      { id: "review-scope", label: "Review channel scope", concludes: true }
    ],
    state: "open"
  };
}

function headline(kind: TaskObservation["kind"], taskArea: string): string {
  const prefix: Record<TaskObservation["kind"], string> = {
    "waiting-decision": "Decision waiting",
    "ownership-gap": "Ownership gap",
    "handoff-gap": "Handoff needs attention",
    "recurring-work": "Recurring work pattern",
    "coverage-risk": "Coverage risk"
  };
  return `${prefix[kind]} · ${taskArea}`;
}

function missingInformation(kind: TaskObservation["kind"]): string[] {
  if (kind === "waiting-decision") return ["The accountable decision-maker", "The business deadline"];
  if (kind === "coverage-risk") return ["Current backup coverage", "The consequence of an absence"];
  if (kind === "recurring-work") return ["Typical time required", "Existing SOP or tooling"];
  return ["The accountable owner", "The target completion date"];
}

function suggestedAction(kind: TaskObservation["kind"]): string {
  const actions: Record<TaskObservation["kind"], string> = {
    "waiting-decision": "Name the decision owner and deadline, then capture the outcome.",
    "ownership-gap": "Assign one accountable owner and define the next handoff.",
    "handoff-gap": "Clarify the upstream input, downstream owner, and acceptance criteria.",
    "recurring-work": "Confirm frequency and effort before choosing SOP, automation, or capacity.",
    "coverage-risk": "Name a trained backup and document the minimum continuity steps."
  };
  return actions[kind];
}

function question(kind: TaskObservation["kind"], taskArea: string): string {
  const prompts: Record<TaskObservation["kind"], string> = {
    "waiting-decision": `Who should decide the ${taskArea.toLowerCase()} item and by when?`,
    "ownership-gap": `Who should own the ${taskArea.toLowerCase()} work?`,
    "handoff-gap": `Which team should own the next ${taskArea.toLowerCase()} handoff?`,
    "recurring-work": `Should the ${taskArea.toLowerCase()} work be documented, automated, or monitored?`,
    "coverage-risk": `Who can provide backup for the ${taskArea.toLowerCase()} workflow?`
  };
  return prompts[kind];
}

function wrongDecisionRisk(kind: TaskObservation["kind"]): string {
  const risks: Record<TaskObservation["kind"], string> = {
    "waiting-decision": "A rushed answer can move work in the wrong direction; continued delay can hold the dependent work in place.",
    "ownership-gap": "Assigning the wrong owner can create another handoff; leaving it open can allow the task to age without accountability.",
    "handoff-gap": "Changing the handoff without confirming inputs can shift the bottleneck rather than remove it.",
    "recurring-work": "Adding capacity before checking process and automation can make an avoidable workflow permanent.",
    "coverage-risk": "A nominal backup without training can create false confidence during an absence or demand spike."
  };
  return risks[kind];
}

function weekStart(value: string): string {
  const date = new Date(value);
  const day = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - ((day + 6) % 7));
  return date.toISOString().slice(0, 10);
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function urgencyRank(urgency: WorkSignal["urgency"]): number {
  return urgency === "today" ? 0 : urgency === "this-week" ? 1 : 2;
}
