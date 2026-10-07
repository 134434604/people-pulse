import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { weeklySnapshotSchema } from "../../src/peoplePulse/schemas.js";
import { runPeoplePulseDemo } from "../../src/peoplePulse/demo.js";

describe("People Pulse weekly assembly", () => {
  it("validates and writes the same fixture week idempotently", async () => {
    const directory = await mkdtemp(join(tmpdir(), "people-pulse-test-"));
    const outputDirectory = join(directory, "insights");
    const auditPath = join(directory, "audit.json");
    try {
      const first = await runPeoplePulseDemo({ outputDirectory, auditPath });
      const second = await runPeoplePulseDemo({ outputDirectory, auditPath });
      expect(first.artifactChanged).toBe(true);
      expect(first.auditChanged).toBe(true);
      expect(second.artifactChanged).toBe(false);
      expect(second.auditChanged).toBe(false);
      expect(second.snapshot).toEqual(first.snapshot);
      expect(first.snapshot.departmentCoverage).toHaveLength(4);
      expect(first.snapshot.modes).toEqual({
        data: "TEST", slackRead: "MOCK", ai: "MOCK", notify: "OFF", writeback: "OFF"
      });
      const artifact = weeklySnapshotSchema.parse(JSON.parse(await readFile(join(outputDirectory, "2026-08-17.json"), "utf8")));
      expect(artifact.outputHash).toBe(first.snapshot.outputHash);
      const audit = JSON.parse(await readFile(auditPath, "utf8")) as unknown[];
      expect(audit).toHaveLength(1);
      expect(JSON.stringify(audit)).not.toMatch(/manual weekly release report|alex@|messageBody|prompt/i);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
