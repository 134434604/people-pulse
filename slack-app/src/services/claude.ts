import type { AppConfig } from "../config.js";
import { countWords, normalizeForSimilarity, similarityScore } from "../domain/similarity.js";
import type { Anniversary, DraftResult, DraftVariant, PriorMessage } from "../domain/types.js";

interface ClaudePayload {
  variants: { warm: string; professional: string; concise: string };
  quality: {
    does_not_invent_details: boolean;
    avoids_prior_wording: boolean;
    within_word_limit: boolean;
    professional: boolean;
  };
}

const SYSTEM_PROMPT = `You write short internal work-anniversary Slack messages for HR review.
Use only supplied facts. Never invent achievements, performance claims, personal details, or company-wide sentiment.
Return three meaningfully different variants. Do not include a signature, email subject, employee ID, or explanation.`;

export class ClaudeDraftService {
  constructor(private readonly config: AppConfig) {}

  async generate(anniversary: Anniversary, prior: PriorMessage, instruction = "standard"): Promise<DraftResult> {
    if (this.config.DRY_RUN) return this.mock(anniversary);
    let result = await this.request(anniversary, prior, instruction, false);
    if (this.hasSimilarityFailure(result.variants, prior.text)) {
      result = await this.request(anniversary, prior, instruction, true);
    }
    return this.validate(result, prior.text);
  }

  private async request(anniversary: Anniversary, prior: PriorMessage, instruction: string, strongerAvoidance: boolean): Promise<ClaudePayload> {
    const prompt = buildClaudePrompt(this.config, anniversary, prior, instruction, strongerAvoidance);
    const body = {
      model: this.config.ANTHROPIC_MODEL,
      max_tokens: 900,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["variants", "quality"],
            properties: {
              variants: {
                type: "object",
                additionalProperties: false,
                required: ["warm", "professional", "concise"],
                properties: {
                  warm: { type: "string" },
                  professional: { type: "string" },
                  concise: { type: "string" }
                }
              },
              quality: {
                type: "object",
                additionalProperties: false,
                required: ["does_not_invent_details", "avoids_prior_wording", "within_word_limit", "professional"],
                properties: {
                  does_not_invent_details: { type: "boolean" },
                  avoids_prior_wording: { type: "boolean" },
                  within_word_limit: { type: "boolean" },
                  professional: { type: "boolean" }
                }
              }
            }
          }
        }
      }
    };

    let lastError = "Claude request failed.";
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": this.config.ANTHROPIC_API_KEY!,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify(body)
      });
      const responseBody = await response.text();
      if (response.ok) {
        const parsed = JSON.parse(responseBody) as { stop_reason?: string; content?: Array<{ type: string; text?: string }> };
        if (parsed.stop_reason === "refusal") throw new Error("Claude declined to generate this message.");
        if (parsed.stop_reason === "max_tokens") throw new Error("Claude response reached its token limit.");
        const text = parsed.content?.find((item) => item.type === "text")?.text;
        if (!text) throw new Error("Claude returned no structured text output.");
        return JSON.parse(text) as ClaudePayload;
      }
      try {
        const error = JSON.parse(responseBody) as { error?: { message?: string } };
        lastError = error.error?.message || `Claude request failed with HTTP ${response.status}.`;
      } catch {
        lastError = `Claude request failed with HTTP ${response.status}.`;
      }
      if (response.status !== 429 && response.status < 500) break;
      await new Promise((resolve) => setTimeout(resolve, 900 * (attempt + 1) ** 2));
    }
    throw new Error(lastError);
  }

  private validate(payload: ClaudePayload, priorText: string): DraftResult {
    const variants: DraftVariant[] = [
      { label: "Warm", message: clean(payload.variants?.warm) },
      { label: "Professional", message: clean(payload.variants?.professional) },
      { label: "Concise", message: clean(payload.variants?.concise) }
    ];
    const warnings: string[] = [];
    const seen = new Set<string>();
    for (const variant of variants) {
      if (!variant.message) throw new Error(`Claude returned a blank ${variant.label} variant.`);
      const normalized = normalizeForSimilarity(variant.message);
      if (seen.has(normalized)) throw new Error("Claude returned duplicate variants.");
      seen.add(normalized);
      if (countWords(variant.message) > this.config.WORD_LIMIT) throw new Error(`${variant.label} exceeded the word limit.`);
      const similarity = similarityScore(priorText, variant.message);
      if (similarity.tooSimilar || similarity.score >= this.config.SIMILARITY_LIMIT) {
        throw new Error(`${variant.label} remained too similar to the prior message after retry.`);
      }
      if (countWords(variant.message) < 12) warnings.push(`${variant.label} is unusually short.`);
    }
    if (payload.quality?.does_not_invent_details === false) warnings.push("Claude flagged possible invented details.");
    if (payload.quality?.professional === false) warnings.push("Claude flagged tone for HR review.");
    return { variants, warnings };
  }

  private hasSimilarityFailure(variants: ClaudePayload["variants"], priorText: string): boolean {
    return [variants?.warm, variants?.professional, variants?.concise].some((text) => {
      const result = similarityScore(priorText, text || "");
      return result.tooSimilar || result.score >= this.config.SIMILARITY_LIMIT;
    });
  }

  private mock(anniversary: Anniversary): DraftResult {
    const name = anniversary.employee.preferredName || anniversary.employee.firstName || anniversary.employee.displayName;
    const years = anniversary.yearsOfService;
    return {
      variants: [
        { label: "Warm", message: `Happy ${years}-year work anniversary, ${name}! Your time with the team is worth celebrating, and we hope you enjoy this well-earned milestone.` },
        { label: "Professional", message: `Please join us in recognizing ${name} on ${years} years with the organization. Congratulations on this important work anniversary.` },
        { label: "Concise", message: `Congratulations to ${name} on ${years} years with the team. Happy work anniversary!` }
      ],
      warnings: ["Dry-run drafts were generated locally; Claude was not called."]
    };
  }
}

export function buildClaudePrompt(config: AppConfig, anniversary: Anniversary, prior: PriorMessage, instruction: string, strongerAvoidance: boolean): string {
  const employee = anniversary.employee;
  const lines = [
    "Write work-anniversary Slack message drafts using only this context:",
    `Employee preferred name: ${safe(employee.preferredName || employee.firstName || employee.displayName)}`,
    `Years of service: ${anniversary.yearsOfService}`,
    `Tone: ${safe(config.DEFAULT_TONE)}`,
    `Maximum words per variant: ${config.WORD_LIMIT}`,
    `Prior message to avoid copying: ${safe(prior.text || "None found")}`
  ];
  if (config.INCLUDE_DEPARTMENT && employee.department) lines.push(`Department: ${safe(employee.department)}`);
  if (instruction !== "standard") lines.push(`Revision instruction: ${safe(instruction)}`);
  if (strongerAvoidance) lines.push("Retry requirement: use clearly different structure and phrasing from the prior message and from each other.");
  lines.push("Warm, Professional, and Concise must be distinct. Do not mention that a prior message was searched.");
  return lines.join("\n");
}

function safe(value: string): string {
  return String(value || "").replace(/[\r\n]+/g, " ").slice(0, 1200);
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
