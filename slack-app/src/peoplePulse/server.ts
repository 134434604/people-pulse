import { createHash } from "node:crypto";
import { createServer as createHttpServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { ChatProviderError, SnapshotChatService, chatRequestSchema, type PeoplePulseChatProvider } from "./chat.js";
import { loadPeoplePulseConfig, type PeoplePulseConfig } from "./config.js";
import { DecisionStore, DecisionStoreError } from "./decisionStore.js";
import { createSafeLogger, type SafeLogger } from "./safeLog.js";
import type { SignalDecision, WeeklySnapshot } from "./schemas.js";
import { weeklySnapshotSchema } from "./schemas.js";

export interface PeoplePulseIdentity {
  subject: string;
  displayName: string;
  role: "executive" | "viewer";
  demo: boolean;
}

export interface IdentityProvider {
  authenticate(request: IncomingMessage): Promise<PeoplePulseIdentity | null>;
}

export interface PeoplePulseServerOptions {
  repositoryRoot?: string;
  config?: PeoplePulseConfig;
  identityProvider?: IdentityProvider;
  insightsDirectory?: string;
  prototypePath?: string;
  decisionPath?: string;
  trustedOrigin?: string;
  requireForwardedHttps?: boolean;
  requestsPerMinute?: number;
  chatProvider?: PeoplePulseChatProvider;
  logger?: SafeLogger;
}

const decisionRequestSchema = z.object({ answerId: z.string().regex(/^[a-z0-9-]{2,40}$/), note: z.string().trim().max(1_000).default("") }).strict();
const restoreRequestSchema = z.object({ reason: z.string().trim().min(1).max(500) }).strict();
const weekPattern = /^\d{4}-\d{2}-\d{2}$/;

class HttpError extends Error {
  constructor(public readonly statusCode: number, public readonly publicMessage: string) {
    super(publicMessage);
    this.name = "HttpError";
  }
}

export function createPeoplePulseServer(options: PeoplePulseServerOptions = {}): Server {
  const repositoryRoot = options.repositoryRoot ?? fileURLToPath(new URL("../../../", import.meta.url));
  const config = options.config ?? loadPeoplePulseConfig();
  if (config.modes.data === "LIVE" && !options.identityProvider) {
    throw new Error("People Pulse LIVE data mode requires an explicit production identity provider.");
  }
  const identityProvider = options.identityProvider ?? demoExecutiveIdentityProvider;
  const insightsDirectory = options.insightsDirectory ?? join(repositoryRoot, "insights");
  const prototypePath = options.prototypePath ?? join(repositoryRoot, "prototype", "dept-insights-prototype.html");
  const decisions = new DecisionStore(options.decisionPath ?? join(repositoryRoot, "data", "decisions.json"));
  const trustedOrigin = normalizeOrigin(options.trustedOrigin);
  const rateLimiter = new FixedWindowRateLimiter(options.requestsPerMinute ?? 120, 60_000);
  const chatRateLimiter = new FixedWindowRateLimiter(config.chatRequestsPerMinute, 60_000);
  const logger = options.logger ?? createSafeLogger();
  const chatProvider = options.chatProvider ?? new SnapshotChatService(config, logger, {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: process.env.PP_CHAT_MODEL ?? process.env.PP_CLAUDE_MODEL
  });

  const server = createHttpServer(async (request, response) => {
    setSecurityHeaders(response);
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      if (request.method === "GET" && url.pathname === "/api/health") {
        return json(response, 200, { status: "ok" });
      }

      const identity = await identityProvider.authenticate(request);
      if (!identity) return json(response, 401, { error: "Authentication required." });
      if (identity.role !== "executive") return json(response, 403, { error: "Executive access required." });
      if (!rateLimiter.allow(identity.subject)) {
        response.setHeader("retry-after", "60");
        logger.warn("people_pulse_rate_limited", { route: routeLabel(request.method, url.pathname) });
        return json(response, 429, { error: "Request rate limit exceeded. Try again shortly." });
      }
      if (request.method === "POST") enforceMutationBoundary(request, trustedOrigin, options.requireForwardedHttps ?? false);

      if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
        return html(response, prototypePath);
      }

      if (request.method === "GET" && url.pathname === "/api/session") {
        return json(response, 200, {
          identity: { displayName: identity.displayName, role: identity.role, demo: identity.demo },
          modes: { ...config.modes, chat: config.chatMode }
        });
      }
      if (request.method === "GET" && url.pathname === "/api/weeks") {
        const names = await readdir(insightsDirectory);
        const weeks = names.filter((name) => name.endsWith(".json") && weekPattern.test(name.slice(0, -5))).map((name) => name.slice(0, -5)).sort().reverse();
        return json(response, 200, { weeks });
      }
      const insightMatch = url.pathname.match(/^\/api\/insights\/(\d{4}-\d{2}-\d{2})$/);
      if (request.method === "GET" && insightMatch) {
        const week = insightMatch[1];
        if (!week || !weekPattern.test(week)) return json(response, 400, { error: "Invalid week." });
        const snapshot = await loadSnapshot(insightsDirectory, week);
        const decisionList = await decisions.list();
        return json(response, 200, applyDecisionStates(snapshot, decisionList));
      }
      if (request.method === "GET" && url.pathname === "/api/decisions") {
        return json(response, 200, { decisions: await decisions.list() });
      }
      if (request.method === "POST" && url.pathname === "/api/chat") {
        if (!chatRateLimiter.allow(identity.subject)) {
          response.setHeader("retry-after", "60");
          logger.warn("people_pulse_chat_rate_limited", { route: "POST /api/chat" });
          return json(response, 429, { error: "Ask People Pulse request limit exceeded. Try again shortly." });
        }
        const week = url.searchParams.get("week");
        if (!week || !weekPattern.test(week)) return json(response, 400, { error: "A valid week is required." });
        const snapshot = await loadSnapshot(insightsDirectory, week);
        const body = parseRequest(chatRequestSchema, await readJsonBody(request));
        const actorIdHash = createHash("sha256").update(identity.subject, "utf8").digest("hex");
        return json(response, 200, await chatProvider.answer(snapshot, body, actorIdHash));
      }
      const signalDecisionMatch = url.pathname.match(/^\/api\/signals\/(sig_[a-f0-9]{16})\/decisions$/);
      if (request.method === "POST" && signalDecisionMatch) {
        const week = url.searchParams.get("week");
        if (!week || !weekPattern.test(week)) return json(response, 400, { error: "A valid week is required." });
        const snapshot = await loadSnapshot(insightsDirectory, week);
        const body = parseRequest(decisionRequestSchema, await readJsonBody(request));
        const decision = await decisions.record(snapshot, {
          signalId: signalDecisionMatch[1] ?? "",
          answerId: body.answerId,
          note: body.note,
          decidedBy: identity.displayName
        });
        return json(response, 201, { decision });
      }
      const restoreMatch = url.pathname.match(/^\/api\/decisions\/(decision_[a-f0-9]{16})\/restore$/);
      if (request.method === "POST" && restoreMatch) {
        const body = parseRequest(restoreRequestSchema, await readJsonBody(request));
        const decision = await decisions.restore(restoreMatch[1] ?? "", body.reason);
        return json(response, 200, { decision });
      }
      if (request.method === "GET" && extname(url.pathname) === ".json") return json(response, 404, { error: "Not found." });
      return json(response, 404, { error: "Not found." });
    } catch (error: unknown) {
      if (error instanceof HttpError) return json(response, error.statusCode, { error: error.publicMessage });
      if (error instanceof ChatProviderError) return json(response, error.statusCode, { error: error.publicMessage });
      if (error instanceof DecisionStoreError) return json(response, error.statusCode, { error: error.message });
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return json(response, 404, { error: "Requested artifact was not found." });
      logger.error("people_pulse_http_error", { statusCode: 500 });
      return json(response, 500, { error: "Unexpected server error." });
    }
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 5_000;
  return server;
}

const demoExecutiveIdentityProvider: IdentityProvider = {
  async authenticate(request) {
    const remote = request.socket.remoteAddress ?? "";
    if (!remote.includes("127.0.0.1") && remote !== "::1" && remote !== "::ffff:127.0.0.1") return null;
    return { subject: "demo-executive", displayName: "Demo Executive", role: "executive", demo: true };
  }
};

async function loadSnapshot(directory: string, week: string): Promise<WeeklySnapshot> {
  return weeklySnapshotSchema.parse(JSON.parse(await readFile(join(directory, `${week}.json`), "utf8")));
}

function applyDecisionStates(snapshot: WeeklySnapshot, decisions: readonly SignalDecision[]): WeeklySnapshot {
  return {
    ...snapshot,
    signals: snapshot.signals.map((signal) => {
      // Scope to this week: signal IDs recur across weeks, so a decision only governs the
      // week it was recorded against (see signalDecisionSchema.week).
      const active = decisions.filter((decision) => decision.signalId === signal.id && decision.week === snapshot.weekStart && !decision.restoredAt).at(-1);
      return { ...signal, state: active ? (active.concludes ? "concluded" : "answered") : "open" };
    })
  };
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  if (!String(request.headers["content-type"] ?? "").toLowerCase().startsWith("application/json")) {
    throw new HttpError(415, "Content-Type must be application/json.");
  }
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > 64 * 1_024) throw new HttpError(413, "Request body is too large.");
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.");
  }
}

