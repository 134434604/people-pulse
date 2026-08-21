# Product Requirements Document — People Pulse

| Field | Value |
| --- | --- |
| Version | 1.4 |
| Date | 2026-08-20 |
| Product owner | Executive sponsor / HR leader |
| Technical owner | Company IT or designated internal application owner |
| Privacy owner | HR with legal/privacy review |
| Chosen delivery | Google Cloud Run + direct Google Identity-Aware Proxy (IAP) |
| User delivery | IT-managed HTTPS shortcut in the HR leader's managed browser |
| Current status | Local release package verified; company cloud, identity policy, live data, and HR-device rollout not yet executed |

This document is authoritative for People Pulse product scope. Owner decisions
recorded in `DECISIONS.md` take precedence. The implementation status and proof
boundary are maintained in `PEOPLE_PULSE_IMPLEMENTATION_CONTRACT.md`.

## 1. Executive summary

People Pulse is an internal work-system intelligence application for an HR
leader and authorized executive sponsor. It turns evidence from explicitly
approved public Slack team channels, HR source data, and weekly milestones into
a cited view of:

- work waiting on a decision;
- unclear ownership and coverage;
- cross-department handoff failures;
- recurring work without a durable process;
- repeated task demand that may justify process, tooling, temporary capacity,
  or a future role hypothesis; and
- anniversaries, onboarding marks, and other existing people moments.

The product is not employee surveillance or performance scoring. It does not
read Slack DMs, multi-party DMs, private channels, personal folders, medical
information, or protected-class data. It does not infer employee sentiment,
loyalty, attitude, productivity, performance, or likelihood of leaving.

The production application is centrally hosted. No Slack token, Claude key,
Google credential file, durable snapshot, or decision database is placed on the
HR leader's computer. The machine receives only a managed browser shortcut to
an HTTPS address protected by the company's existing Google Workspace account,
MFA policy, authorized Google Group, and—where licensed—device-aware access.

## 2. Problem and desired outcome

An HR leader in a growing ecommerce supplement company must understand daily
organizational friction across operations, customer support, marketing, sales,
finance, supply chain, product, and engineering without becoming a technical
operator or reading every channel.

Today, the relevant evidence is fragmented across team conversations, HR
records, and informal follow-up. Problems often become visible only after a
deadline slips, a cross-functional handoff fails, one person becomes the only
holder of a recurring process, or a department asks for headcount without a
task-based record.

People Pulse should shorten the path from cited operational evidence to a
clear human decision. It should help the executive decide where to clarify
ownership, improve a process, automate, rebalance work, add temporary capacity,
or explore a role—without manufacturing judgments about individual employees.

### 2.1 Ninety-day pilot outcomes

The pilot succeeds when all of the following are true:

1. At least four departments have an approved channel map with a named approver
   and review date.
2. At least 90% of displayed work-system signals link to one or more authorized
   evidence references; missing evidence is visibly labeled and cannot support
   a capacity or employment action.
3. The HR leader completes a weekly review without technical assistance after
   onboarding and can explain observation, interpretation, uncertainty, and
   next decision for a sample signal.
4. At least 70% of sampled signals are rated useful or directionally useful;
   fewer than 15% are rated misleading or out of scope.
5. Decisions recorded in People Pulse remain distinct from work completion and
   can be reopened with history preserved.
6. No DM, private-channel, prohibited employee-scoring, secret, or unbounded
   message-body data appears in a snapshot, log, scheduled AI prompt,
   embedded-chat prompt/response, or QA artifact.
7. IT can identify the exact deployed image digest, authorized Google Group,
   effective modes, snapshot source, last backup evidence, and rollback target.

## 3. Users and day-to-day jobs

