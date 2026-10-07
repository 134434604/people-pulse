import { createRequire } from "node:module";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createPeoplePulseServer } from "../dist/peoplePulse/server.js";
import { loadPeoplePulseConfig } from "../dist/peoplePulse/config.js";

const playwright = await loadPlaywright();
const repositoryRoot = resolve(process.cwd(), "..");
const outputDirectory = join(repositoryRoot, "output", "playwright");
const temporaryDirectory = await mkdtemp(join(tmpdir(), "people-pulse-browser-"));
const server = createPeoplePulseServer({
  repositoryRoot,
  config: loadPeoplePulseConfig(),
  decisionPath: join(temporaryDirectory, "decisions.json")
});
await new Promise((resolveStart, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolveStart);
});
const address = server.address();
if (!address || typeof address === "string") throw new Error("People Pulse QA server did not expose a TCP port.");
const baseUrl = `http://127.0.0.1:${address.port}`;
const report = { baseUrl, checks: [], consoleErrors: [], failedRequests: [], screenshots: [] };
const sourceSnapshot = JSON.parse(await readFile(join(repositoryRoot, "insights", "2026-08-17.json"), "utf8"));
let browser;

try {
  browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ["clipboard-read", "clipboard-write"] });
  const page = await context.newPage();
  const networkRequests = [];
  page.on("request", (request) => networkRequests.push(`${request.method()} ${request.url()}`));
  page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(message.text()); });
  page.on("requestfailed", (request) => report.failedRequests.push(`${request.method()} ${request.url()} · ${request.failure()?.errorText ?? "failed"}`));
  page.on("response", (response) => { if (response.status() >= 500) report.failedRequests.push(`${response.status()} ${response.url()}`); });

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.locator("h1").waitFor();
  add("Dashboard loaded validated snapshot", (await page.locator("#statusText").innerText()).includes("Validated snapshot"));
  add("TEST/MOCK/OFF modes visible", /DATA TEST/.test(await page.locator("#footerModes").innerText()) && /SLACKREAD MOCK/.test(await page.locator("#footerModes").innerText()) && /CHAT MOCK/.test(await page.locator("#footerModes").innerText()) && /WRITEBACK OFF/.test(await page.locator("#footerModes").innerText()));
  add("Four departments visible", await page.locator(".filter").count() === 5);
  add("Capacity ladder renders six alternatives", await page.locator(".capacity-item .ladder span").count() === 6);

  const chatRequestsBefore = networkRequests.filter((request) => request.includes("/api/chat")).length;
  await page.locator(".chat-panel .suggestion").first().click();
  await page.locator(".chat-answer").first().waitFor();
  const firstChatAnswer = page.locator(".chat-answer").first();
  add("Ask People Pulse returns a cited unscheduled snapshot answer", await firstChatAnswer.locator(".chat-citation").count() > 0 && /Observation:/.test(await firstChatAnswer.innerText()));
  add("MOCK chat visibly proves zero provider contact", /MOCK · NO PROVIDER CONTACT/i.test(await firstChatAnswer.innerText()) && networkRequests.filter((request) => request.includes("/api/chat")).length === chatRequestsBefore + 1);
  const chatQuestion = page.locator("textarea[name=chatQuestion]");
  await chatQuestion.fill("Who is the least productive employee likely to leave?");
  await page.locator(".chat-form .ask-chat").click();
  await page.locator(".chat-answer.refused").waitFor();
  add("Employee-scoring question is refused without provider contact", /does not score or infer/i.test(await page.locator(".chat-answer.refused").innerText()) && /NO PROVIDER CONTACT/i.test(await page.locator(".chat-answer.refused").innerText()));
  add("No duplicate copy-to-Claude workflow is exposed", await page.getByText("Continue in company Claude", { exact: true }).count() === 0 && await page.getByRole("button", { name: /copy prompt for claude/i }).count() === 0);
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("h1").waitFor();
  add("Chat turns are session-only and disappear on reload", await page.locator(".chat-turn").count() === 0);
  await page.locator(".chat-panel .suggestion").first().click();
  await page.locator(".chat-answer").first().waitFor();

  await mkdir(outputDirectory, { recursive: true });
  await page.evaluate(() => { document.documentElement.dataset.theme = "light"; });
  await page.waitForTimeout(400);
  const lightPath = join(outputDirectory, "people-pulse-light.png");
  await page.screenshot({ path: lightPath, fullPage: true }); report.screenshots.push(lightPath);

  await page.locator(".signal-row").first().click();
  await page.locator("#inspectorTitle").waitFor();
  add("Signal inspector separates observation, interpretation, risk, and evidence", await page.locator(".inspector-block").count() >= 5 && await page.getByText("Risk of a wrong decision", { exact: true }).isVisible());
  await page.locator(".answer").first().click();
  await page.getByText(/Decision recorded/).waitFor();
  add("Copy records a decision and concludes the card", (await page.locator(".inspector .eyebrow").innerText()).toLowerCase().includes("concluded"));
  await page.getByText("Reopen this decision", { exact: true }).click();
  await page.getByText(/Decision reopened/).waitFor();
  add("Conclusion is reversible with history preserved", (await page.locator(".inspector .eyebrow").innerText()).toLowerCase().includes("open"));
  await page.locator(".close").click();

  await page.evaluate(() => { document.documentElement.dataset.theme = "dark"; document.getElementById("toast").hidden = true; window.scrollTo(0, 0); });
  await page.waitForTimeout(650);
  const darkPath = join(outputDirectory, "people-pulse-dark.png");
  await page.screenshot({ path: darkPath, fullPage: true }); report.screenshots.push(darkPath);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { document.documentElement.dataset.theme = "light"; document.getElementById("toast").hidden = true; window.scrollTo(0, 0); });
  await page.waitForTimeout(650);
  add("Mobile keeps Ask People Pulse one tap away", await page.locator("#askButton").isVisible());
  const mobilePath = join(outputDirectory, "people-pulse-mobile.png");
  await page.screenshot({ path: mobilePath, fullPage: true }); report.screenshots.push(mobilePath);
  add("Mobile viewport has no page-level horizontal overflow", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  add("No browser console errors", report.consoleErrors.length === 0);
  add("No failed requests or HTTP 5xx", report.failedRequests.length === 0);
  await context.close();

  await runScenario(
    "Permission denial renders the executive access boundary",
    async (scenarioPage) => scenarioPage.route("**/api/session", (route) => fulfillJson(route, 403, { error: "Executive access required." })),
    async (scenarioPage) => scenarioPage.getByRole("heading", { name: "Executive access required" }).isVisible()
  );
  await runScenario(
    "Empty week list renders a useful first-run state",
    async (scenarioPage) => scenarioPage.route("**/api/weeks", (route) => fulfillJson(route, 200, { weeks: [] })),
    async (scenarioPage) => scenarioPage.getByRole("heading", { name: "No weekly snapshots" }).isVisible()
  );
  await runScenario(
    "Snapshot HTTP failure renders a bounded retry state",
    async (scenarioPage) => scenarioPage.route("**/api/insights/*", (route) => fulfillJson(route, 500, { error: "Unexpected server error." })),
    async (scenarioPage) => {
      const [heading, retry] = await Promise.all([
        scenarioPage.getByRole("heading", { name: "People Pulse could not load" }).isVisible(),
        scenarioPage.getByRole("button", { name: "Try again" }).isVisible()
      ]);
      return heading && retry;
    }
  );
  await runScenario(
    "Stale evidence is visibly labeled",
    async (scenarioPage) => scenarioPage.route("**/api/insights/*", (route) => fulfillJson(route, 200, {
      ...sourceSnapshot,
      generatedAt: new Date(Date.now() - 10 * 86_400_000).toISOString()
    })),
    async (scenarioPage) => /Stale snapshot/.test(await scenarioPage.locator("#statusText").innerText())
  );
  await runScenario(
    "Partial evidence is visibly labeled",
    async (scenarioPage) => scenarioPage.route("**/api/insights/*", (route) => fulfillJson(route, 200, {
      ...sourceSnapshot,
      audit: { ...sourceSnapshot.audit, status: "partial" }
    })),
    async (scenarioPage) => /Partial snapshot/.test(await scenarioPage.locator("#statusText").innerText())
  );
  await runScenario(
    "Sparse results and long executive copy remain usable on mobile",
    async (scenarioPage) => scenarioPage.route("**/api/insights/*", (route) => fulfillJson(route, 200, {
      ...sourceSnapshot,
      summary: "Cross-department coverage needs deliberate follow-up before the next operating review. ".repeat(12),
      signals: [],
      capacitySignals: [],
      evidence: []
    })),
    async (scenarioPage) => {
      const [signalsEmpty, capacityEmpty, noOverflow] = await Promise.all([
        scenarioPage.getByText("No cited signals match this department filter.", { exact: true }).isVisible(),
        scenarioPage.getByText("No sustained multi-week capacity pattern meets the evidence threshold.", { exact: true }).isVisible(),
        scenarioPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
      ]);
      return signalsEmpty && capacityEmpty && noOverflow;
    },
    { width: 390, height: 844 }
  );
  await runLoadingScenario();
  await runScenario(
    "Decision conflict remains non-executing and recoverable",
    async (scenarioPage) => scenarioPage.route("**/api/signals/*/decisions?week=*", (route) => fulfillJson(route, 409, { error: "Decision changed while this card was open. Reload and review the latest evidence." })),
    async (scenarioPage) => {
      await scenarioPage.locator(".signal-row").first().click();
      const decisionButton = scenarioPage.locator(".answer").first();
      await decisionButton.click();
      await scenarioPage.getByText("Decision changed while this card was open. Reload and review the latest evidence.", { exact: true }).waitFor();
      return decisionButton.isEnabled();
    }
  );
  await runScenario(
    "Chat provider failure renders a bounded inline error",
    async (scenarioPage) => scenarioPage.route(/\/api\/chat\?week=/u, (route) => fulfillJson(route, 502, { error: "Ask People Pulse is temporarily unavailable." })),
    async (scenarioPage) => {
      await scenarioPage.locator(".chat-panel .suggestion").first().click();
      const inlineError = scenarioPage.locator(".chat-answer.refused p");
      await inlineError.waitFor();
      return (await inlineError.innerText()).includes("Ask People Pulse is temporarily unavailable.");
    }
  );
} finally {
  if (browser) await browser.close();
  await new Promise((resolveClose) => server.close(resolveClose));
  await rm(temporaryDirectory, { recursive: true, force: true });
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(join(outputDirectory, "people-pulse-browser-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

console.table(report.checks);
if (report.checks.some((item) => item.status !== "PASS")) process.exitCode = 1;
else console.log(`People Pulse browser QA passed (${report.checks.length}/${report.checks.length}). ${report.screenshots.length} screenshots captured.`);

function add(check, passed) { report.checks.push({ check, status: passed ? "PASS" : "FAIL" }); }

async function runScenario(check, setup, assertScenario, viewport = { width: 1440, height: 1000 }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  try {
    await setup(page);
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    add(check, await assertScenario(page) && pageErrors.length === 0);
  } catch (error) {
    add(`${check} · ${error instanceof Error ? error.message : String(error)}`, false);
  } finally {
    await context.close();
  }
}

function fulfillJson(route, status, body) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function runLoadingScenario() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  try {
    await page.route("**/api/insights/*", async (route) => {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
      await route.continue();
    });
    const navigation = page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.locator(".skeleton").first().waitFor();
    const skeletonCount = await page.locator(".skeleton").count();
    await navigation;
    add("Delayed snapshot shows loading skeletons and then resolves", skeletonCount === 3
      && /Validated snapshot/.test(await page.locator("#statusText").innerText())
      && pageErrors.length === 0);
  } catch (error) {
    add(`Delayed snapshot loading state · ${error instanceof Error ? error.message : String(error)}`, false);
  } finally {
    await context.close();
  }
}

async function loadPlaywright() {
  try { return await import("playwright"); }
  catch {
    const runtimeModules = process.env.CODEX_RUNTIME_NODE_MODULES
      ?? join(process.env.USERPROFILE ?? "", ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "node", "node_modules");
    const require = createRequire(join(runtimeModules, "package.json"));
    return require("playwright");
  }
}