function parseRequest<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new HttpError(400, "Request validation failed.");
  return result.data;
}

function json(response: ServerResponse, status: number, value: unknown): void {
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(value));
}

async function html(response: ServerResponse, path: string): Promise<void> {
  const content = await readFile(path, "utf8");
  response.statusCode = 200;
  response.setHeader("content-type", "text/html; charset=utf-8");
  response.setHeader("content-security-policy", buildSingleFileContentSecurityPolicy(content));
  response.end(content);
}

function setSecurityHeaders(response: ServerResponse): void {
  response.setHeader("x-content-type-options", "nosniff");
  response.setHeader("x-frame-options", "DENY");
  response.setHeader("referrer-policy", "no-referrer");
  response.setHeader("content-security-policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
  response.setHeader("cache-control", "no-store");
  response.setHeader("permissions-policy", "camera=(), geolocation=(), microphone=(), payment=(), usb=()");
  response.setHeader("strict-transport-security", "max-age=31536000; includeSubDomains");
}

function buildSingleFileContentSecurityPolicy(content: string): string {
  const styleHashes = inlineHashes(content, "style");
  const scriptHashes = inlineHashes(content, "script");
  return [
    "default-src 'none'",
    `script-src 'self' ${scriptHashes.join(" ")}`,
    `style-src 'self' ${styleHashes.join(" ")}`,
    "img-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'self'"
  ].join("; ");
}

function inlineHashes(content: string, tagName: "script" | "style"): string[] {
  const expression = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, "giu");
  return [...content.matchAll(expression)].map((match) => {
    const value = match[1] ?? "";
    return `'sha256-${createHash("sha256").update(value, "utf8").digest("base64")}'`;
  });
}