| User | Primary job | Access |
| --- | --- | --- |
| HR leader | Review cross-department friction, people moments, coverage, and capacity evidence; record decisions | Executive workspace |
| Executive sponsor | Review high-impact organizational constraints and answer escalated decisions | Executive workspace if added to the same authorized group |
| Department leader | Supply context or receive a follow-up outside People Pulse | No v1 application access by default |
| IT administrator | Deploy, patch, monitor, back up, revoke access, and roll back | Cloud and identity administration; no routine HR content access |
| Security/privacy reviewer | Review controls, audit evidence, retention, and incidents | Evidence package; content access only when explicitly authorized |

### 3.1 Weekly HR review

The HR leader opens the managed shortcut, authenticates with Google Workspace,
confirms the visible data/provider modes and freshness, then reviews:

1. needs-attention signals across all departments;
2. unanswered executive decisions;
3. department task coverage and evidence sufficiency;
4. multi-week recurring work and capacity patterns;
5. people moments already present in the HR review queue; and
6. unscheduled questions in Ask People Pulse, with the selected snapshot,
   evidence citations, limitations, and provider mode visible.

The leader may record one of the declared answers on a decision card and copy a
bounded follow-up instruction. People Pulse records the answer; it never sends,
posts, assigns, hires, disciplines, terminates, or marks the underlying work
complete.

### 3.2 In-week situational review

When a handoff or staffing question arises, the HR leader asks People Pulse
inside the dashboard. The chat answers from the selected validated snapshot,
cites only evidence already authorized in that snapshot, states limitations,
and visibly identifies whether the provider was contacted. A question is an
explicit action; no model call occurs merely because the page loads.

The chat does not retain conversation history after the page session and does
not send raw Slack history, employee identifiers, people-moment names, DMs,
private conversations, medical or protected data, or unrestricted message
bodies to Claude. Prohibited employee-scoring and private-source questions are
refused locally before provider contact.

Current Slack enrichment may later be added behind the same Ask People Pulse
surface through an IT-managed, read-only connector. It is not a second chat and
must not assume that an executive's existing Claude connector authorization is
automatically inherited by this application.

There is no daily leadership brief in v1 and no automatic daily push. The
workspace can show a freshly generated snapshot when one exists, but it does
not create a new notification channel.

### 3.3 Monthly capacity review

The HR leader reviews task areas that meet the longitudinal evidence threshold.
Every capacity card must walk the intervention ladder in order:

1. Clarify ownership.
2. Improve the process or SOP.
3. Automate or add tooling.
4. Rebalance responsibilities.
5. Add temporary capacity.
6. Explore a role hypothesis.

Activity volume alone never produces a hiring recommendation.

## 4. Product principles

1. Task and work-system evidence before employee judgment.
2. Observation, interpretation, uncertainty, and decision remain visibly
   separate.
3. The executive decides; the application does not execute.
4. Every meaningful claim is cited or marked as insufficient evidence.
5. Approved channels are an allowlist, not a discovery suggestion.
6. Missing or invalid configuration fails to TEST/MOCK/OFF or refuses startup.
7. Identity, device, data, generation, notification, and writeback boundaries
   are independently visible and auditable.
8. Raw Slack text is transient; durable artifacts are bounded and sanitized.
9. A quiet channel is not evidence that a department is healthy or unhealthy.
10. Production proof is never inferred from mocks, local compilation, or an
    unexecuted infrastructure template.
11. Claude API use is limited to scheduled synthesis and explicit Ask People
    Pulse submissions; passive page views never call a model.

## 5. Scope

### 5.1 Included in v1

- Explicitly approved public Slack team channels.
- Department-to-channel mapping with human approval.
- Eight-week message-count context, unique participants, and participation as
  context—not as performance scores.
- Needs-attention threads with at least three replies and more than 48 hours of
  silence, excluding bot, app, and system messages.
- Deterministic extraction of waiting decisions, ownership gaps, handoff gaps,
  recurring work, and coverage risks.
- One privacy-bound AI summary call per department when AI mode is LIVE.
- Validated weekly JSON snapshots and PII-safe run audit metadata.
- All-department dashboard, department filters, evidence inspector, people
  moments, capacity ladder, embedded cited Ask People Pulse chat, and reversible
  executive decisions.
