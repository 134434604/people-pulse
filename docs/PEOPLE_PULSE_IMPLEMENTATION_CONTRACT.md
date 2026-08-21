# People Pulse Enterprise Implementation Contract

## Objective

Build an authenticated, read-only organizational work-intelligence system that
uses explicitly approved Slack team channels and HR source data to surface task
bottlenecks, waiting decisions, cross-department handoff failures, functional
coverage gaps, recurring work, evidence-backed capacity signals, and people
moments. Provide embedded, source-cited Ask People Pulse chat and a durable
human decision record without allowing the dashboard, chat, or scheduled AI
job to execute work.

## Authority and scope

- Requested by the repository owner on 2026-08-20.
- Allowed repository: `C:\dev\hr-moments-assistant`.
- Allowed local mutations: `slack-app/`, `people-pulse/`, project-local QA,
  documentation, fixtures, and package scripts required for People Pulse.
- Preserve all unrelated dirty-worktree changes. Do not touch the Apps Script
  source files for this implementation.
- External or consequential actions requiring a later explicit gate: live Slack
  reads, Slack manifest installation/reinstallation, live Google Sheet changes,
  live Claude calls, infrastructure provisioning, deployment, notifications,
  commits, and pushes.
- Explicitly out of scope for v1: Slack DMs, private channels, personal folders,
  medical or protected-class data, individual sentiment/productivity/loyalty
  scoring, autonomous employee evaluation, autonomous hiring decisions, task
  assignment in another system, and outbound posting or messaging.

## Source specifications

| Source | Role | Authority when sources conflict |
| --- | --- | --- |
| Owner decisions in the 2026-08-20 task | Product intent and boundaries | Highest |
| `people-pulse-PRD.md` v1.4 | Product, enterprise architecture, security, data, and HR-machine delivery contract | Required after reconciliation |
| This contract | Execution order, evidence, gates, and status | Required for implementation claims |
| Existing `slack-app/` source | Compatibility and reusable implementation patterns | Preserve working behavior |
| `OUTBOUND_SAFETY_IMPLEMENTATION_CONTRACT.md` | Side-effect safety philosophy | Required for outbound-adjacent paths |
| Repository `AGENTS.md` | Workspace, QA, and reporting discipline | Required |

## Current baseline

- Stack: Node.js 22, TypeScript strict, Slack Bolt, Google Sheets, Zod, Vitest,
  and direct Anthropic HTTP calls.
- Existing behavior: weekly anniversary preparation, private Slack review cards,
  typed confirmation, and a Google Sheets queue.
- Existing checks: `npm run check`, `npm test`, and root outbound-safety QA.
- People Pulse now contains the v1.4 contract, approved-channel collector,
  evidence and signal engine, privacy-bound AI adapter, weekly artifact
  assembly, executive dashboard, embedded snapshot chat, local auth boundary,
  decision store,
  fixtures, named QA, a staged CI workflow, a signed-Google-IAP production
  identity adapter, a non-root container, and a Cloud Run/IAP/private-storage
  Terraform package. Applying company infrastructure and delivering the real
  HR-device shortcut remain external gates.
- The repository is dirty and `people-pulse/` is untracked. Implementation must
  avoid staging, committing, reverting, or normalizing unrelated files.

## Status legend

- `[ ]` Not started
- `[~]` In progress
- `[x]` Implemented and verified
- `[d]` Deferred intentionally
- `[b]` Blocked
- `[n/a]` Not applicable

## Phase 0 — Specification and repository reconciliation

- [x] Reconcile the owner decisions with the PRD, build prompt, prototype, and
  implementation contract.
- [x] Record explicit exclusions, source precedence, approval gates, and the
  dirty-worktree boundary.
- [x] Define phase-specific verification and named QA commands.

Exit gate:

- [x] The PRD, build prompt, prototype direction, and contract no longer
  contradict one another.

Verification:

