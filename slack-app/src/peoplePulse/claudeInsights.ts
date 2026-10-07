import { z } from "zod";
import type { PeoplePulseConfig } from "./config.js";
import { buildInsightsPrompt, type DepartmentInsightsInput } from "./insightsPrompt.js";
import type { SafeLogger } from "./safeLog.js";

const assessmentSchema = z.object({
  observationIds: z.array(z.string().regex(/^obs_[a-f0-9]{16}$/)).min(1).max(50),
  evidenceIds: z.array(z.string().regex(/^ev_[a-f0-9]{16}$/)).min(1).max(50),
  interpretation: z.string().trim().min(1).max(220),
  confidence: z.number().min(0).max(1),
  missingInformation: z.array(z.string().trim().min(1).max(140)).max(8)
}).strict();

export const departmentInsightSchema = z.object({
  department: z.string().trim().min(1).max(80),
  executiveSummary: z.string().trim().min(1).max(240),
  assessments: z.array(assessmentSchema).max(50)
}).strict();

export type DepartmentInsight = z.infer<typeof departmentInsightSchema>;

export interface InsightUsage {
  inputTokens: number;
  outputTokens: number;
  costEstimateUsd: number;
  model: string;
}

export interface DepartmentInsightResult {
  insight: DepartmentInsight;
  usage: InsightUsage;
}

export interface ClaudeInsightsOptions {
  apiKey?: string;
  model?: string;
  inputCostPerMillionUsd?: number;
  outputCostPerMillionUsd?: number;
  fetchImplementation?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
}

const TOOL_NAME = "record_department_insights";
const TOOL_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["department", "executiveSummary", "assessments"],
  properties: {
    department: { type: "string" },
    executiveSummary: { type: "string" },
    assessments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["observationIds", "evidenceIds", "interpretation", "confidence", "missingInformation"],
        properties: {
          observationIds: { type: "array", items: { type: "string" } },
          evidenceIds: { type: "array", items: { type: "string" } },
          interpretation: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          missingInformation: { type: "array", items: { type: "string" } }
        }
      }
    }
  }
} as const;

const anthropicResponseSchema = z.object({
  content: z.array(z.object({
    type: z.string(),
    name: z.string().optional(),
    input: z.unknown().optional()
  }).passthrough()),
  usage: z.object({
    input_tokens: z.number().int().min(0),
    output_tokens: z.number().int().min(0)
  }).strict()
}).passthrough();

export class ClaudeInsightsService {
  private readonly fetchImplementation: typeof fetch;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly inputCostPerMillionUsd: number;
  private readonly outputCostPerMillionUsd: number;

  constructor(
    private readonly config: PeoplePulseConfig,
    private readonly logger: SafeLogger,
    private readonly options: ClaudeInsightsOptions = {}
  ) {
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.sleep = options.sleep ?? defaultSleep;
    this.inputCostPerMillionUsd = options.inputCostPerMillionUsd ?? 3;
    this.outputCostPerMillionUsd = options.outputCostPerMillionUsd ?? 15;
  }

  async summarizeDepartments(inputs: readonly DepartmentInsightsInput[]): Promise<DepartmentInsightResult[]> {
    const results: DepartmentInsightResult[] = [];
    let totalCost = 0;
    const departments = new Set<string>();
    for (const input of inputs) {
      const departmentKey = input.department.trim().toLowerCase();
      if (departments.has(departmentKey)) throw new Error(`Duplicate People Pulse AI department input: ${input.department}`);
      departments.add(departmentKey);
    }
    for (const input of inputs) {
      const result = this.config.modes.ai === "MOCK" ? this.mock(input) : await this.live(input);
      totalCost += result.usage.costEstimateUsd;
      this.logger.info("people_pulse_ai_department", {
        department: input.department,
        model: result.usage.model,
        tokensIn: result.usage.inputTokens,
        tokensOut: result.usage.outputTokens,
        costEstimateUsd: result.usage.costEstimateUsd
      });
      if (totalCost > this.config.weeklyCostBudgetUsd) {
        throw new Error(`People Pulse weekly AI cost budget exceeded: $${totalCost.toFixed(4)}`);
      }
      results.push(result);
    }
    return results;
  }