- Google Workspace SSO through direct Cloud Run IAP.
- An IT-owned container release and reproducible infrastructure configuration.

### 5.2 Explicit exclusions

- Slack DMs, group DMs, private channels, canvases, files, and personal folders.
- Medical, disability, protected-class, benefits-case, investigation, or leave
  data.
- Individual sentiment, engagement, loyalty, attitude, productivity,
  performance, attrition, misconduct, or promotion scoring.
- Keystroke, screen, browser-history, location, or personal-device monitoring.
- Autonomous employment recommendations or actions.
- Slack posts, email sends, task creation, applicant actions, payroll changes,
  or other outbound/writeback actions.
- A general-purpose search engine over Slack.
- Passive page-view model calls or unrestricted general-purpose chat.
- A daily leadership brief or automatic daily push.
- Department-leader self-service access in the first pilot.

## 6. Chosen enterprise architecture

### 6.1 User path

```text
Managed HR browser shortcut
        |
        v
Google Workspace sign-in + MFA + authorized Google Group
        |
        v
Cloud Run direct IAP (HTTPS; unauthenticated access denied)
        |
        v
People Pulse Node.js service
   |                     |
   v                     v
Read-only weekly       Single-writer decision
snapshot bucket        bucket with version history
```

The application verifies the signed `X-Goog-IAP-JWT-Assertion` on every request,
including its ES256 signature, issuer, exact Cloud Run audience, subject,
Workspace hosted domain, and email-domain boundary. Plain identity headers are
not trusted.

### 6.2 Data-generation path

The collector/summarizer is a separate controlled job path:

```text
Approved channel map + HR source data
        |
        v
Slack read-only collector -> deterministic signals -> privacy serializer
        |                                           |
        |                                           v
        |                                 Claude only when AI=LIVE
        v
Validated weekly snapshot -> immutable/versioned snapshot bucket
```

The web service does not need Slack or Claude credentials to render an approved
snapshot. Provider credentials belong in the job runtime's secret manager and
are never installed on the HR machine.

### 6.3 Embedded investigation path

```text
Executive submits an Ask People Pulse question
        |
        v
Server applies question policy + privacy serializer
        |
        v
MOCK answer or explicitly gated Claude API call
        |
        v
Structured answer -> allowed snapshot evidence IDs -> Slack archive citations
```

The selected weekly snapshot is the authoritative source for v1 chat. The
browser holds session turns only in memory; the server does not durably store
questions or answers. Logs contain the question hash, actor hash, run ID,
department, status, provider-contact flag, citation count, model, tokens, and
cost—not prompt or answer text. A future Slack connector enrichment must use
IT-managed authorization and a read-only tool allowlist behind this same route.

### 6.4 Pilot persistence constraint

The current decision store is an append-preserved JSON record protected by an
in-process operation queue. The Cloud Run pilot therefore runs exactly one
instance with request concurrency one and stores decisions in a private,
versioned bucket. Multi-instance scale requires migration to a transactional
database before the constraint is lifted.

### 6.5 Alternative identity platform

If company IT is Microsoft-first rather than Google Workspace-first, Azure App
Service Easy Auth + Entra Conditional Access is the approved alternative. It is
not implemented in parallel because maintaining two production identity paths
would add risk without pilot value.

## 7. Modes and safe defaults

| Boundary | Values | Missing/invalid default | Production rule |
| --- | --- | --- | --- |
| Data | `TEST`, `LIVE` | `TEST` | Cloud service refuses startup unless `LIVE` |
| Slack read | `MOCK`, `LIVE` | `MOCK` | `LIVE` only after read-only app and channel approval |
| AI summary | `MOCK`, `LIVE` | `MOCK` | `LIVE` only after privacy, cost, and provider approval |
| Embedded chat | `MOCK`, `LIVE` | `MOCK` | `LIVE` only after separate privacy, cost, secret, and rate-limit approval |
| Notification | `OFF`, `CAPTURE`, `LIVE` | `OFF` | Production web template pins `OFF`; no v1 use |
| Writeback | `OFF` only | `OFF` | Cannot be enabled in v1 |