- Evidence: v1.4 PRD, revised build prompt, dated decisions, README authority
  map, and contract agree on channel-only work-system intelligence, scheduled
  Claude synthesis, and embedded cited Ask People Pulse chat.
- Commands/artifacts: `rg` consistency check across `people-pulse/docs` and
  `people-pulse/README.md` on 2026-08-20. Planned commands are `npm run check`,
  `npm test`, `npm run people-pulse:demo`, `npm run qa:people-pulse`,
  `npm run qa:people-pulse:api`, `npm run qa:people-pulse:browser`, and
  `npm run qa:people-pulse:contract`.
- Remaining risk: company IAP/MFA/device policy, live-provider, production job,
  central audit, backup/restore, and HR-machine rollout proof remain behind
  their declared gates.

## Phase 1 — Safe foundation and domain contracts

- [x] Add independent People Pulse data, Slack-read, scheduled-AI, embedded-
  chat, notification, and writeback modes with safe defaults.
- [x] Add versioned Zod schemas for channel scope, collection runs, evidence,
  task observations, work signals, capacity signals, decisions, weekly
  snapshots, and audit events.
- [x] Add a zero-credential four-department fixture path.
- [x] Add PII-safe structured logging contracts and run identifiers.

Exit gate:

- [x] TEST/MOCK mode loads and validates complete fixtures without Slack,
  Google, Anthropic, or outbound contact.

Verification: `npm run people-pulse:demo`, schema/unit tests, and contract QA
validate the four-department artifact with TEST/MOCK/MOCK/OFF/OFF modes and no
provider credentials.

## Phase 2 — Approved-channel collection

- [x] Add Department support without overwriting existing employee headers.
- [x] Add `Dept Channel Map` and `Insights Runs` bootstrap support with append-
  missing-header behavior.
- [x] Implement channel-name proposals that always default to `Include=FALSE`.
- [x] Enforce a runtime allowlist before every Slack read.
- [x] Implement pagination, retry, `Retry-After`, cursor checkpoints,
  idempotency, and bot/app exclusion.
- [x] Exclude DMs and private channels in schemas, manifest documentation, code,
  fixtures, and tests.

Exit gate:

- [x] Tests prove unapproved channel IDs never reach the Slack client and the
  complete fixture collection is deterministic.

Verification: channel mapping has 12 convention cases; scope, collector, live-
adapter, pagination, 429, bot exclusion, checkpoint, and 120-channel scale
tests pass. The separate People Pulse manifest contains public-channel read
scopes only. Live installation/read proof is deferred.

## Phase 3 — Task evidence and work-signal engine

- [x] Extract deterministic observations for waiting decisions, unresolved
  threads, explicit ownership, missing ownership, handoffs, recurring tasks,
  due windows, and critical-function concentration.
- [x] Create stable recurrence fingerprints without retaining full message
  bodies.
- [x] Persist only sanitized evidence references, timestamps, hashes, bounded
  summaries, and authorized source links.
- [x] Classify bottlenecks, handoff gaps, ownership gaps, recurring manual work,
  coverage risks, and insufficient-evidence cases.

Exit gate:

- [x] Representative fixtures distinguish operational signals from social
  conversation, bot traffic, duplicates, and temporary spikes.

Verification: deterministic extraction tests ignore a social lunch message and
bot content, deduplicate threaded messages, bind signals to bounded evidence,
and require four occurrences across three weeks before a role hypothesis.

## Phase 4 — Privacy-first Claude adapter and capacity signals

- [x] Write prompt privacy and prompt-injection tests before the live adapter.
- [x] Serialize only sanitized task facts, bounded excerpts, approved channel
  names, aggregate statistics, and pseudonymous participants.
- [x] Force structured output and reject uncited, invalid, or privacy-violating
  model output.
- [x] Provide deterministic MOCK output and token/cost accounting contracts.
- [x] Require longitudinal evidence and an intervention ladder before emitting
  a role hypothesis.