  private mock(input: DepartmentInsightsInput): DepartmentInsightResult {
    const assessments = input.taskFacts.map((fact) => ({
      observationIds: [fact.observationId],
      evidenceIds: [...fact.evidenceIds],
      interpretation: `The cited ${fact.taskArea.toLowerCase()} fact may indicate a ${fact.kind.replace(/-/g, " ")} in the work system.`,
      confidence: 0.8,
      missingInformation: ["Accountable owner", "Business deadline"]
    }));
    return {
      insight: departmentInsightSchema.parse({
        department: input.department,
        executiveSummary: assessments.length > 0
          ? `${input.department} has ${assessments.length} cited task-flow observation${assessments.length === 1 ? "" : "s"} for executive review.`
          : `${input.department} has insufficient cited task evidence for an interpretation this week.`,
        assessments
      }),
      usage: { inputTokens: 0, outputTokens: 0, costEstimateUsd: 0, model: "mock-people-pulse-v1" }
    };
  }

  private async live(input: DepartmentInsightsInput): Promise<DepartmentInsightResult> {
    if (!this.options.apiKey || !this.options.model) {
      throw new Error("Live People Pulse AI requires an explicit API key and model.");
    }
    const prompt = buildInsightsPrompt(input);
    const body = {
      model: this.options.model,
      max_tokens: 1_500,
      temperature: 0.3,
      system: prompt.system,
      messages: [{ role: "user", content: prompt.user }],
      tools: [{ name: TOOL_NAME, description: "Record evidence-bound department insights.", input_schema: TOOL_INPUT_SCHEMA }],
      tool_choice: { type: "tool", name: TOOL_NAME }
    };

    let lastError = "Anthropic request failed.";
    for (let attempt = 0; attempt <= this.config.maximumRetries; attempt += 1) {
      const response = await this.fetchImplementation("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": this.options.apiKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify(body)
      });
      const responseText = await response.text();
      if (response.ok) {
        const parsed = anthropicResponseSchema.parse(JSON.parse(responseText));
        const toolUse = parsed.content.find((content) => content.type === "tool_use" && content.name === TOOL_NAME);
        if (!toolUse) throw new Error("Anthropic response did not use the required People Pulse tool.");
        const insight = departmentInsightSchema.parse(toolUse.input);
        validateEvidenceBindings(insight, input);
        const costEstimateUsd = roundCost(
          (parsed.usage.input_tokens / 1_000_000) * this.inputCostPerMillionUsd
          + (parsed.usage.output_tokens / 1_000_000) * this.outputCostPerMillionUsd
        );
        return {
          insight,
          usage: {
            inputTokens: parsed.usage.input_tokens,
            outputTokens: parsed.usage.output_tokens,
            costEstimateUsd,
            model: this.options.model
          }
        };
      }

      lastError = `Anthropic request failed with HTTP ${response.status}.`;
      if ((response.status !== 429 && response.status < 500) || attempt >= this.config.maximumRetries) break;
      const retryAfterSeconds = Number(response.headers.get("retry-after") ?? 0);
      await this.sleep(Math.max(retryAfterSeconds * 1_000, 500 * 2 ** attempt));
    }
    throw new Error(lastError);
  }
}

function validateEvidenceBindings(insight: DepartmentInsight, input: DepartmentInsightsInput): void {
  if (insight.department !== input.department) throw new Error("Anthropic insight department did not match its request.");
  const allowedObservations = new Set(input.taskFacts.map((fact) => fact.observationId));
  const allowedEvidence = new Set(input.taskFacts.flatMap((fact) => fact.evidenceIds));
  for (const assessment of insight.assessments) {
    if (assessment.observationIds.some((id) => !allowedObservations.has(id))) {
      throw new Error("Anthropic insight cited an unknown observation ID.");
    }
    if (assessment.evidenceIds.some((id) => !allowedEvidence.has(id))) {
      throw new Error("Anthropic insight cited an unknown evidence ID.");
    }
  }
}

function roundCost(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

async function defaultSleep(milliseconds: number): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}