Every snapshot and application session shows the effective modes. A production
identity boundary does not convert MOCK provider evidence into live-provider
proof.

## 8. Source data and configuration

### 8.1 Employees sheet

The existing Employees reader supports `Department` without changing or
reordering existing headers. Missing headers are appended only.

### 8.2 Department channel map

Required fields:

- Department
- Slack Channel ID
- Slack Channel Name
- Conversation Type (`public_channel` only)
- Mapping Source (`auto-convention` or `manual`)
- Include (`FALSE` by default for proposals)
- Approved By
- Approved Date

An auto-mapping proposer may match department naming conventions but may only
write excluded proposals. A human must explicitly approve and include each
channel. Duplicate included channel IDs are rejected before any Slack call.

### 8.3 Insights Runs

Each run records run ID, week, timestamps, modes, department/channel/message
counts, model identifier, token counts, estimated cost, output hash, status,
and bounded error code. It must not contain message bodies, employee email,
employee ID, Slack user ID, author name, or secrets.

## 9. Functional requirements

| ID | Priority | Requirement |
| --- | --- | --- |
| FR-001 | P0 | Group active employees by department while preserving existing sheet compatibility. |
| FR-002 | P0 | Propose channel mappings by naming convention with `Include=FALSE`; require explicit approval before collection. |
| FR-003 | P0 | Read only approved public channels with cursor pagination, a one-request-per-second budget, bounded retries, and Slack `Retry-After` handling. |
| FR-004 | P0 | Exclude bot, app, system, duplicate, out-of-window, and future messages. |
| FR-005 | P0 | Compute eight-week counts, unique participants, contextual participation, and needs-attention threads deterministically. |
| FR-006 | P0 | Persist only bounded sanitized evidence, timestamps, hashes, recurrence keys, and authorized Slack archive permalinks. |
| FR-007 | P0 | Produce task signals only from declared observation types and cited evidence; treat missing evidence as a limitation. |
| FR-008 | P0 | Serialize the AI prompt as a pure privacy-bound function and reject prohibited identity/content leakage before provider contact. |
| FR-009 | P0 | Force structured per-department AI output, validate it, retry within budget, and support deterministic MOCK output. |
| FR-010 | P0 | Assemble collector, AI, capacity, and people-moment data into a Zod-validated weekly snapshot with a semantic hash. |
| FR-011 | P0 | Write snapshots idempotently and retain run evidence separately from message content. |
| FR-012 | P0 | Render an all-department workspace from the selected snapshot with visible freshness, partial/stale state, and modes. |
| FR-013 | P0 | Show observation, interpretation, suggested action, wrong-decision risk, accepted answers, and authorized evidence in the inspector. |
| FR-014 | P0 | Restrict external links to HTTPS Slack archive permalinks and internal queue links to declared `/queue/<id>` routes. |
| FR-015 | P0 | Answer explicit unscheduled Ask People Pulse questions from the selected validated snapshot with structured output, allowed evidence citations, limitations, visible provider mode/contact status, and no durable conversation history. |
| FR-016 | P0 | Record declared executive answers, compose a non-executing follow-up instruction, distinguish conclusion from completion, and support reopening. |
| FR-017 | P0 | Require a verified executive identity for the HTML shell and every data/action route; expose only a minimal unauthenticated health response. |
| FR-018 | P0 | Provide loading, empty, stale, partial, auth-denied, server-error, and decision-conflict states on desktop and mobile. |
| FR-019 | P1 | Let an auditor export a control/evidence package without exporting message bodies or unrestricted HR data. |
| FR-020 | P1 | Capture HR usefulness, false-positive, and missing-evidence feedback without turning the result into employee scoring. |
| FR-021 | P1 | Permit current approved-channel enrichment behind the same chat only through a separately approved IT-managed read-only connector; do not expose a second copy/paste workflow. |

