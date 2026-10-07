import { z } from "zod";

export const dataModeSchema = z.enum(["TEST", "LIVE"]);
export const providerModeSchema = z.enum(["MOCK", "LIVE"]);
export const notifyModeSchema = z.enum(["OFF", "CAPTURE", "LIVE"]);
export const writebackModeSchema = z.literal("OFF");

export const peoplePulseModesSchema = z.object({
  data: dataModeSchema,
  slackRead: providerModeSchema,
  ai: providerModeSchema,
  notify: notifyModeSchema,
  writeback: writebackModeSchema
}).strict();

export type PeoplePulseModes = z.infer<typeof peoplePulseModesSchema>;

export interface PeoplePulseConfig {
  modes: PeoplePulseModes;
  chatMode: z.infer<typeof providerModeSchema>;
  attentionAfterHours: number;
  minimumAttentionReplies: number;
  maximumExcerptCharacters: number;
  maximumHistoryPages: number;
  maximumRetries: number;
  requestSpacingMs: number;
  capacityMinimumOccurrences: number;
  capacityMinimumWeeks: number;
  weeklyCostBudgetUsd: number;
  chatCostBudgetUsd: number;
  chatRequestsPerMinute: number;
  port: number;
}

const SAFE_MODES: PeoplePulseModes = Object.freeze({
  data: "TEST",
  slackRead: "MOCK",
  ai: "MOCK",
  notify: "OFF",
  writeback: "OFF"
});

export function loadPeoplePulseConfig(
  environment: NodeJS.ProcessEnv = process.env
): PeoplePulseConfig {
  return {
    modes: {
      data: safeEnum(dataModeSchema, environment.PP_DATA_MODE, SAFE_MODES.data),
      slackRead: safeEnum(providerModeSchema, environment.PP_SLACK_READ_MODE, SAFE_MODES.slackRead),
      ai: safeEnum(providerModeSchema, environment.PP_AI_MODE, SAFE_MODES.ai),
      notify: safeEnum(notifyModeSchema, environment.PP_NOTIFY_MODE, SAFE_MODES.notify),
      writeback: "OFF"
    },
    chatMode: safeEnum(providerModeSchema, environment.PP_CHAT_MODE, "MOCK"),
    attentionAfterHours: safeInteger(environment.PP_ATTENTION_HOURS, 48, 1, 720),
    minimumAttentionReplies: safeInteger(environment.PP_MIN_ATTENTION_REPLIES, 3, 1, 100),
    maximumExcerptCharacters: safeInteger(environment.PP_MAX_EXCERPT_CHARS, 80, 20, 160),
    maximumHistoryPages: safeInteger(environment.PP_MAX_HISTORY_PAGES, 50, 1, 500),
    maximumRetries: safeInteger(environment.PP_MAX_RETRIES, 4, 0, 10),
    requestSpacingMs: safeInteger(environment.PP_REQUEST_SPACING_MS, 1000, 0, 60_000),
    capacityMinimumOccurrences: safeInteger(environment.PP_CAPACITY_MIN_OCCURRENCES, 4, 2, 100),
    capacityMinimumWeeks: safeInteger(environment.PP_CAPACITY_MIN_WEEKS, 3, 2, 26),
    weeklyCostBudgetUsd: safeNumber(environment.PP_WEEKLY_COST_BUDGET_USD, 5, 0.01, 10_000),
    chatCostBudgetUsd: safeNumber(environment.PP_CHAT_COST_BUDGET_USD, 0.5, 0.01, 100),
    chatRequestsPerMinute: safeInteger(environment.PP_CHAT_REQUESTS_PER_MINUTE, 12, 1, 120),
    port: safeInteger(environment.PP_PORT, 3100, 1, 65_535)
  };
}

function safeEnum<T extends z.ZodType>(schema: T, value: string | undefined, fallback: z.infer<T>): z.infer<T> {
  const parsed = schema.safeParse(value?.trim().toUpperCase());
  return parsed.success ? parsed.data : fallback;
}

function safeInteger(value: string | undefined, fallback: number, minimum: number, maximum: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}

function safeNumber(value: string | undefined, fallback: number, minimum: number, maximum: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}
