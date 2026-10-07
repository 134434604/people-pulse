import { WebClient } from "@slack/web-api";
import { loadConfig } from "./config.js";
import { runWeeklyJob } from "./jobs/weekly.js";
import { ClaudeDraftService } from "./services/claude.js";
import { GoogleSheetsStore } from "./services/googleSheets.js";
import { SlackHistoryService } from "./services/slackHistory.js";

const config = loadConfig();
const client = new WebClient(config.SLACK_BOT_TOKEN);
const summary = await runWeeklyJob({
  config,
  client,
  store: new GoogleSheetsStore(config),
  claude: new ClaudeDraftService(config),
  history: new SlackHistoryService(client, config)
});
console.log(JSON.stringify(summary));
