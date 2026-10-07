import { loadConfig } from "./config.js";
import { GoogleSheetsStore } from "./services/googleSheets.js";

const config = loadConfig();
const store = new GoogleSheetsStore(config);
await store.ensureReady();
console.log("Company Sheet initialized. Existing tabs plus Dept Channel Map and Insights Runs are ready.");
