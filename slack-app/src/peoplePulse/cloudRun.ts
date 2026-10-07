import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { SnapshotChatService } from "./chat.js";
import { loadPeoplePulseConfig } from "./config.js";
import { GoogleIapIdentityProvider } from "./googleIapIdentity.js";
import { createSafeLogger } from "./safeLog.js";
import { createPeoplePulseServer } from "./server.js";

const cloudRunEnvironmentSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65_535).default(8080),
  PP_IAP_AUDIENCE: z.string().regex(/^\/projects\/\d+\/locations\/[a-z0-9-]+\/services\/[a-z][a-z0-9-]{0,62}$/),
  PP_GOOGLE_WORKSPACE_DOMAIN: z.string().trim().min(3).max(253),
  PP_INSIGHTS_DIRECTORY: z.string().trim().min(1).default("/mnt/people-pulse/insights"),
  PP_DECISION_PATH: z.string().trim().min(1).default("/mnt/people-pulse/decisions/decisions.json"),
  PP_HTTP_REQUESTS_PER_MINUTE: z.coerce.number().int().min(10).max(1_000).default(120)
}).passthrough();

export async function startPeoplePulseCloudRun(environment: NodeJS.ProcessEnv = process.env): Promise<void> {
  const cloud = cloudRunEnvironmentSchema.parse(environment);
  const config = loadPeoplePulseConfig(environment);
  if (config.modes.data !== "LIVE") throw new Error("Cloud Run People Pulse requires PP_DATA_MODE=LIVE.");
  await mkdir(cloud.PP_INSIGHTS_DIRECTORY, { recursive: true });
  await mkdir(dirname(cloud.PP_DECISION_PATH), { recursive: true });
  const logger = createSafeLogger();
  const chatProvider = new SnapshotChatService(config, logger, {
    apiKey: environment.ANTHROPIC_API_KEY,
    model: environment.PP_CHAT_MODEL ?? environment.PP_CLAUDE_MODEL
  });
  const identityProvider = new GoogleIapIdentityProvider({
    expectedAudience: cloud.PP_IAP_AUDIENCE,
    workspaceDomain: cloud.PP_GOOGLE_WORKSPACE_DOMAIN,
    logger
  });
  const server = createPeoplePulseServer({
    config,
    identityProvider,
    insightsDirectory: cloud.PP_INSIGHTS_DIRECTORY,
    decisionPath: cloud.PP_DECISION_PATH,
    requireForwardedHttps: true,
    requestsPerMinute: cloud.PP_HTTP_REQUESTS_PER_MINUTE,
    chatProvider,
    logger
  });
  server.listen(cloud.PORT, "0.0.0.0", () => {
    logger.info("people_pulse_cloud_run_started", {
      port: cloud.PORT,
      dataMode: config.modes.data,
      slackReadMode: config.modes.slackRead,
      aiMode: config.modes.ai,
      chatMode: config.chatMode,
      notifyMode: config.modes.notify,
      writebackMode: config.modes.writeback
    });
  });
  const stop = (): void => {
    server.close(() => process.exit(0));
  };
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await startPeoplePulseCloudRun();
}
