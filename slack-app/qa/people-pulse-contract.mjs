import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { weeklySnapshotSchema } from "../dist/peoplePulse/schemas.js";

const repositoryRoot = resolve(process.cwd(), "..");
const sourceRoot = join(process.cwd(), "src", "peoplePulse");
const prototypePath = join(repositoryRoot, "prototype", "dept-insights-prototype.html");
const manifestPath = join(process.cwd(), "people-pulse-manifest.example.yml");
const snapshotPath = join(repositoryRoot, "insights", "2026-08-17.json");
const implementationContractPath = join(repositoryRoot, "docs", "PEOPLE_PULSE_IMPLEMENTATION_CONTRACT.md");
const productRequirementsPath = join(repositoryRoot, "docs", "people-pulse-PRD.md");
const securityReadinessPath = join(repositoryRoot, "docs", "SECURITY-IT-READINESS.md");
const deploymentPlanPath = join(repositoryRoot, "docs", "HR-LEADER-DEPLOYMENT-PLAN.md");
const serverPath = join(sourceRoot, "server.ts");

const sources = await readSources(sourceRoot);
const prototype = await readFile(prototypePath, "utf8");
const manifest = await readFile(manifestPath, "utf8");
const snapshot = weeklySnapshotSchema.parse(JSON.parse(await readFile(snapshotPath, "utf8")));
const implementationContract = await readFile(implementationContractPath, "utf8");
const productRequirements = await readFile(productRequirementsPath, "utf8");
const securityReadiness = await readFile(securityReadinessPath, "utf8");
const deploymentPlan = await readFile(deploymentPlanPath, "utf8");
const server = await readFile(serverPath, "utf8");
const auditableContract = implementationContract.replace(/## Status legend[\s\S]*?## Phase 0/u, "## Phase 0");

const checks = [
  check("Validated v3 fixture snapshot", snapshot.schemaVersion === 3 && snapshot.departmentCoverage.length === 4),
  check("Safe effective modes", snapshot.modes.data === "TEST" && snapshot.modes.slackRead === "MOCK" && snapshot.modes.ai === "MOCK" && snapshot.modes.notify === "OFF" && snapshot.modes.writeback === "OFF" && !("chat" in snapshot.modes)),
  check("Bounded persisted evidence", snapshot.evidence.every((item) => item.boundedSummary.length <= 80 && item.contentHash.length === 64)),
  check("No write-capable Slack call in People Pulse", !/chat\.postMessage|chat\.update|conversations\.open|files\.upload|webhook/i.test(sources)),
  check("Slack reads centralized", (sources.match(/conversations\.(?:history|replies)/g) ?? []).length === 2),
  check("Separate Slack manifest is read-only", /channels:history/.test(manifest) && /channels:read/.test(manifest) && !/^\s*-\s*(?:chat:write|groups:history|im:history|mpim:history|files:read)\s*$/m.test(manifest)),
  check("Writeback cannot be enabled", /writebackModeSchema = z\.literal\("OFF"\)/.test(sources)),
  check("Scheduled AI and embedded chat default independently to MOCK", /ai: "MOCK"/.test(sources) && /chatMode: safeEnum\([^\n]+"MOCK"\)/.test(sources) && /\/api\/chat/.test(server)),
  check("UI displays modes and exclusions", /Effective modes/.test(prototype) && /No DMs\. No employee scoring\. No outbound actions\./.test(prototype)),
  check("UI exposes evidence and wrong-decision risk", /Authorized evidence/.test(prototype) && /Risk of a wrong decision/.test(prototype)),
  check("UI decision action records, never executes", /Copy & record/.test(prototype) && /never posts, assigns, sends/.test(prototype)),
  check("Ask People Pulse is the single embedded cited chat", /Ask People Pulse/.test(prototype) && /Snapshot chat/.test(prototype) && /\/api\/chat/.test(prototype) && /no provider contact/.test(prototype) && !/Continue in company Claude|Copy prompt for Claude/.test(prototype)),
  check("PRD selects managed Google HTTPS delivery", /Version \| 1\.4/.test(productRequirements) && /Google Cloud Run \+ direct Google Identity-Aware Proxy/.test(productRequirements)),
  check("Security readiness names production blockers", /## Go-live blockers/.test(securityReadiness) && /P0-10/.test(securityReadiness)),
  check("HR-machine plan is browser-shortcut only", /managed browser bookmark\/shortcut/.test(deploymentPlan) && /does not receive\s+application\s+code/u.test(deploymentPlan)),
  check("Implementation contract has no unfinished locally authorized gates", !/^- \[(?: |~)\]/mu.test(auditableContract)),
  check("External blockers name owners and unblock conditions", /- \[b\][\s\S]*?Owner:[\s\S]*?Unblock:/u.test(auditableContract))
];

console.table(checks);
if (checks.some((item) => item.status !== "PASS")) process.exitCode = 1;
else console.log(`People Pulse contract QA passed (${checks.length}/${checks.length}). Provider contacted: no. Outbound artifact: none.`);

function check(name, passed) { return { check: name, status: passed ? "PASS" : "FAIL" }; }

async function readSources(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const contents = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) contents.push(await readSources(path));
    else if (entry.name.endsWith(".ts")) contents.push(await readFile(path, "utf8"));
  }
  return contents.join("\n");
}
