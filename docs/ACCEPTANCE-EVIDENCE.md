# People Pulse Release-Package Acceptance Evidence

Evidence date: 2026-08-20. Repository: `C:\dev\hr-moments-assistant`.

Local data/provider modes: `TEST / MOCK Slack / MOCK scheduled AI / MOCK chat /
OFF notify / OFF writeback`. Cloud-container smoke modes: `LIVE data / MOCK
Slack / MOCK scheduled AI / MOCK chat / OFF notify / OFF writeback`. Provider
contacted: **no**.
Cloud infrastructure changed: **no**. HR device changed: **no**.

## Local release gates

| Gate | Result | Evidence |
| --- | --- | --- |
| TypeScript strict build/check | PASS | `npm run check`; no new `any` |
| Full unit/integration/adversarial suite | PASS | 20 files, 84/84 tests |
| Product/safety contract | PASS | 17/17 checks |
| Implementation-contract reconciliation | PASS | 88 tracked: 75 verified, 2 explicitly deferred, 5 externally blocked, 6 superseded/not applicable, 0 unfinished local items |
| Google delivery static controls | PASS | 20/20 checks |
| API/auth/security boundary | PASS | 16/16 checks |
| Real Chromium workflow/state QA | PASS | 25/25 checks; light/dark/mobile screenshots |
| Fixture demo/idempotency | PASS | Four departments, 15 human messages; unchanged artifact/audit on repeat |
| Production dependency audit | PASS | `npm audit --omit=dev --audit-level=high`: 0 vulnerabilities |
| SBOM generation | PASS | `npm sbom --omit=dev --sbom-format=cyclonedx` succeeds |
| Cloud Run container build | PASS | Pinned Node base digest; final local image ID `sha256:02021d2b1fe32ccc74159b3309028482dfb783e2d0aa554b5a9998a119fa3fa7` |
| Container runtime smoke | PASS | Runtime user `node`; health 200; anonymous page/chat 401; safe startup modes including `CHAT MOCK` logged |
| Terraform format/provider validation | PASS | Terraform 1.13.5; locked signed Google provider 7.45.0; backend-free init and validate |
| Root outbound source contract | PASS | No People Pulse outbound/writeback path introduced |

## Product behavior evidence

| Requirement | Result | Evidence |
| --- | --- | --- |
| Mapping proposals default excluded | PASS | 12-case matcher suite plus append-only map schema |
| Unapproved/duplicate/non-public channels rejected before Slack | PASS | Runtime scope and adversarial tests |
| DMs/private/file/write scopes absent | PASS | Separate read-only manifest and contract scan |
| Prompt privacy and injection boundary | PASS | Scheduled and chat serializers test identifiers, names, birthdays, long content, source allowlists, and prohibited questions |
| No raw bodies/PII in durable evidence or logs | PASS | Bounded evidence, safe logger, artifact/audit assertions |
| Signals cite authorized evidence | PASS | Deterministic evidence binding; insufficient evidence is non-actionable |
| Volume alone cannot create a role signal | PASS | Task evidence, four occurrences, three weeks, intervention ladder |
| Snapshot schema and semantic idempotency | PASS | Repeat demo reports `artifactChanged=false`, `auditChanged=false` |
| All-department dashboard and filters | PASS | Desktop/mobile browser gate |
| Single embedded Ask People Pulse workflow | PASS | Browser proves cited snapshot answers, visible MOCK/no-provider status, session-only turns, and no duplicate copy-to-Claude surface |
| Prohibited chat questions fail closed | PASS | DMs/private sources, protected/medical data, direct identifiers, and employee scoring/flight-risk questions are refused locally before provider contact |
| Chat stays within the selected snapshot | PASS | Prompt is built from validated structured evidence; returned evidence IDs are allowlisted; the app exposes no direct Slack-search endpoint |
| LIVE chat is independently gated | PASS locally | Separate `PP_CHAT_MODE`, Secret Manager reference, rate/cost limits, retries, forced tool schema, and safe error state; live provider not exercised |
| Decisions conclude but do not complete/execute | PASS | Record, copy, conflict, history, and reopen tests |
| Strict CSP/security headers | PASS | Hash CSP without `unsafe-inline`; browser has no CSP/console error |
| Evidence navigation allowlist | PASS | Only HTTPS `*.slack.com/archives/` and internal queue routes |
| Google IAP application verifier | PASS locally | Signed-assertion verifier injection tests: valid, missing, invalid, audience, issuer/domain configuration |
| Cloud Run pilot safety configuration | PASS statically/provider schema | Direct IAP, group binding, split private storage, non-root image, one instance/concurrency one |

## PRD §18 production acceptance status

