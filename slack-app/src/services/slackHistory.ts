import type { WebClient } from "@slack/web-api";
import type { AppConfig } from "../config.js";
import type { Anniversary, PriorMessage } from "../domain/types.js";

export class SlackHistoryService {
  constructor(private readonly client: WebClient, private readonly config: AppConfig) {}

  async findPriorMessage(anniversary: Anniversary): Promise<PriorMessage> {
    const previousYear = anniversary.year - 1;
    const target = new Date(`${previousYear}-${anniversary.occurrenceDate.slice(5)}T12:00:00Z`);
    const windowMs = this.config.PRIOR_MESSAGE_WINDOW_DAYS * 86_400_000;
    const oldest = String((target.getTime() - windowMs) / 1000);
    const latest = String((target.getTime() + windowMs) / 1000);
    let cursor: string | undefined;
    const candidates: Array<{ text: string; ts: string }> = [];

    for (let page = 0; page < 4; page += 1) {
      const response = await this.client.conversations.history({
        channel: this.config.SLACK_CELEBRATION_CHANNEL_ID,
        oldest,
        latest,
        limit: 100,
        cursor,
        inclusive: true
      });
      for (const message of response.messages ?? []) {
        if (!message.text || !message.ts) continue;
        if (this.matchesEmployee(message.text, anniversary) && /anniversar|years?|milestone/i.test(message.text)) {
          candidates.push({ text: message.text, ts: message.ts });
        }
      }
      cursor = response.response_metadata?.next_cursor || undefined;
      if (!cursor) break;
    }

    candidates.sort((a, b) => Math.abs(Number(a.ts) * 1000 - target.getTime()) - Math.abs(Number(b.ts) * 1000 - target.getTime()));
    const match = candidates[0];
    if (!match) return { found: false, text: "", url: "", timestamp: "" };
    const permalink = await this.client.chat.getPermalink({ channel: this.config.SLACK_CELEBRATION_CHANNEL_ID, message_ts: match.ts });
    return { found: true, text: match.text, url: permalink.permalink || "", timestamp: match.ts };
  }

  private matchesEmployee(text: string, anniversary: Anniversary): boolean {
    const employee = anniversary.employee;
    if (employee.slackUserId && text.includes(`<@${employee.slackUserId}>`)) return true;
    const normalized = text.toLowerCase();
    return [employee.displayName, `${employee.firstName} ${employee.lastName}`, employee.preferredName]
      .filter((name) => name.trim().length >= 3)
      .some((name) => normalized.includes(name.toLowerCase()));
  }
}
