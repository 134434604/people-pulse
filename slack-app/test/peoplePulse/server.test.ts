import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { loadPeoplePulseConfig } from "../../src/peoplePulse/config.js";
import { createPeoplePulseServer, type IdentityProvider } from "../../src/peoplePulse/server.js";

const servers: Server[] = [];
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("People Pulse HTTP authorization and decision boundary", () => {
  it.each([
    ["unauthenticated", null, 401],
    ["viewer", { subject: "viewer", displayName: "Viewer", role: "viewer" as const, demo: true }, 403]
  ])("denies %s insight access", async (_label, identity, status) => {
    const server = await start({ authenticate: async () => identity });
    const response = await fetch(`${baseUrl(server)}/api/weeks`);
    expect(response.status).toBe(status);
  });

  it("answers an unscheduled embedded chat question and records reversible declared decisions", async () => {
    const directory = await mkdtemp(join(tmpdir(), "people-pulse-api-"));
    temporaryDirectories.push(directory);
    const server = await start(
      { authenticate: async () => ({ subject: "exec-1", displayName: "Executive One", role: "executive", demo: true }) },
      join(directory, "decisions.json")
    );
    const base = baseUrl(server);

    const weeks = await fetchJson<{ weeks: string[] }>(`${base}/api/weeks`);
    expect(weeks.weeks).toContain("2026-08-17");
    const snapshot = await fetchJson<{ signals: Array<{ id: string; state: string; acceptedAnswers: Array<{ id: string }> }> }>(`${base}/api/insights/2026-08-17`);
    const signal = snapshot.signals.find((item) => item.state === "open");
    expect(signal).toBeDefined();

    const chat = await fetchJson<{ status: string; citations: Array<{ permalink: string }>; provider: { mode: string; contacted: boolean } }>(`${base}/api/chat?week=2026-08-17`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-people-pulse-csrf": "1" },
      body: JSON.stringify({ question: "What bottlenecks across departments need attention?", department: "All" })
    });
    expect(chat.status).toBe("answered");
    expect(chat.citations.length).toBeGreaterThan(0);
    expect(chat.citations[0]?.permalink).toMatch(/^https:\/\/[^/]+\.slack\.com\/archives\//);
    expect(chat.provider).toEqual(expect.objectContaining({ mode: "MOCK", contacted: false }));

    const decisionResponse = await fetchJson<{ decision: { id: string; concludes: boolean; composedInstruction: string } }>(
      `${base}/api/signals/${signal?.id}/decisions?week=2026-08-17`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-people-pulse-csrf": "1" },
        body: JSON.stringify({ answerId: signal?.acceptedAnswers[0]?.id, note: "Review with the department lead." })
      },
      201
    );
    expect(decisionResponse.decision.composedInstruction).toContain("does not assign, send, post, or complete");
    const updated = await fetchJson<{ signals: Array<{ id: string; state: string }> }>(`${base}/api/insights/2026-08-17`);
    expect(updated.signals.find((item) => item.id === signal?.id)?.state).toBe("concluded");

    await fetchJson(`${base}/api/decisions/${decisionResponse.decision.id}/restore`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-people-pulse-csrf": "1" },
      body: JSON.stringify({ reason: "New evidence arrived." })
    });
    const restored = await fetchJson<{ signals: Array<{ id: string; state: string }> }>(`${base}/api/insights/2026-08-17`);
    expect(restored.signals.find((item) => item.id === signal?.id)?.state).toBe("open");
  });

  it("refuses LIVE data mode without an explicit identity provider", () => {
    const config = loadPeoplePulseConfig({ PP_DATA_MODE: "LIVE" });
    expect(() => createPeoplePulseServer({ config })).toThrow("requires an explicit production identity provider");
  });
});

async function start(identityProvider: IdentityProvider, decisionPath?: string): Promise<Server> {
  const server = createPeoplePulseServer({
    config: loadPeoplePulseConfig(),
    identityProvider,
    ...(decisionPath ? { decisionPath } : {})
  });
  servers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  return server;
}

function baseUrl(server: Server): string {
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

async function fetchJson<T = unknown>(url: string, init?: RequestInit, expectedStatus = 200): Promise<T> {
  const response = await fetch(url, init);
  expect(response.status).toBe(expectedStatus);
  return await response.json() as T;
}