function enforceMutationBoundary(request: IncomingMessage, trustedOrigin: string | undefined, requireForwardedHttps: boolean): void {
  if (request.headers["x-people-pulse-csrf"] !== "1") {
    throw new HttpError(403, "Mutation request was not authorized by the People Pulse workspace.");
  }
  if (trustedOrigin && request.headers.origin !== trustedOrigin) {
    throw new HttpError(403, "Mutation request origin was not authorized.");
  }
  if (requireForwardedHttps) {
    const forwardedProtocol = singleForwardedValue(request.headers["x-forwarded-proto"]);
    const forwardedHost = singleForwardedValue(request.headers["x-forwarded-host"] ?? request.headers.host);
    const origin = request.headers.origin;
    let parsedOrigin: URL | undefined;
    try {
      parsedOrigin = origin ? new URL(origin) : undefined;
    } catch {
      parsedOrigin = undefined;
    }
    if (forwardedProtocol !== "https" || !forwardedHost || parsedOrigin?.protocol !== "https:" || parsedOrigin?.host.toLowerCase() !== forwardedHost) {
      throw new HttpError(403, "Mutation request transport or origin was not authorized.");
    }
  }
}

function normalizeOrigin(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const url = new URL(value);
  if (url.protocol !== "https:" || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("People Pulse trusted origin must be an HTTPS origin without a path, query, or fragment.");
  }
  return url.origin;
}

function routeLabel(method: string | undefined, pathname: string): string {
  if (pathname === "/api/chat") return `${method ?? "UNKNOWN"} /api/chat`;
  if (pathname.startsWith("/api/insights/")) return `${method ?? "UNKNOWN"} /api/insights/:week`;
  if (pathname.startsWith("/api/signals/")) return `${method ?? "UNKNOWN"} /api/signals/:id/decisions`;
  if (pathname.startsWith("/api/decisions/")) return `${method ?? "UNKNOWN"} /api/decisions/:id/restore`;
  return `${method ?? "UNKNOWN"} ${pathname.slice(0, 80)}`;
}

function singleForwardedValue(value: string | string[] | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  return value.split(",", 1)[0]?.trim().toLowerCase();
}

class FixedWindowRateLimiter {
  private readonly entries = new Map<string, { count: number; resetAt: number }>();

  constructor(private readonly limit: number, private readonly windowMs: number) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 10_000) throw new Error("Invalid People Pulse request rate limit.");
  }

  allow(subject: string, now = Date.now()): boolean {
    const existing = this.entries.get(subject);
    if (!existing || existing.resetAt <= now) {
      this.entries.set(subject, { count: 1, resetAt: now + this.windowMs });
      if (this.entries.size > 1_000) this.prune(now);
      return true;
    }
    existing.count += 1;
    return existing.count <= this.limit;
  }

  private prune(now: number): void {
    for (const [subject, value] of this.entries) if (value.resetAt <= now) this.entries.delete(subject);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const config = loadPeoplePulseConfig(process.env);
  const server = createPeoplePulseServer({ config });
  server.listen(config.port, "127.0.0.1", () => {
    console.log(`People Pulse TEST/MOCK server listening on http://127.0.0.1:${config.port}`);
  });
}
