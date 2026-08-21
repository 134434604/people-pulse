# People Pulse Decisions

## 2026-08-20 — Missing evidence is not a finding

`insufficient-evidence` is the only signal type allowed without a source
reference. It exists to prevent executives from reading a quiet or incomplete
channel map as proof that a department is healthy or unhealthy. It cannot
support a capacity or employment action.

## 2026-08-20 — Product purpose

People Pulse is organizational work-system intelligence. Its primary purpose is
to identify task bottlenecks, waiting decisions, cross-department handoff gaps,
functional coverage gaps, recurring work without durable ownership, and
evidence that may justify new capacity or a future role.

It is not an employee productivity, loyalty, attitude, sentiment, or attrition-
risk scoring product.

## 2026-08-20 — Source boundary

Version 1 reads only explicitly approved, mapped Slack team channels. Mapping
proposals default to excluded and require a human to set `Include=TRUE`.

Slack DMs, multi-party DMs, private channels, personal folders, medical data,
and protected-class information are excluded from v1. The Slack manifest and
runtime scope guard must reflect the same boundary.

## 2026-08-20 — Executive experience

The default dashboard shows all departments together. It leads with attention,
waiting decisions, task coverage, recurring work, capacity signals, and people
moments. Department drill-down is progressive disclosure rather than the only
way to understand the week.

There is no daily leadership brief. Collection may be incremental so the
weekly view remains fresh, but the system does not push a daily summary.

## 2026-08-20 — Embedded Ask People Pulse is the primary chat

Scheduled synthesis and unscheduled questions solve different executive needs.
Ask People Pulse therefore remains embedded in the dashboard and uses the
Claude API only after an explicit question submission. Passive page loading
never calls a model.

The v1 chat answers from the selected validated snapshot, validates citations
against that snapshot, refuses prohibited private-source and employee-scoring
questions before provider contact, and retains no conversation history outside
the current browser page. MOCK is the default. LIVE requires a separate mode,
server-held secret, cost limit, rate limit, and provider approval.

The permanent copy/paste handoff to company Claude is removed because it makes
the HR workflow unnecessarily choose between two chats. Current Slack
enrichment may later appear behind the same Ask People Pulse surface through an
explicitly provisioned IT-managed read-only connector. An executive's existing
Claude connector authorization is not assumed to transfer automatically to the
People Pulse API.

## 2026-08-20 — Capacity and role signals

Activity volume alone never produces a hiring recommendation. A capacity signal
must be longitudinal, task-based, evidence-linked, and evaluated against this
intervention ladder:

1. Clarify ownership.
2. Improve the process or SOP.
3. Automate or add tooling.
4. Rebalance responsibilities.
5. Add temporary capacity.
6. Explore a role hypothesis.

The executive decides what to do. People Pulse records the decision but never
executes it.

## 2026-08-20 — Storage and privacy

Raw Slack message bodies may exist only during bounded collection/processing.
Persistent records contain sanitized summaries, timestamps, hashes, recurrence
keys, authorized source links, and the minimum identity required to show an
explicitly assigned task owner. Logs contain counts, run IDs, hashes, modes,
errors, token usage, and cost—not message bodies or employee PII.

## 2026-08-20 — CI browser runtime

Hosted CI installs exact Playwright 1.62.1 as an ephemeral QA runner tool after
`npm ci`; it does not add Playwright to the application manifest or lockfile.
This keeps production dependencies unchanged while ensuring the real Chromium
gate runs in CI. The workflow contains no provider credentials and pins every
GitHub Action to an immutable Node 24-era commit.

## 2026-08-20 — Production delivery uses Google Workspace identity

The primary enterprise path is Google Cloud Run with direct Identity-Aware
Proxy. The company can reuse its Workspace identity, MFA, groups, and existing
Google data integration instead of creating a custom login service or a second
employee account system. The application still verifies the signed IAP JWT,
exact Cloud Run audience, issuer, subject, and hosted domain on every request.

Azure App Service Easy Auth with Entra Conditional Access remains an acceptable
alternative if IT is Microsoft-first, but it is not implemented in parallel.

## 2026-08-20 — The HR machine receives a managed bookmark only

People Pulse is centrally hosted. IT places an HTTPS People Pulse bookmark in
the HR leader's managed Chrome or Edge browser. Slack/Claude credentials,
service-account files, application runtimes, durable snapshots, and decision
storage remain in IT-owned cloud services. The local loopback app remains a
TEST/MOCK engineering demo, not the production install.

## 2026-08-20 — Pilot persistence is intentionally single writer

The first Cloud Run pilot uses one instance and request concurrency one with a
private versioned decision bucket. This matches the current append-preserved
file store and avoids false multi-writer claims. A transactional decision store
is required before multi-instance or broader concurrent executive use.
