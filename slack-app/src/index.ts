import { loadConfig } from "./config.js";
import { createSlackApp } from "./slack/app.js";
import { ClaudeDraftService } from "./services/claude.js";
import { GoogleSheetsStore } from "./services/googleSheets.js";

const config = loadConfig({ requireSigningSecret: true });
const store = new GoogleSheetsStore(config);
await store.ensureReady();
const app = createSlackApp(config, store, new ClaudeDraftService(config));
await app.start(config.PORT);
console.log(`HR Moments Slack Assistant listening on port ${config.PORT}${config.DRY_RUN ? " in DRY-RUN mode" : ""}.`);