Exit gate:

- [x] Privacy tests, schema validation, evidence binding, capacity-threshold
  tests, retry tests, and MOCK determinism pass.

Verification: `testBuildInsightsPromptPrivacy`, injection framing, forced-tool,
unknown-evidence rejection, 429 retry, temperature, MOCK determinism, token,
cost, and capacity tests pass. No live Anthropic request was made.

## Phase 5 — Weekly assembly, audit, and artifacts

- [x] Join work signals, department coverage, capacity signals, and existing
  people moments into a versioned weekly snapshot.
- [x] Write weekly artifacts idempotently and record a content hash.
- [x] Record run metadata without message bodies or employee PII.
- [x] Keep notifications and writeback off by default.
- [x] Preserve deep links into the existing HR approval flow for people moments.

Exit gate:

- [x] Re-running the same fixture week produces the same validated snapshot
  without duplicate decisions, signals, or audit corruption.

Verification: assembly/idempotency tests write the same validated artifact and
one run record on repeat. The checked-in fixture snapshot carries its semantic
hash and queue deep links.

## Phase 6 — Executive dashboard and embedded investigation

- [x] Build the all-department work-system dashboard: attention, waiting
  decisions, task coverage, recurring work, capacity signals, and people
  moments.
- [x] Add evidence/freshness/mode disclosure and loading, empty, stale, partial,
  permission-denied, and error states.
- [x] Add executive-only Ask People Pulse over the selected week and department
  context with a deterministic zero-provider MOCK path.
- [x] Require snapshot citation validation, missing-evidence handling, local
  DM/private/employee-scoring refusal, session-only history, and explicit
  provider mode/contact status.

Exit gate:

- [x] Named API and browser tests verify the primary desktop/mobile workflows,
  source citations, auth failures, console errors, failed requests, and safe
  embedded-chat answer, refusal, and failure behavior.

Verification: updated API and browser evidence is attached in Phase 12. The
chat route requires the same executive and mutation boundaries as decisions;
MOCK makes no provider request and People Pulse stores no question or answer.

## Phase 7 — Durable executive decision loop

- [x] Require each decision card to state what happened, what decision is
  needed, accepted answers, evidence, and the consequence of a wrong decision.
- [x] Compose a copyable follow-up instruction and record the selected answer.
- [x] Distinguish concluded work from completed work.
- [x] Make closure reversible before batch review.
- [x] Allow staleness reports to propose but never close cards.

Exit gate:

- [x] Browser tests prove answered cards stop asking, conclusions remain
  distinct from completion, and archived decisions restore with history.

Verification: the decision browser/API tests record a declared answer on copy,
move the card to `concluded`, retain the non-execution statement, and reopen it
with its decision history intact. Staleness only changes display state.

## Phase 8 — Enterprise hardening and rollout evidence

- [x] Add named type, unit, integration, contract, build, browser, accessibility,
  security-boundary, load, backup/restore, and rollback checks.
- [x] Add CI that retains exact-SHA evidence artifacts.
- [x] Verify 12 departments x 10 channels under configurable Slack budgets.
- [x] Add operational metrics, cost budgets, health checks, and runbooks.
- [d] Execute the staged rollout only after its external approval gates.

Exit gate:

- [x] Local evidence is complete and live Slack, live Claude, staging,
  production, provider, CI-run, and outbound proof remain separately labeled.
- [d] Execute the CI workflow after an authorized commit/push.

Verification: local type, 75-test, contract, deployment-static, API, browser,
scale, HTTP, dependency, container, Terraform, and artifact checks are
recorded. The CI workflow is implemented but intentionally
not pushed or executed in this uncommitted task.

## Phase 9 — Adversarial QA and GitHub Actions closure

- [x] Reconcile Git repository, branch, remote, dirty-worktree, and exact-SHA
  evidence boundaries.
