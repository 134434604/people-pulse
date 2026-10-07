import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { WeeklySnapshot } from "./schemas.js";
import { weeklySnapshotSchema } from "./schemas.js";

export interface ArtifactWriteResult {
  path: string;
  changed: boolean;
  snapshot: WeeklySnapshot;
}

const pathQueues = new Map<string, Promise<void>>();

export async function writeWeeklyArtifact(directory: string, snapshot: WeeklySnapshot): Promise<ArtifactWriteResult> {
  const path = join(directory, `${snapshot.weekStart}.json`);
  return withPathLock(path, () => writeWeeklyArtifactUnlocked(directory, path, snapshot));
}

async function writeWeeklyArtifactUnlocked(directory: string, path: string, snapshot: WeeklySnapshot): Promise<ArtifactWriteResult> {
  await mkdir(directory, { recursive: true });
  const existing = await readExisting(path);
  if (existing?.outputHash === snapshot.outputHash) return { path, changed: false, snapshot: existing };
  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(snapshot, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(temporaryPath, path);
  return { path, changed: true, snapshot };
}

export async function appendRunAuditIdempotent(path: string, snapshot: WeeklySnapshot): Promise<boolean> {
  return withPathLock(path, () => appendRunAuditUnlocked(path, snapshot));
}

async function appendRunAuditUnlocked(path: string, snapshot: WeeklySnapshot): Promise<boolean> {
  await mkdir(dirname(path), { recursive: true });
  const existing = await readAudit(path);
  if (existing.some((record) => record.runId === snapshot.runId)) return false;
  const auditRecord = {
    runId: snapshot.runId,
    weekStart: snapshot.weekStart,
    generatedAt: snapshot.generatedAt,
    departments: snapshot.audit.departments,
    channelsRead: snapshot.audit.channelsRead,
    messagesRead: snapshot.audit.messagesRead,
    taskObservations: snapshot.audit.taskObservations,
    signals: snapshot.audit.signals,
    model: snapshot.audit.model,
    tokensIn: snapshot.audit.tokensIn,
    tokensOut: snapshot.audit.tokensOut,
    costEstimateUsd: snapshot.audit.costEstimateUsd,
    modes: snapshot.modes,
    outputHash: snapshot.outputHash,
    status: snapshot.audit.status,
    errorCode: snapshot.audit.errorCode
  };
  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify([...existing, auditRecord], null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(temporaryPath, path);
  return true;
}

async function readExisting(path: string): Promise<WeeklySnapshot | null> {
  try {
    const value: unknown = JSON.parse(await readFile(path, "utf8"));
    const parsed = weeklySnapshotSchema.safeParse(value);
    if (parsed.success) return parsed.data;
    if (isOlderSnapshot(value)) return null;
    throw parsed.error;
  } catch (error: unknown) {
    if (isMissingFile(error)) return null;
    throw error;
  }
}

function isOlderSnapshot(value: unknown): boolean {
  if (!value || typeof value !== "object" || !("schemaVersion" in value)) return false;
  const version = (value as { schemaVersion?: unknown }).schemaVersion;
  return typeof version === "number" && Number.isInteger(version) && version > 0 && version < 3;
}

async function readAudit(path: string): Promise<Array<Record<string, unknown>>> {
  try {
    const parsed: unknown = JSON.parse(await readFile(path, "utf8"));
    if (!Array.isArray(parsed)) throw new Error("People Pulse audit file must contain an array.");
    return parsed.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
  } catch (error: unknown) {
    if (isMissingFile(error)) return [];
    throw error;
  }
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

async function withPathLock<T>(path: string, operation: () => Promise<T>): Promise<T> {
  const previous = pathQueues.get(path) ?? Promise.resolve();
  let release = (): void => undefined;
  const current = new Promise<void>((resolve) => { release = resolve; });
  pathQueues.set(path, current);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (pathQueues.get(path) === current) pathQueues.delete(path);
  }
}
