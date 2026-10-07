import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const repositoryRoot = resolve(process.cwd(), "..");
const [dockerfile, terraform, terraformLock, variables, cloudRun, iapIdentity, server, chat, prototype, packageJson, peoplePulseConfig, schemas] = await Promise.all([
  read("deploy/cloud-run/Dockerfile"),
  read("deploy/cloud-run/terraform/main.tf"),
  read("deploy/cloud-run/terraform/.terraform.lock.hcl"),
  read("deploy/cloud-run/terraform/variables.tf"),
  read("slack-app/src/peoplePulse/cloudRun.ts"),
  read("slack-app/src/peoplePulse/googleIapIdentity.ts"),
  read("slack-app/src/peoplePulse/server.ts"),
  read("slack-app/src/peoplePulse/chat.ts"),
  read("prototype/dept-insights-prototype.html"),
  read("slack-app/package.json"),
  read("slack-app/src/peoplePulse/config.ts"),
  read("slack-app/src/peoplePulse/schemas.ts")
]);

const checks = [
  check("Cloud Run direct IAP is enabled", /iap_enabled\s*=\s*true/u.test(terraform)),
  check("IAP access is authoritative to one configured group", /google_iap_web_cloud_run_service_iam_binding/u.test(terraform) && /members\s*=\s*\[var\.iap_access_group\]/u.test(terraform)),
  check("IAP service agent is the only Cloud Run invoker declared", /gcp-sa-iap\.iam\.gserviceaccount\.com/u.test(terraform) && !/allUsers|allAuthenticatedUsers/u.test(terraform)),
  check("Server verifies signed IAP JWT, audience, issuer, and hosted domain", /x-goog-iap-jwt-assertion/u.test(iapIdentity) && /verifySignedJwtWithCertsAsync/u.test(iapIdentity) && /payload\.aud !== this\.expectedAudience/u.test(iapIdentity) && /payload\.hd/u.test(iapIdentity)),
  check("Google authentication verifier is a direct pinned dependency", /"google-auth-library": "10\.9\.0"/u.test(packageJson)),
  check("Cloud startup fails closed outside LIVE data mode", /config\.modes\.data !== "LIVE"/u.test(cloudRun)),
  check("Snapshots and decisions use separate private versioned buckets", (terraform.match(/public_access_prevention\s*=\s*"enforced"/gu) ?? []).length === 2 && (terraform.match(/versioning \{ enabled = true \}/gu) ?? []).length === 2),
  check("Snapshot volume is read-only", /name\s*=\s*"snapshots"[\s\S]*?read_only\s*=\s*true/u.test(terraform)),
  check("Pilot decision store is single writer by instance and concurrency", /max_instance_request_concurrency\s*=\s*1/u.test(terraform) && /max_instance_count\s*=\s*1/u.test(terraform)),
  check("Notifications and writeback stay off", /name\s*=\s*"PP_NOTIFY_MODE"[\s\S]{0,80}?value\s*=\s*"OFF"/u.test(terraform) && /writebackModeSchema = z\.literal\("OFF"\)/u.test(peoplePulseConfig)),
  check("Production release requires immutable image digest", /@sha256:\[a-f0-9\]\{64\}/u.test(variables)),
  check("Terraform Google provider is locked with signed hashes", /version\s*=\s*"7\.45\.0"/u.test(terraformLock) && (terraformLock.match(/"zh:[a-f0-9]{64}"/gu) ?? []).length >= 10),
  check("Container runs as an unprivileged user", /USER node/u.test(dockerfile)),
  check("Container base image is pinned by digest", (dockerfile.match(/FROM node:22\.18\.0-bookworm-slim@sha256:[a-f0-9]{64}/gu) ?? []).length === 2),
  check("Mutations require CSRF marker and same HTTPS forwarded origin", /x-people-pulse-csrf/u.test(server) && /requireForwardedHttps/u.test(server)),
  check("Single-file UI CSP contains hashes and no unsafe-inline", /buildSingleFileContentSecurityPolicy/u.test(server) && !/unsafe-inline/u.test(server) && !/\.style\.|innerHTML|style=/u.test(prototype)),
  check("External evidence is restricted to Slack archive permalinks", /hostname\.endsWith\("\.slack\.com"\)/u.test(prototype) && /Expected an HTTPS Slack archive permalink/u.test(schemas)),
  check("Embedded chat is server-side, structured, cited, and separately rate limited", /\/api\/chat/u.test(server) && /chatRateLimiter/u.test(server) && /record_people_pulse_answer/u.test(chat) && /validateAndResolveCitations/u.test(chat)),
  check("Chat defaults to MOCK and LIVE requires a Secret Manager reference", /chatMode: safeEnum\([^\n]+"MOCK"\)/u.test(peoplePulseConfig) && /name\s*=\s*"PP_CHAT_MODE"[\s\S]{0,80}?value\s*=\s*var\.chat_mode/u.test(terraform) && /google_secret_manager_secret_iam_member/u.test(terraform) && /LIVE chat requires chat_model and anthropic_chat_secret_id/u.test(terraform)),
  check("Web chat has no direct Slack search or write path", !/conversations\.(?:history|replies)|chat\.postMessage/u.test(server + chat) && /source: z\.literal\("validated-snapshot"\)/u.test(chat))
];

console.table(checks);
if (checks.some((item) => item.status !== "PASS")) process.exitCode = 1;
else console.log(`People Pulse deployment static QA passed (${checks.length}/${checks.length}). Infrastructure changed: no. Provider contacted: no.`);

function check(name, passed) { return { check: name, status: passed ? "PASS" : "FAIL" }; }
function read(path) { return readFile(resolve(repositoryRoot, path), "utf8"); }