- [x] Add edge cases for invalid configuration, conflicting channel scope,
  privacy labels/content, rate limits, pagination limits, malformed requests,
  authorization, concurrent decisions, artifact corruption, chat privacy,
  citation, refusal, rate, and provider boundaries.
- [x] Exercise browser loading, empty, stale, partial, permission-denied,
  server-error, decision-conflict, light/dark, desktop, and mobile states.
- [x] Make CI run the real browser gate with safe environment values, pinned
  actions, exact revision checkout, finite timeout, test-owned fixtures,
  always-retained logs/screenshots, and a SHA-256 evidence inventory.
- [x] Validate the workflow with the reusable CI quality-gate profile and run
  the expanded local suite.

Exit gate:

- [x] The expanded local QA evidence is green; the workflow is statically
  validated and ready for an authorized commit/push; hosted CI remains
  separately unverified until that external gate occurs.

Verification: Git 2.54.0 is initialized at the non-synced repository root on
branch `codex/slack-claude-assistant`, with `origin` configured and base HEAD
`f3ab3386a7897ca02ee51f9ff698f1eb4e6a3370`. The People Pulse work remains
deliberately uncommitted alongside unrelated owner changes. `npm run
qa:people-pulse` passes 75/75 tests, 16/16 API tests, 17/17 contract checks,
18/18 deployment-static checks, and 20/20 Chromium checks. The workflow passes
a YAML parse and the shared
`codex-ci-quality-gate/v1` validator. CI installs Playwright 1.62.1 only as a
pinned runner tool without changing the application manifest or lockfile.

## Phase 10 — Managed Google delivery package and HR-machine plan

- [x] Select Cloud Run direct IAP as the primary internal HTTPS delivery path
  because the company can reuse Google Workspace identity, MFA, groups, and
  existing Google data integration without a custom login service.
- [x] Implement and test signed IAP JWT verification for signature, issuer,
  exact Cloud Run audience, subject, Workspace hosted domain, and email domain.
- [x] Protect the HTML shell and all application routes server-side; add a
  minimal health response, same-HTTPS-origin mutation gate, strict hash CSP,
  restrictive security headers, Slack URL allowlist, bounded request rate, and
  server timeouts.
- [x] Add a non-root multi-stage container with a pinned Node base digest and an
  immutable application-image-digest requirement.
- [x] Add Terraform for direct IAP, one authoritative Google Group, dedicated
  service identity, separate private/versioned snapshot and decision buckets,
  health probes, and a one-instance/concurrency-one pilot constraint.
- [x] Publish PRD v1.4, the Security/IT readiness matrix, and the exact HR-device
  staging, UAT, rollback, and managed-bookmark plan.
- [x] Add named deployment-static QA and focused Google IAP/adversarial tests;
  build the release container locally and clear high-severity production npm
  advisories through non-breaking transitive updates.
- [b] Produce an IT-owned target plan/policy scan and apply Terraform in the
  company Google Cloud project. Owner: IT/security. Unblock: approved project,
  region, registry digest, Workspace domain/group, remote state, and production
  change authority. Local format and provider-schema validation already pass.
- [b] Deploy the separate snapshot publishing job, central durable decision/auth
  audit, and live Slack/Claude secret references. Owner: engineering + IT +
  privacy. Unblock: approved Slack app/channel map, employee notice, provider
  terms, secret-manager paths, and staging access.
- [b] Execute staging identity, backup/restore, revocation, rollback, live-
  provider, and managed HR-device UAT. Owner: IT + HR leader. Unblock: deployed
  staging URL, real managed device, named pilot accounts, and signed test window.

Exit gate:

- [x] The repository contains a locally verified enterprise delivery package
  and a complete evidence-driven production plan.
- [b] Production delivery is complete only after company infrastructure,
  identity/device, provider, recovery, privacy, and HR UAT gates pass.