## 10. Evidence and signal contract

### 10.1 Durable evidence

Each evidence record contains a deterministic ID, department, approved channel
ID/name, message/thread timestamp, HTTPS Slack archive permalink, bounded
summary, content hash, and observation timestamp. Bounded summaries are at most
80 characters in the provider privacy path.

### 10.2 Signal types

- waiting decision;
- ownership gap;
- handoff gap;
- recurring work;
- coverage risk;
- people moment; and
- insufficient evidence.

`insufficient-evidence` is the only signal type allowed without an evidence
reference. It cannot support capacity or employment action.

### 10.3 Capacity threshold

A capacity signal requires repeated task observations across at least three
weeks and at least four occurrences by default, cited evidence, task-area
consistency, operational impact, a temporary-spike assessment, and the full
intervention ladder. Thresholds are configurable only within bounded values.

## 11. Scheduled AI and embedded-chat privacy contract

The prompt serializer must not contain employee email, employee ID, Slack user
ID, author name, birthday, protected data, or a message body/excerpt over 80
characters. It receives department aggregates and bounded task facts, not raw
channel history.

The AI adapter performs one call per department, uses forced structured output,
temperature 0.3, bounded retries, token/cost logging, and a weekly cost budget.
Provider logs contain counts, run IDs, hashes, model IDs, tokens, cost, and error
codes—not prompt text or message content.

Ask People Pulse accepts a single bounded question, department scope, and week.
Before provider contact it rejects DMs/private sources, medical/protected data,
known employee identifiers or people-moment names, and individual sentiment,
loyalty, productivity, performance, attitude, health, or attrition scoring. Its
pure serializer contains only the question, department aggregates, task and
capacity facts, bounded evidence summaries, and evidence IDs from the selected
validated snapshot.

MOCK is the default and makes zero provider requests. LIVE uses forced
structured output, temperature 0.2, bounded retries, a per-question cost limit,
per-executive rate limiting, and server-held secrets. Returned evidence IDs are
validated against the selected week and department before authorized Slack
archive citations are rendered. The browser keeps the visible turns only in
memory; no question, prompt, answer, or chat transcript is durably stored.

Current Slack search is not part of the locally implemented v1 chat. A future
MCP or equivalent connector must be explicitly provisioned for the application,
limited to approved read-only tools and channels, and verified separately; an
existing user's Claude connector does not automatically confer API access.

## 12. Dashboard and interaction requirements

- Preserve the approved compact operational layout, palette variables,
  light/dark behavior, and single-axis chart design.
- Default to all departments and use department filters as progressive
  disclosure.
- Show effective modes and exclusions persistently.
- Make freshness, incomplete coverage, partial runs, and insufficient evidence
  visually prominent.
- Never label simulated/captured work as sent, posted, delivered, or completed.
- Use a strict hash-based Content Security Policy; no external CDN, inline event
  attributes, dynamic HTML injection, or unrestricted navigation URLs.
- Keep the dashboard a single static HTML file loaded by the authenticated
  server; no frontend framework or build step.
- Support current managed Chrome/Edge desktop and a 390-pixel mobile viewport.

## 13. Security and IT requirements

The detailed control/evidence matrix is in `SECURITY-IT-READINESS.md`.

