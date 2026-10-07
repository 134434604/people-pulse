import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadPeoplePulseConfig } from "../../src/peoplePulse/config.js";
import { createPeoplePulseServer, type IdentityProvider } from "../../src/peoplePulse/server.js";

const servers: Server[] = [];
const temporaryDirectories: string[] = [];
const executiveIdentity: IdentityProvider = {
  authenticate: async () => ({ subject: "edge-executive", displayName: "Edge Executive", role: "executive", demo: true })
};

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("People Pulse HTTP edge boundaries", () => {
  it.each([
    ["missing content type", undefined, JSON.stringify({ answerId: "acknowledge" }), 415, "Content-Type must be application/json."],
    ["malformed JSON", "application/json", "{not-json", 400, "Request body must be valid JSON."],
    ["schema-invalid decision", "application/json", JSON.stringify({ answerId: "x" }), 400, "Request validation failed."]
  ])("returns a bounded client error for %s", async (_label, contentType, body, status, message) => {
    const server = await start();
    const headers = contentType ? { "content-type": contentType, "x-people-pulse-csrf": "1" } : { "x-people-pulse-csrf": "1" };
    const response = await fetch(`${baseUrl(server)}/api/signals/sig_0000000000000000/decisions?week=2026-08-17`, { method: "POST", headers, body });
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: message });
    expectSecurityHeaders(response);
  });

  it("rejects a request body larger than 64 KiB", async () => {
    const server = await start();
    const response = await fetch(`${baseUrl(server)}/api/signals/sig_0000000000000000/decisions?week=2026-08-17`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-people-pulse-csrf": "1" },
      body: JSON.stringify({ answerId: "acknowledge", note: "q".repeat(70_000) })
    });
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: "Request body is too large." });
  });

  it("returns specific 404s for missing signal and decision records", async () => {
    const directory = await temporaryDirectory("people-pulse-http-store-");
    const server = await start(undefined, join(directory, "decisions.json"));
    const base = baseUrl(server);

    const signalResponse = await fetch(`${base}/api/signals/sig_0000000000000000/decisions?week=2026-08-17`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-people-pulse-csrf": "1" },
      body: JSON.stringify({ answerId: "acknowledge", note: "" })
    });
    expect(signalResponse.status).toBe(404);
    expect(await signalResponse.json()).toEqual({ error: "Signal not found in the current authorized snapshot." });

    const restoreResponse = await fetch(`${base}/api/decisions/decision_0000000000000000/restore`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-people-pulse-csrf": "1" },
      body: JSON.stringify({ reason: "New evidence" })
    });
    expect(restoreResponse.status).toBe(404);
    expect(await restoreResponse.json()).toEqual({ error: "Decision not found." });
  });

  it("rejects an answer that is not one of a signal's declared choices", async () => {
    const directory = await temporaryDirectory("people-pulse-http-answer-");
    const server = await start(undefined, join(directory, "decisions.json"));
    const base = baseUrl(server);
    const snapshot = await fetchJson<{ signals: Array<{ id: string }> }>(`${base}/api/insights/2026-08-17`);
    const signalId = snapshot.signals[0]?.id;
    expect(signalId).toBeDefined();

    const response = await fetch(`${base}/api/signals/${signalId}/decisions?week=2026-08-17`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-people-pulse-csrf": "1" },
      body: JSON.stringify({ answerId: "invented-choice", note: "" })
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Answer is not declared by this signal." });
  });

  it("does not leak parser details when a durable insight artifact is corrupt", async () => {
    const repositoryRoot = await temporaryDirectory("people-pulse-corrupt-repo-");
    const insightsDirectory = join(repositoryRoot, "insights");
    await mkdir(insightsDirectory, { recursive: true });
    await writeFile(join(insightsDirectory, "2026-08-17.json"), "{private-parser-detail", "utf8");
    const server = await start(repositoryRoot);

    const response = await fetch(`${baseUrl(server)}/api/insights/2026-08-17`);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Unexpected server error." });
    expectSecurityHeaders(response);
  });

  it("does not expose JSON artifacts or accept path-shaped week values", async () => {
    const server = await start();
    const base = baseUrl(server);
    for (const path of ["/people-pulse/insights/2026-08-17.json", "/api/insights/not-a-week", "/api/insights/%2e%2e%2fdata"]) {
      const response = await fetch(`${base}${path}`);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "Not found." });
    }
  });

  it("protects the HTML shell and serves a strict hashed single-file content policy", async () => {
    const denied = await start(undefined, undefined, { authenticate: async () => null });
    expect((await fetch(`${baseUrl(denied)}/`)).status).toBe(401);

    const server = await start();
    const response = await fetch(`${baseUrl(server)}/`);
    const policy = response.headers.get("content-security-policy") ?? "";
    expect(response.status).toBe(200);
    expect(policy).toContain("'sha256-");
    expect(policy).not.toContain("'unsafe-inline'");
    expect(response.headers.get("permissions-policy")).toContain("camera=()");
    expect(response.headers.get("strict-transport-security")).toContain("max-age=31536000");
  });

  it("rejects cross-site or unmarked mutation requests", async () => {
    const server = await start(undefined, undefined, executiveIdentity, "https://people-pulse.example.com");
    const base = baseUrl(server);
    for (const headers of [
      { "content-type": "application/json", origin: "https://people-pulse.example.com" },
      { "content-type": "application/json", "x-people-pulse-csrf": "1", origin: "https://attacker.example" }
    ]) {
      const response = await fetch(`${base}/api/signals/sig_0000000000000000/decisions?week=2026-08-17`, {
        method: "POST",
        headers,
        body: JSON.stringify({ answerId: "acknowledge", note: "" })
      });
      expect(response.status).toBe(403);
    }
  });

  it("accepts embedded chat only when Cloud Run forwards the same HTTPS origin", async () => {
    const server = await start(undefined, undefined, executiveIdentity, undefined, true);
    const base = baseUrl(server);
    const valid = await fetch(`${base}/api/chat?week=2026-08-17`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-people-pulse-csrf": "1",
        "x-forwarded-proto": "https",
        "x-forwarded-host": "people-pulse.example.com",
        origin: "https://people-pulse.example.com"
      },
      body: JSON.stringify({ question: "What needs an executive decision?", department: "All" })
    });
    expect(valid.status).toBe(200);
    expect(await valid.json()).toEqual(expect.objectContaining({ status: "answered" }));

    const insecure = await fetch(`${base}/api/chat?week=2026-08-17`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-people-pulse-csrf": "1",
        "x-forwarded-proto": "http",
        "x-forwarded-host": "people-pulse.example.com",
        origin: "https://people-pulse.example.com"
      },
      body: JSON.stringify({ question: "What needs an executive decision?", department: "All" })
    });
    expect(insecure.status).toBe(403);
  });

  it("rate limits an authenticated principal without exposing the subject", async () => {
    const server = createPeoplePulseServer({
      config: loadPeoplePulseConfig(),
      identityProvider: executiveIdentity,
      requestsPerMinute: 2
    });
    servers.push(server);
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    expect((await fetch(`${baseUrl(server)}/api/session`)).status).toBe(200);
    expect((await fetch(`${baseUrl(server)}/api/weeks`)).status).toBe(200);
    const limited = await fetch(`${baseUrl(server)}/api/decisions`);
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("60");
    expect(await limited.json()).toEqual({ error: "Request rate limit exceeded. Try again shortly." });
  });
});

async function start(
  repositoryRoot?: string,
  decisionPath?: string,
  identityProvider: IdentityProvider = executiveIdentity,
  trustedOrigin?: string,
  requireForwardedHttps = false
): Promise<Server> {
  const server = createPeoplePulseServer({
    config: loadPeoplePulseConfig(),
    identityProvider,
    ...(repositoryRoot ? { repositoryRoot } : {}),
    ...(decisionPath ? { decisionPath } : {}),
    ...(trustedOrigin ? { trustedOrigin } : {}),
    requireForwardedHttps
  });
  servers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return server;
}

function baseUrl(server: Server): string {
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  expect(response.status).toBe(200);
  return await response.json() as T;
}

function expectSecurityHeaders(response: Response): void {
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(response.headers.get("x-frame-options")).toBe("DENY");
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
}

async function temporaryDirectory(prefix: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}