Verification: focused TypeScript/auth/server/adversarial tests pass, deployment
static QA passes, `npm audit --omit=dev` reports zero vulnerabilities after the
lockfile update, Docker successfully builds and smoke-tests
`people-pulse:local-qa` as a non-root image, and Terraform 1.13.5 passes format,
backend-free initialization with locked Google provider 7.45.0, and provider
validation in an isolated container. No cloud resource, Google Group, Slack
installation, live provider, or HR device was changed.

## Phase 11 — Scheduled Claude synthesis and external investigation handoff

Superseded historical decision. The owner replaced this copy-only approach with
the single embedded workflow in Phase 12. These items are retained so the
decision history remains auditable; they are no longer current requirements.

- [n/a] Remove the embedded chat route, chat provider mode, chat response schema,
  and page-level Claude call path.
- [n/a] Keep Claude API use confined to the controlled scheduled per-department
  synthesis job.
- [n/a] Replace dashboard chat with a copy-only investigation handoff for the
  company's existing Claude connected to Slack.
- [n/a] State that the connector uses the executive's own permissions and that
  its DM/private-source exclusion is guidance rather than a People Pulse
  technical enforcement boundary.
- [n/a] Update API, browser, contract, deployment, and artifact evidence for the
  revised boundary.

Exit gate:

- [n/a] The web service has no model or Slack search endpoint, the dashboard does
  not claim embedded chat, and QA proves copying an investigation prompt has no
  network/provider side effect.

Historical verification: at the time this decision applied, TypeScript strict
check, 75/75 tests, 16/16 API tests, 18/18 deployment-static checks, and 20/20
real Chromium checks passed. The current Phase 12 evidence supersedes that
behavior. The v3 fixture remains deterministic at
`d3b009692f53c068ed8f9f0cc6e89cbdd80041a4c90a4d6283602196805f191e`.
No connector, Slack provider, Claude provider, cloud resource, or managed
device was changed locally.

## Phase 12 — Embedded Ask People Pulse

- [x] Restore a primary embedded Ask People Pulse workflow for unscheduled
  executive questions about the selected validated snapshot.
- [x] Add a privacy-filtered, source-cited, structured chat provider with a
  deterministic MOCK default and an explicitly gated LIVE Claude API mode.
- [x] Remove the permanent copy-to-Claude handoff from the dashboard so the HR
  leader has one clear conversational workflow.
- [x] Keep current Slack enrichment behind the same chat as a future
  IT-managed connector capability; do not imply that an existing personal
  Claude connector is automatically inherited by the web application.
- [x] Update schemas, API and browser behavior, deployment controls, PRD,
  security documentation, and release evidence for the revised boundary.

Exit gate:

- [x] The dashboard provides a usable embedded snapshot chat with citations,
  refusal and failure states; MOCK mode contacts no provider; no chat history
  or raw question/answer is durably stored; the copy-to-Claude workflow is
  absent; and named QA passes.

Verification: strict TypeScript, 84/84 unit/integration/adversarial tests,
16/16 API tests, 17/17 product-contract checks, 20/20 deployment-static checks,
and 25/25 real Chromium workflow checks pass. Browser evidence covers cited
MOCK answers, zero provider contact, local refusal, session-only history,
provider failure, light/dark/mobile layouts, and absence of a second copy-to-
Claude workflow. The release container runs as `node`, exposes health at 200,
denies anonymous page and chat requests at 401, and logs `CHAT MOCK`. Terraform
format and isolated provider validation pass. No live Claude, Slack, cloud, or
device action occurred.

## Deviations

