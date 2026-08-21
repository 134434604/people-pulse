# People Pulse Operations Runbook

## Proven local path

From `C:\dev\hr-moments-assistant\slack-app`:

```powershell
npm run people-pulse:demo
npm run check
npm test -- --run
npm run qa:people-pulse:contract
npm run qa:people-pulse:deployment
npm run qa:people-pulse:api
npm run qa:people-pulse:browser
npm run people-pulse:serve
```

The local URL is `http://127.0.0.1:3100`. The demo binds only to loopback,
uses a labeled local executive identity, reads fixture JSON, calls no provider,
and writes only the validated snapshot plus a PII-safe local audit record.

## Safe defaults

| Boundary | Missing/invalid default | Demo proof | Live prerequisite |
| --- | --- | --- | --- |
| Data | `TEST` | Four-department fixture | Approved source and identity adapter |
| Slack read | `MOCK` | Fixture transport | Token, read-only manifest, approved channel map |
| AI summary | `MOCK` | Deterministic adapter | Explicit model/key, privacy review, cost budget |
| Embedded chat | `MOCK` | Deterministic cited snapshot answer; zero provider contact | Separate model/key, privacy/retention review, rate and per-question cost limits |
| Notification | `OFF` | No provider path | Separate notification contract and approval |
| Writeback | permanently `OFF` | Contract/source guard | Not supported in v1 |

Do not reuse the anniversary app manifest for People Pulse. The separate
`people-pulse-manifest.example.yml` omits private-channel, DM, file, email, and
write scopes. Installing it remains an external gate.

## Health and evidence

- `GET /api/health` proves only process health and returns `{ "status": "ok" }`.
  Modes remain behind the authenticated `/api/session` boundary.
- The status strip shows snapshot freshness, channels, and processed human
  message count.
- The run audit records modes, counts, model, tokens, estimated cost, output
  hash, status, and error code—never message bodies or employee PII.
- A semantic output hash makes unchanged weekly results idempotent.
- Browser QA stores light, dark, mobile, and JSON evidence under
  `people-pulse/output/playwright/`.
- Hosted QA is defined in `.github/workflows/people-pulse-ci.yml`. It checks out
  the exact triggering SHA, records the separate pull-request head SHA, runs in
  TEST/MOCK/MOCK with notification/writeback OFF and blank provider secrets,
  and retains logs,
  screenshots, fixture artifacts, and `SHA256SUMS` even when a gate fails.
- Validate workflow structure locally with `node
  C:\dev\codex-reusable-system\packages\ci-quality-gate\validate.mjs
  .github\workflows\people-pulse-ci.yml
  slack-app\qa\people-pulse-ci-profile.json` from the repository root.

## Failure response

1. Confirm the exact repo and process serving port 3100.
2. Inspect the first server error; do not loop-restart.
3. Check `/api/health`, `/api/session`, `/api/weeks`, then the requested weekly
   insight route.
4. Never serve an artifact that fails the current Zod schema.
5. Honor Slack `Retry-After`; do not increase concurrency to bypass it.
6. Stop further AI calls when the weekly cost budget is reached.
7. Return 401/403 when identity or the executive role is absent.
8. If any mode is ambiguous, stop at TEST data, MOCK Slack, MOCK AI, MOCK chat,
   and notification/writeback OFF.

## Backup, restore, and rollback

- Back up insights, run audits, and decisions together before schema changes.
- Restore into an isolated staging path and validate snapshots before use.
- Decisions are append-preserved and individually reopenable; never delete
  decision history to reopen work.
- Rollback restores compatible code plus schema/artifacts. It never requires a
  Slack write or employee-data mutation.

## Staged rollout gates

1. TEST/MOCK/MOCK with zero credentials — locally proven.
2. One approved department with live public-channel reads and MOCK AI — Slack
   installation and data approval required.
3. One approved department with live scheduled Claude — privacy/cost approval
   required.
4. Embedded LIVE chat over the validated snapshot — separate provider-secret,
   privacy, no-retention, rate/cost, refusal, and citation proof required.
5. Authenticated staging with OIDC and durable storage — infrastructure gate.
6. Department expansion — review false positives, scope, cost, rate budgets,
   and employee communications.

No stage enables DMs, private channels, employee scoring, autonomous hiring,
notifications, Slack posting, or task-system execution.

Ask People Pulse answers from the selected validated snapshot. MOCK contacts no
provider. LIVE calls Claude only after an explicit question and stores no
question, prompt, answer, or transcript; safe logs retain hashes/counts/modes.
The web service has no Slack-search path. A future current-Slack connector is a
separate IT gate behind the same chat, not a second copy/paste workflow.

## Chosen production topology

The production release is Google Cloud Run with direct IAP, an authoritative
Google Group, signed-IAP assertion verification in the app, a read-only private
snapshot bucket, and a separate private/versioned decision bucket. The pilot is
one instance with request concurrency one; do not lift either constraint before
the decision store migrates to a transactional database.

The HR machine receives only a managed Chrome bookmark or Edge managed
favorite. Never copy Slack/Claude credentials, service-account JSON, snapshots,
decision files, application code, or a Node runtime to the HR endpoint.

See `HR-LEADER-DEPLOYMENT-PLAN.md` for the exact identity, staging, live-provider,
device, UAT, go-live, and emergency-stop gates. See
`SECURITY-IT-READINESS.md` for the P0 production blockers.

## Production emergency stop order

1. Remove the affected user or authoritative group binding from IAP.
2. Stop the collector/summarizer job if data or provider behavior is in doubt.
3. Revoke the Slack or Claude secret when credential scope is in doubt.
4. Route the web service to the last approved immutable image digest.
5. Restore snapshots/decisions only into isolation, validate, then promote.
6. Preserve safe audit/storage-version evidence and follow the privacy incident
   plan; do not broadly delete before the incident owner directs it.
