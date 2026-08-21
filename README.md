# People Pulse

People Pulse is an executive work-system intelligence layer for the existing HR
Moments Slack service. It uses explicitly approved public team channels and HR
source data to surface task bottlenecks, waiting decisions, cross-department
handoff gaps, functional coverage gaps, recurring work, evidence-backed
capacity signals, and people moments.

It does not read DMs or private channels in v1 and does not score individual
productivity, sentiment, loyalty, performance, or likelihood of leaving.

## Authoritative documents

- `docs/PEOPLE_PULSE_IMPLEMENTATION_CONTRACT.md` — phase status, gates, evidence,
  deviations, deferrals, and final acceptance.
- `docs/people-pulse-PRD.md` — v1.4 product, architecture, security, data,
  privacy, UX, and HR-machine delivery contract.
- `docs/SECURITY-IT-READINESS.md` — implemented controls, P0 production
  blockers, threat model, and IT evidence checklist.
- `docs/HR-LEADER-DEPLOYMENT-PLAN.md` — Cloud Run/IAP staging, live-provider,
  recovery, managed-bookmark, UAT, and rollback procedure.
- `docs/DECISIONS.md` — owner decisions that changed the original direction.
- `docs/people-pulse-BUILD-PROMPT.md` — execution handoff for a coding session.

`prototype/dept-insights-prototype.html` is now the v1.4 all-department task,
coverage, capacity, people-moment, embedded Ask People Pulse, and decision
workspace.

## Chosen production delivery

People Pulse is packaged for Google Cloud Run with direct Identity-Aware Proxy
(IAP). An authoritative Google Group controls access; the application verifies
the signed IAP assertion, exact Cloud Run audience, issuer, subject, and
Workspace domain. The HR leader receives only an IT-managed HTTPS bookmark in a
managed browser—no local service, secrets, provider keys, database, or weekly
data folder.

The container and Terraform package are under `deploy/cloud-run/`. They are
locally verified artifacts, not evidence that company infrastructure, live
providers, or an HR device has been changed.

## Safe local target

The required demo path is `TEST/MOCK/MOCK`. It must render complete four-
department fixtures with zero provider credentials and no Slack, Google,
Anthropic, notification, or outbound contact.

## Implemented local demo

The zero-credential enterprise demo now includes approved-channel collection,
deterministic task signals, privacy-bound MOCK AI, idempotent weekly artifacts,
the executive dashboard, session-only cited Ask People Pulse chat, and
reversible decisions. The Claude API is used only for scheduled synthesis and
explicit chat submissions; passive page views never call a provider. Current
Slack search remains outside the locally implemented web chat.

From `slack-app/`, run `npm run people-pulse:demo`, then
`npm run people-pulse:serve` and open `http://127.0.0.1:3100`.

Proof commands are `npm run check`, `npm test -- --run`,
`npm run qa:people-pulse:contract`, `npm run qa:people-pulse:deployment`,
`npm run qa:people-pulse:api`, and `npm run qa:people-pulse:browser`. See
`docs/OPERATIONS-RUNBOOK.md` for modes, evidence, rollback, and staged rollout
gates.
