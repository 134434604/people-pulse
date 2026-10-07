import "dotenv/config";
import { z } from "zod";

const booleanText = z.string().default("true").transform((value) => value.toLowerCase() === "true");
const optionalSecret = z.string().optional().transform((value) => value?.trim() || undefined);

const schema = z.object({
  SLACK_BOT_TOKEN: z.string().min(1),
  SLACK_SIGNING_SECRET: optionalSecret,
  SLACK_REVIEW_CHANNEL_ID: z.string().min(1),
  SLACK_CELEBRATION_CHANNEL_ID: z.string().min(1),
  HR_APPROVER_USER_IDS: z.string().min(1),
  ANTHROPIC_API_KEY: optionalSecret,
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-4-6"),
  GOOGLE_SPREADSHEET_ID: z.string().min(1),
  GOOGLE_SERVICE_ACCOUNT_JSON_BASE64: optionalSecret,
  DRY_RUN: booleanText,
  PORT: z.coerce.number().int().positive().default(3000),
  WEEKLY_LOOKAHEAD_DAYS: z.coerce.number().int().min(1).max(31).default(7),
  WORD_LIMIT: z.coerce.number().int().min(25).max(150).default(70),
  DEFAULT_TONE: z.string().default("Warm, professional, concise"),
  INCLUDE_DEPARTMENT: z.string().default("false").transform((value) => value.toLowerCase() === "true"),
  SIMILARITY_LIMIT: z.coerce.number().min(0.1).max(1).default(0.46),
  PRIOR_MESSAGE_WINDOW_DAYS: z.coerce.number().int().min(7).max(180).default(60)
});

export type AppConfig = z.infer<typeof schema> & { approverIds: Set<string> };

export function loadConfig(options: { requireSigningSecret?: boolean } = {}): AppConfig {
  const parsed = schema.parse(process.env);
  if (options.requireSigningSecret && !parsed.SLACK_SIGNING_SECRET) {
    throw new Error("SLACK_SIGNING_SECRET is required for the interactive Slack server.");
  }
  if (!parsed.DRY_RUN && !parsed.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is required when DRY_RUN is false.");
  }
  return {
    ...parsed,
    approverIds: new Set(parsed.HR_APPROVER_USER_IDS.split(",").map((id) => id.trim()).filter(Boolean))
  };
}