| Date | Requirement | Difference | Reason | Approved/derived from |
| --- | --- | --- | --- | --- |
| 2026-08-20 | v1 chip/KPI-first dashboard | All-department task and coverage workspace | Executive needs cross-department bottleneck and role visibility | Owner clarification |
| 2026-08-20 | No live AI at page view | Historical: authenticated executive chat was added, then superseded by Phase 11 | Owner initially wanted Ask People Pulse, then chose the existing Claude-Slack connection | Owner clarifications |
| 2026-08-20 | Engagement emphasis | Task/handoff/coverage evidence is primary | Product is work-system intelligence, not personal productivity analysis | Owner clarification |
| 2026-08-20 | Potential DM analysis | Exclude DMs from v1 | Basic Slack plan and broad channel use make mapped channels the highest-value first boundary | Owner clarification |
| 2026-08-20 | Static single-file product | Preserve static snapshot as fallback; allow a local authenticated service for decisions | Durable decisions require server state | Architectural consequence |
| 2026-08-20 | Production identity not chosen | Use Cloud Run direct Google IAP as primary; retain Entra as an alternative only | Existing Workspace identity and Google data integration remove a custom login/load-balancer step | Owner asked whether Google auth can save steps |
| 2026-08-20 | Local HR-machine installation | Deliver an IT-managed HTTPS bookmark only | Keeps secrets, runtimes, durable data, and support burden off the executive endpoint | Owner direction |
| 2026-08-20 | Embedded Ask People Pulse chat | Use the existing company Claude-Slack connection for ad-hoc investigation; reserve the API for scheduled synthesis | Avoids duplicating Claude while preserving deterministic, auditable dashboard generation | Owner clarification |
| 2026-08-20 | Copy-only Claude-Slack investigation handoff | Restore one embedded Ask People Pulse chat; use the selected snapshot in v1 and keep any future current-Slack connector behind that same surface | The owner found copy/paste clunky when a connected conversational experience is expected | Latest owner clarification; supersedes Phase 11 |

## Deferred

| Item | Reason | Consequence | Needed later |
| --- | --- | --- | --- |
| Live Slack reads | External data access gate | Live adapter is locally tested; provider data was not read | Explicit approval and installed read-only app |
| Live Claude calls | Provider/cost gate | Structured MOCK path can be proven; provider behavior cannot | Explicit approval and secret |
| Multi-instance transactional decision database | Not needed for the constrained first pilot | Pilot is one instance/concurrency one with versioned object storage | Required before concurrency or broader executive access |
| DMs/private channels | Explicit v1 exclusion | Insights use mapped public team channels only | New owner decision, plan capability, policy review |
| Current Slack and additional computer connectors | Channel-first pilot is the priority | Chat is initially limited to the validated People Pulse snapshot | Pilot evidence, separate connector contract, and IT-provisioned application credentials/tool allowlist |
| Production deployment/notifications | External effect gate | No live users or notifications; Cloud Run package is not applied | IT change authority after staging evidence; notifications remain out of v1 |
| CI execution | Commit/push is outside the granted local scope | Workflow syntax exists but no hosted exact-SHA run is claimed | Authorized commit/push or separate CI run |

## Blocked

Production delivery is blocked on the three external Phase 10 gates: an
IT-owned Google Cloud/Workspace environment, approved live provider/data/privacy
configuration and job/audit deployment, and real staging/HR-device UAT. The
repository cannot prove or perform these tenant/device actions without the
named owners and access. Repository-wide Apps Script behavior QA also currently
fails on an unrelated dirty-worktree MOCK-generation assertion; People Pulse
did not modify or normalize those Apps Script files.

## Final acceptance

- [x] No required local item remains not started or in progress.
- [x] Every verified item has current evidence.
- [x] Deferred and blocked items state their consequence and unblock condition.
- [x] No unapproved source or outbound path is reachable.
- [x] Required local API, browser, privacy, idempotency, and decision-loop gates
  pass.
- [x] The contract audit passes and final reporting separates local proof from
  live-provider and production proof.
- [b] The HR leader has not yet received or accepted a production managed
  shortcut; do not describe People Pulse as production-deployed until Phase 10
  external gates and the PRD acceptance criteria pass.
