import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { SignalDecision, WeeklySnapshot } from "./schemas.js";
import { signalDecisionSchema } from "./schemas.js";
import { deterministicId } from "./sanitize.js";

export interface RecordDecisionInput {
  signalId: string;
  answerId: string;
  note: string;
  decidedBy: string;
  decidedAt?: Date;
}

export class DecisionStoreError extends Error {
  constructor(public readonly statusCode: 400 | 404, message: string) {
    super(message);
    this.name = "DecisionStoreError";
  }
}

export class DecisionStore {
  private operationQueue: Promise<void> = Promise.resolve();

  constructor(private readonly path: string) {}

  async list(): Promise<SignalDecision[]> {
    const pending = this.operationQueue;
    await pending;
    return this.readUnlocked();
  }

  private async readUnlocked(): Promise<SignalDecision[]> {
    try {
      const value: unknown = JSON.parse(await readFile(this.path, "utf8"));
      if (!Array.isArray(value)) throw new Error("People Pulse decision store must contain an array.");
      return value.map((item) => signalDecisionSchema.parse(item));
    } catch (error: unknown) {
      if (isMissingFile(error)) return [];
      throw error;
    }
  }

  async record(snapshot: WeeklySnapshot, input: RecordDecisionInput): Promise<SignalDecision> {
    return this.exclusive(() => this.recordUnlocked(snapshot, input));
  }

  private async recordUnlocked(snapshot: WeeklySnapshot, input: RecordDecisionInput): Promise<SignalDecision> {
    const signal = snapshot.signals.find((candidate) => candidate.id === input.signalId);
    if (!signal) throw new DecisionStoreError(404, "Signal not found in the current authorized snapshot.");
    const answer = signal.acceptedAnswers.find((candidate) => candidate.id === input.answerId);
    if (!answer) throw new DecisionStoreError(400, "Answer is not declared by this signal.");
    const week = snapshot.weekStart;
    const existing = await this.readUnlocked();
    const duplicate = existing.find((decision) =>
      decision.signalId === input.signalId
      && decision.week === week
      && decision.answerId === input.answerId
      && decision.note === input.note.trim()
      && !decision.restoredAt
    );
    if (duplicate) return duplicate;

    const decidedAt = input.decidedAt ?? new Date();
    // Supersede only prior open decisions for THIS signal in THIS week — never another week's.
    for (const decision of existing) {
      if (decision.signalId === input.signalId && decision.week === week && !decision.restoredAt) {
        decision.restoredAt = decidedAt.toISOString();
        decision.restoreReason = "Superseded by a later executive answer."
      }
    }
    const composedInstruction = composeInstruction(signal.headline, signal.question, answer.label, input.note, signal.evidenceIds);
    const decision = signalDecisionSchema.parse({
      id: deterministicId("decision", `${week}:${input.signalId}:${decidedAt.toISOString()}:${answer.id}`),
      signalId: input.signalId,
      week,
      answerId: answer.id,
      answerLabel: answer.label,
      note: input.note.trim(),
      decidedBy: input.decidedBy,
      decidedAt: decidedAt.toISOString(),
      composedInstruction,
      concludes: answer.concludes
    });
    await this.write([...existing, decision]);
    return decision;
  }

  async restore(decisionId: string, reason: string, restoredAt = new Date()): Promise<SignalDecision> {
    return this.exclusive(() => this.restoreUnlocked(decisionId, reason, restoredAt));
  }

  private async restoreUnlocked(decisionId: string, reason: string, restoredAt: Date): Promise<SignalDecision> {
    const decisions = await this.readUnlocked();
    const decision = decisions.find((candidate) => candidate.id === decisionId);
    if (!decision) throw new DecisionStoreError(404, "Decision not found.");
    if (!decision.restoredAt) {
      decision.restoredAt = restoredAt.toISOString();
      decision.restoreReason = reason.trim() || "Reopened for executive review."
      await this.write(decisions);
    }
    return decision;
  }

  private async exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.operationQueue;
    let release = (): void => undefined;
    this.operationQueue = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  private async write(decisions: readonly SignalDecision[]): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const temporary = `${this.path}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(decisions, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    await rename(temporary, this.path);
  }
}

function composeInstruction(headline: string, question: string, answer: string, note: string, evidenceIds: readonly string[]): string {
  return [
    `People Pulse follow-up: ${headline}`,
    `Question: ${question}`,
    `Executive answer: ${answer}`,
    note.trim() ? `Context: ${note.trim()}` : "Context: No additional note provided.",
    `Evidence references: ${evidenceIds.join(", ")}`,
    "This records a decision; it does not assign, send, post, or complete the underlying work."
  ].join("\n");
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