| # | Production acceptance criterion | Status | Remaining proof |
| --- | --- | --- | --- |
| 1 | Exact production image passes CI/security gates | BLOCKED EXTERNAL | Clean commit/push, hosted CI, registry digest, scan/provenance |
| 2 | Anonymous/nonmember/wrong-domain denied; HR group + MFA succeeds | BLOCKED EXTERNAL | Applied IAP/Group/MFA and tenant allow/deny test |
| 3 | App rejects forged/expired/wrong-audience IAP assertions | LOCAL PASS / LIVE PENDING | Real signed IAP assertion and negative staging paths |
| 4 | HR device is managed/encrypted/patched/EDR healthy | BLOCKED EXTERNAL | IT device compliance evidence |
| 5 | Managed shortcut works with no local service/secrets/data | BLOCKED EXTERNAL | Managed bookmark and actual-device inspection |
| 6 | Private split storage and restore | CONFIG VALID / LIVE PENDING | Applied bucket IAM/versioning and restore drill |
| 7 | Modes visible and match change record | LOCAL PASS / LIVE PENDING | Production session and change record |
| 8 | Installed Slack app is read-only and channel allowlisted | LOCAL PASS / LIVE PENDING | Installed scope export and one-department run |
| 9 | Production prompt privacy before live Claude | LOCAL PASS / LIVE PENDING | Live controlled provider receipt/audit |
| 10 | Full dashboard/browser state suite, including embedded chat answer/refusal/error/rate-limit states | LOCAL PASS / LIVE PENDING | Final staging/HR-device rerun and approved LIVE chat UAT |
| 11 | No unresolved high/critical production dependency finding | PASS LOCALLY | Repeat exact-SHA CI scan/audit |
| 12 | Backup/revoke/disable/rollback demonstrated | BLOCKED EXTERNAL | Staging drills |
| 13 | HR/IT/privacy/sponsor sign gates | BLOCKED EXTERNAL | Signed go/no-go record |
| 14 | Evidence states what was not tested | PASS | This document and implementation contract |

## Commands and artifacts

- `npm run qa:people-pulse`: PASS; fixture generation, strict check, all 84
  tests, contract, deployment-static, API, and real browser QA.
- `audit-contract.ps1`: PASS; 88 tracked items, with 75 verified, 2 deferred,
  5 externally blocked, 6 superseded/not applicable, and no not-started or
  in-progress items.
- `npm run qa:people-pulse:contract`: PASS 17/17; provider contacted: no.
- `npm run qa:people-pulse:deployment`: PASS 20/20; infrastructure changed: no.
- `npm run qa:people-pulse:api`: PASS 16/16 across auth, CSP/headers, CSRF,
  global and chat rate limits, body/schema/path boundaries, safe errors,
  embedded chat, and decisions.
- `npm run qa:people-pulse:browser`: PASS 25/25; three screenshots; no normal-
  flow console errors, failed requests, or HTTP 5xx.
- `npm audit --omit=dev --audit-level=high`: PASS, zero vulnerabilities. The
  first container build exposed high-severity transitive `brace-expansion` and
  `undici` advisories; non-breaking lockfile updates cleared both and the image
  was rebuilt cleanly.
- Docker release build: PASS with base
  `node:22.18.0-bookworm-slim@sha256:752ea8a2f758c34002a0461bd9f1cee4f9a3c36d48494586f60ffce1fc708e0e`.
- Docker runtime smoke: `/api/health` 200 with `{"status":"ok"}`; `/` and
  `/api/chat` 401 without a signed IAP assertion; startup logged `chatMode` as
  `MOCK`; the exact temporary container was stopped and removed.
- Terraform isolated validation: PASS using
  `hashicorp/terraform:1.13.5@sha256:6bbb82d575aa7bd4f0a2c6e3a0838ab9590426c08a71d7a2783643f01004d356`
  and locked Google provider 7.45.0; no backend, plan, apply, or cloud API call.
- Fixture snapshot: v3 `people-pulse/insights/2026-08-17.json`, run
  `pp_20260817_d3b009692f53`, semantic hash
  `d3b009692f53c068ed8f9f0cc6e89cbdd80041a4c90a4d6283602196805f191e`.

## Git and external-effect boundary

- Existing repository/branch: `codex/slack-claude-assistant`; base HEAD
  `f3ab3386a7897ca02ee51f9ff698f1eb4e6a3370`; `origin` is configured.
- People Pulse, Cloud Run package, docs, and CI changes remain uncommitted among
  unrelated owner changes.
- No stage, commit, push, pull request, hosted CI run, image push, Terraform
  plan/apply, Cloud Run resource, Google Group, Slack installation, provider
  secret, live Slack read, live Claude call, notification, bound Sheet, or HR
  device was changed.

## Separately unverified / blocked

- Production Google Cloud project, direct IAP, Workspace group/MFA/device
  policy, and final signed-header path.
- IT-owned Terraform plan, policy scan, remote state, apply, bucket IAM, logging,
  monitoring, and alert delivery.
- Snapshot publishing job and durable central decision/auth/config audit sink.
- Live Slack read-only installation, approved one-department map, employee
  notice, and shadow run.
- Live scheduled Anthropic synthesis or embedded-chat output, terms/DPA/
  retention decision, Secret Manager path, rate/cost behavior, and provider
  receipt.
- Future current-Slack enrichment behind Ask People Pulse. The custom service
  needs its own IT-managed read-only connector credentials, approved-channel
  tool allowlist, policy review, and UAT; it does not automatically inherit the
  executive's existing Claude connector session.
- Backup/restore, group revocation, service disablement, Slack/Claude token
  revocation, and previous-revision rollback.
- Managed HR device, bookmark deployment, HR leader UAT, privacy/legal approval,
  and sponsor go-live.
- Hosted CI execution/evidence upload. The workflow is locally parsed/validated
  but is uncommitted and unpushed.

## Adjacent repository check

The root outbound source contract passes. Its separate Apps Script behavior
harness retains the pre-existing dirty-worktree failure `Real MOCK generation
must process an eligible row`. People Pulse did not modify or normalize those
unrelated Apps Script sources, so this is neither People Pulse proof nor a
People Pulse failure.