| ID | Priority | Requirement |
| --- | --- | --- |
| SEC-001 | P0 | Google IAP must deny anonymous access and grant access only to an authoritative HR/executive Google Group. |
| SEC-002 | P0 | Workspace MFA must be enforced; phishing-resistant MFA is preferred for privileged users. |
| SEC-003 | P0 | The application must validate the signed IAP JWT, exact audience, issuer, expiry, subject, and Workspace domain on every request. |
| SEC-004 | P0 | Cloud Run HTTPS is the only user endpoint; mutation requests require the application CSRF marker and same forwarded HTTPS origin. |
| SEC-005 | P0 | Server-side executive authorization protects the HTML shell, data, and decisions; the client is never the enforcement point. |
| SEC-006 | P0 | The Slack manifest uses least privilege and contains no DM, private-channel, file, email, or write scopes. |
| SEC-007 | P0 | Secrets reside in an IT-owned secret manager/runtime identity and never in source, images, logs, browser storage, or the HR machine. |
| SEC-008 | P0 | Snapshots and decisions use separate private buckets with public access prevention, uniform access, versioning, soft delete, and least-privilege service identity. |
| SEC-009 | P0 | Strict CSP, security headers, bounded bodies, Zod validation, URL allowlists, safe errors, timeouts, and per-principal rate limits protect the HTTP boundary. |
| SEC-010 | P0 | Release images and production deployments use immutable SHA-256 digests; dependencies and base image are pinned and scanned. |
| SEC-011 | P0 | Central logs and audit events contain no message bodies or employee PII and are retained according to the approved policy. |
| SEC-012 | P0 | IT must prove backup/restore, access revocation, service disablement, token revocation, and previous-revision rollback before HR go-live. |
| SEC-013 | P0 | The HR machine must be company managed, encrypted, patched, EDR-protected, screen-locking, and used through a non-shared OS/browser account. |
| SEC-014 | P0 | Employee transparency, acceptable-use, privacy, records-retention, and legal review must be complete before live channel collection. |
| SEC-015 | P1 | Context-Aware Access should require a compliant managed device when the Workspace edition supports it. |
| SEC-016 | P1 | A transactional decision store is required before multi-instance or multi-executive concurrent use. |

## 14. Data lifecycle and retention

These are recommended pilot defaults pending HR/legal/IT approval:

| Data | Default retention | Rule |
| --- | --- | --- |
| Raw Slack message text | No durable retention | Process in memory; discard after bounded extraction |
| Sanitized weekly snapshots | 120 days | Versioned; delete under approved lifecycle unless legal hold applies |
| Decision record | 365 days after last active use | Append-preserved with object version history; no silent deletion |
| Run and security audit metadata | 365 days | PII-safe and centrally searchable |
| Embedded chat question/answer | No durable application retention | Browser-session memory only; logs retain hashes/counts/modes, never prompt or answer text |
| QA fixture/output | 30 days in CI | Synthetic/test-only; exact-SHA evidence |
| Cloud logs | 90 days searchable, archive per policy | No bodies, prompts, emails, names, tokens, or secrets |

Retention changes require an owner, reason, effective date, deletion proof, and
legal-hold treatment. Backups must not silently outlive the approved policy.

## 15. Nonfunctional requirements

| Area | Pilot requirement |
| --- | --- |
| Availability | Proposed 99.5% monthly during agreed HR business hours; not a 24/7 safety-critical system |
| Performance | First authenticated dashboard content within 3 seconds at p95 for a normal weekly snapshot; API responses within 2 seconds at p95 excluding provider jobs |
| Recovery point | 24 hours for snapshots; every accepted decision flushes to versioned storage before success is returned |
| Recovery time | 4 business hours for the pilot |
| Scale | 12 departments × 10 channels collector budget; one concurrent web request and one web instance until database migration |
| Accessibility | Keyboard operation, visible focus, semantic headings, reduced-motion support, and WCAG 2.1 AA contrast target |
| Browser | Current managed Chrome or Edge; no browser extensions required |
| Observability | Health/liveness, structured safe logs, mode/startup event, auth rejection count, rate-limit count, run status, cost, and rollback evidence |
| Maintainability | TypeScript strict; no `any` in new code; named checks; small release changes; exact image/SHA evidence |

## 16. HR-machine delivery requirements

The HR leader's machine receives:

1. an IT-managed browser shortcut named **People Pulse** pointing to the Cloud
   Run HTTPS URL or approved custom domain;
2. Google Workspace sign-in governed by company MFA and session policy;
3. access only while the user is a member of the authoritative Google Group;
4. a visible verified-identity label, current snapshot freshness, effective
   modes, version/support details, and product exclusions;
