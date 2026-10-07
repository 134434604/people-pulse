import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { appendRunAuditIdempotent, writeWeeklyArtifact } from "../../src/peoplePulse/artifactStore.js";
import { DecisionStore } from "../../src/peoplePulse/decisionStore.js";
import { weeklySnapshotSchema } from "../../src/peoplePulse/schemas.js";

const temporaryDirectories: string[] = [];
afterEach(async () => Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))));

describe("People Pulse concurrent persistence and corruption edges", () => {
  it("serializes ten identical concurrent decisions into one durable record", async () => {
    const { directory, snapshot } = await setup();
    const store = new DecisionStore(join(directory, "decisions.json"));
    const signal = snapshot.signals[0]!;
    const answer = signal.acceptedAnswers[0]!;
    const decisions = await Promise.all(Array.from({ length: 10 }, () => store.record(snapshot, {
      signalId: signal.id,
      answerId: answer.id,
      note: "Same executive answer",
      decidedBy: "QA Executive"
    })));
    expect(new Set(decisions.map((decision) => decision.id)).size).toBe(1);
    expect(await store.list()).toHaveLength(1);
  });

  it("preserves a superseded answer and leaves exactly one active decision", async () => {
    const { directory, snapshot } = await setup();
    const store = new DecisionStore(join(directory, "decisions.json"));
    const signal = snapshot.signals.find((item) => item.acceptedAnswers.length >= 2)!;
    await store.record(snapshot, { signalId: signal.id, answerId: signal.acceptedAnswers[0]!.id, note: "First", decidedBy: "QA Executive", decidedAt: new Date("2026-08-20T20:00:00Z") });
    await store.record(snapshot, { signalId: signal.id, answerId: signal.acceptedAnswers[1]!.id, note: "Changed", decidedBy: "QA Executive", decidedAt: new Date("2026-08-20T20:01:00Z") });
    const records = await store.list();
    expect(records).toHaveLength(2);
    expect(records.filter((record) => !record.restoredAt)).toHaveLength(1);
    expect(records[0]?.restoreReason).toBe("Superseded by a later executive answer.");
  });

  it("scopes a decision to its own week — a conclusion never leaks to the same signal in another week", async () => {
    const { directory, snapshot } = await setup();
    const store = new DecisionStore(join(directory, "decisions.json"));
    const signal = snapshot.signals[0]!;
    const answer = signal.acceptedAnswers.find((candidate) => candidate.concludes) ?? signal.acceptedAnswers[0]!;
    // Same signal id (kind:taskArea) recurs in a later week's snapshot.
    const laterWeek = "2026-08-24";
    const laterSnapshot = weeklySnapshotSchema.parse({ ...snapshot, weekStart: laterWeek });

    const decision = await store.record(snapshot, { signalId: signal.id, answerId: answer.id, note: "Resolved this week", decidedBy: "QA Executive" });
    expect(decision.week).toBe(snapshot.weekStart);

    const all = await store.list();
    // The decision governs its own week...
    const thisWeekActive = all.filter((d) => d.signalId === signal.id && d.week === snapshot.weekStart && !d.restoredAt);
    expect(thisWeekActive).toHaveLength(1);
    // ...but not the later week bearing the same signal id.
    const laterWeekActive = all.filter((d) => d.signalId === signal.id && d.week === laterSnapshot.weekStart && !d.restoredAt);
    expect(laterWeekActive).toHaveLength(0);

    // Recording against the later week supersedes nothing in the earlier week.
    await store.record(laterSnapshot, { signalId: signal.id, answerId: answer.id, note: "New week, fresh evidence", decidedBy: "QA Executive" });
    const afterSecond = await store.list();
    expect(afterSecond.filter((d) => d.week === snapshot.weekStart && !d.restoredAt)).toHaveLength(1);
    expect(afterSecond.filter((d) => d.week === laterWeek && !d.restoredAt)).toHaveLength(1);
  });

  it("serializes concurrent artifact and audit writes idempotently", async () => {
    const { directory, snapshot } = await setup();
    const artifactDirectory = join(directory, "insights");
    const writes = await Promise.all(Array.from({ length: 6 }, () => writeWeeklyArtifact(artifactDirectory, snapshot)));
    expect(writes.filter((result) => result.changed)).toHaveLength(1);
    const auditPath = join(directory, "audit.json");
    const audits = await Promise.all(Array.from({ length: 6 }, () => appendRunAuditIdempotent(auditPath, snapshot)));
    expect(audits.filter(Boolean)).toHaveLength(1);
    expect(JSON.parse(await readFile(auditPath, "utf8"))).toHaveLength(1);
    expect((await readdir(artifactDirectory)).filter((name) => name.endsWith(".tmp"))).toEqual([]);
    expect((await readdir(directory)).filter((name) => name.endsWith(".tmp"))).toEqual([]);
  });

  it("refuses to overwrite malformed durable JSON", async () => {
    const { directory, snapshot } = await setup();
    await writeFile(join(directory, `${snapshot.weekStart}.json`), "not-json", "utf8");
    await expect(writeWeeklyArtifact(directory, snapshot)).rejects.toBeInstanceOf(SyntaxError);
    expect(await readFile(join(directory, `${snapshot.weekStart}.json`), "utf8")).toBe("not-json");
  });

  it("refuses to overwrite schema-invalid durable JSON", async () => {
    const { directory, snapshot } = await setup();
    const path = join(directory, `${snapshot.weekStart}.json`);
    const invalid = `${JSON.stringify({ ...snapshot, schemaVersion: 999 }, null, 2)}\n`;
    await writeFile(path, invalid, "utf8");
    await expect(writeWeeklyArtifact(directory, snapshot)).rejects.toThrow();
    expect(await readFile(path, "utf8")).toBe(invalid);
  });

  it("replaces an older snapshot schema with the current validated artifact", async () => {
    const { directory, snapshot } = await setup();
    const path = join(directory, `${snapshot.weekStart}.json`);
    const older = { ...snapshot, schemaVersion: 2, modes: { ...snapshot.modes, chat: "MOCK" } };
    await writeFile(path, `${JSON.stringify(older, null, 2)}\n`, "utf8");
    const result = await writeWeeklyArtifact(directory, snapshot);
    expect(result.changed).toBe(true);
    expect(weeklySnapshotSchema.parse(JSON.parse(await readFile(path, "utf8"))).schemaVersion).toBe(3);
  });
});

async function setup() {
  const directory = await mkdtemp(join(tmpdir(), "people-pulse-edge-"));
  temporaryDirectories.push(directory);
  const snapshotPath = fileURLToPath(new URL("../../../insights/2026-08-17.json", import.meta.url));
  const snapshot = weeklySnapshotSchema.parse(JSON.parse(await readFile(snapshotPath, "utf8")));
  return { directory, snapshot };
}