5. no local service, token, credential file, database, provider key, scheduled
   task, or manually maintained data folder; and
6. an IT support path and a tested revoke/rollback procedure.

Downloads and unrestricted data export remain disabled in v1. The copy action
copies only the bounded follow-up instruction already visible in the decision
flow; the leader remains responsible for where it is pasted.

## 17. Rollout gates

| Gate | Environment | Required evidence | Owner |
| --- | --- | --- | --- |
| G0 | Local TEST/MOCK/MOCK | Type, unit, contract, API, browser, privacy, deployment-static, dependency, and container-build proof | Engineering |
| G1 | IT foundation | Dedicated project, state backend, region, service identities, Google Group, MFA policy, buckets, logging, and change record | IT/security |
| G2 | Authenticated staging | IAP enabled, anonymous/user/group allow/deny tests, signed-claim app verification, immutable image digest, strict headers, backup/restore, rollback | IT + engineering |
| G3 | One-department shadow | Live read-only public-channel collection with MOCK AI; channel approval and employee notice complete | HR/privacy + IT |
| G4 | One-department AI pilot | Live Claude privacy/cost proof with prompt leak tests and provider terms approved | HR/privacy + IT |
| G5 | HR-machine UAT | Managed-device sign-in, shortcut, core workflows, failure states, logout/revocation, no local secrets/data | HR leader + IT |
| G6 | Four-department pilot | Signed UAT, support owner, monitoring, on-call/escalation, 30-day review date | Executive sponsor |
| G7 | Scale decision | Usefulness/false-positive evidence, retention audit, incident review, capacity, and transactional-store decision | Sponsor + HR + IT |

No gate authorizes DMs, private channels, employee scoring, outbound actions,
or autonomous employment decisions.

## 18. Acceptance criteria

People Pulse is delivered to the HR leader with confidence only when:

1. The exact production image digest passed the named CI, dependency, container,
   and security gates.
2. Anonymous access, an authenticated nonmember, and a wrong-domain identity are
   denied; the authorized HR group succeeds with MFA.
3. The application independently rejects missing, forged, expired, wrong-
   audience, and wrong-domain IAP assertions.
4. The HR device is managed, encrypted, patched, EDR healthy, screen-locking,
   and uses a named non-shared account.
5. The shortcut opens the HTTPS service without installing secrets, runtimes,
   databases, or local background services.
6. Snapshot and decision buckets are private, separately permissioned,
   versioned, and restore-tested.
7. Effective modes are visible and match the approved change record.
8. The Slack installation exposes only approved public-channel read scopes and
   the runtime rejects unmapped/unapproved channels.
9. The production prompt/privacy test proves no prohibited identity or long
   message content reaches Claude.
10. Dashboard loading, empty, stale, partial, permission-denied, server-error,
    long-copy, dark, desktop, mobile, chat answer/refusal/error/rate-limit,
    decision, conflict, and restore flows pass without console errors or failed
    requests.
11. Dependency audit has no unresolved high or critical production finding, or
    an explicit time-bounded IT risk acceptance names the affected path,
    compensating controls, and remediation date.
12. Backup/restore, group removal, service disablement, Slack-token revocation,
    and previous-revision rollback are demonstrated.
13. HR, IT/security, privacy/legal, and the executive sponsor sign their gates.
14. The evidence package states exactly what was not tested, including any live
    provider or device control not exercised.

## 19. Ownership and RACI

| Work | HR leader | Sponsor | IT/security | Privacy/legal | Engineering |
| --- | --- | --- | --- | --- | --- |
| Product scope and useful signals | A/R | A | C | C | C |
| Channel map approval | A/R | C | C | C | I |
| Employee notice and acceptable use | R | A | C | A/R | I |
| Cloud project, IAP, group, MFA, device policy | I | C | A/R | C | C |
| Slack/Claude secrets and provider configuration | C | I | A/R | C | C |
| Code, tests, image, migration, rollback artifact | I | I | C | C | A/R |
| HR-machine UAT | A/R | I | R | I | C |
| Production go/no-go | R | A | R | R | C |
| Incident response | C | I | A/R | R for privacy events | C |

`A` = accountable, `R` = responsible, `C` = consulted, `I` = informed.

## 20. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Communication style is mistaken for performance | Task-only taxonomy, cited evidence, employee-scoring refusal, HR training, sampled review |
| Channel coverage is incomplete | Allowlist status and insufficient-evidence labels; quiet channels are never treated as health proof |
| IAP is bypassed or misconfigured | Direct IAP, no anonymous invoker, signed JWT verification in app, authoritative group binding, allow/deny UAT |
| HR laptop becomes a data store | Browser-shortcut-only design, no secrets/local service, no downloads, managed endpoint controls |
| File decision store loses concurrent writes | Single instance/concurrency one, operation queue, versioning, restore test; database required before scale |
| Slack or Claude token leaks | Secret manager/runtime identity, least privilege, rotation/revocation drills, no client exposure/logging |
| AI invents an organizational conclusion | Structured output, citations, observation/interpretation separation, uncertainty, human decision |
| Embedded chat cites or exposes unauthorized content | Snapshot-only serializer, local refusal gate, forced schema, evidence-ID allowlist, no durable chat, separate LIVE mode, secret manager, rate/cost limits |
| Future connector searches outside the People Pulse allowlist | Do not enable until IT can provision an application-specific read-only connector/tool allowlist and verify its source scope |
| Retention expands silently | Explicit lifecycle table, owner/change record, version/backup deletion proof |
| A mock is mistaken for production evidence | Persistent mode display and separate live-provider proof gates |

## 21. Open IT decisions with recommended defaults

These do not block the local release package; they block production execution.

| Decision | Recommended default |
| --- | --- |
| Identity/hosting | Google Cloud Run direct IAP because existing Workspace sign-in and Google data integration reduce setup |
| Authorized users | One IT-owned Google Group; no individual bindings except a time-bounded break-glass account |
| Region | Nearest company-approved US region consistent with employment-data policy; `us-east1` is only the template default |
| Device restriction | Require managed/compliant device through Context-Aware Access where licensed; otherwise document compensating endpoint controls |
| Pilot users | One HR leader and one executive sponsor maximum until transactional decision storage exists |
| Snapshot retention | 120 days |
| Decision/audit retention | 365 days |
| Ad-hoc investigation | Embedded Ask People Pulse over the selected validated snapshot; session-only display and cited answers |
| Claude API purpose | Scheduled per-department synthesis plus explicit embedded-chat submissions; no passive page-view calls |
| Current Slack enrichment | Defer until IT provisions and verifies an application-specific read-only connector behind the same chat |
| First live data | One approved department, public channels only, AI still MOCK |
| Support | Named IT owner with four-business-hour pilot recovery target |

## 22. Authoritative security references

- [Google Cloud: configure direct IAP for Cloud Run](https://docs.cloud.google.com/run/docs/securing/identity-aware-proxy-cloud-run)
- [Google Cloud: validate the signed IAP identity](https://docs.cloud.google.com/iap/docs/identity-howto)
- [Google Cloud: secure IAP signed headers](https://docs.cloud.google.com/iap/docs/signed-headers-howto)
- [Google Cloud: Cloud Storage volume mounts and limitations](https://docs.cloud.google.com/run/docs/configuring/services/cloud-storage-volume-mounts)
- [Google Workspace: Context-Aware Access](https://support.google.com/a/answer/12645308)
- [Slack: OAuth security and token handling](https://api.slack.com/docs/oauth-safety)
- [NIST SP 800-207: Zero Trust Architecture](https://csrc.nist.gov/pubs/sp/800/207/final)
- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
- [CISA Secure by Design principles](https://www.cisa.gov/sites/default/files/2023-06/principles_approaches_for_security-by-design-default_508c.pdf)
