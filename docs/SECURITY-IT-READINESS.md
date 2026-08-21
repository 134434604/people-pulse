# People Pulse Security and IT Readiness

| Field | Value |
| --- | --- |
| Assessment date | 2026-08-20 |
| Target | Google Cloud Run + direct IAP + managed HR browser shortcut |
| Assessment type | Source, configuration, test, dependency, and local container-build review |
| Production status | Not deployed; external IT, identity, provider, privacy, and device gates remain |

## Executive finding

People Pulse now has a credible production delivery boundary: the release
container builds, runs as a non-root user, verifies signed Google IAP assertions,
requires an exact Cloud Run audience and Workspace domain, protects the HTML and
API server-side, enforces a strict hash-based CSP, restricts evidence links,
requires same-HTTPS-origin mutation requests, rate limits per authenticated
principal, and has a Cloud Run/IAP/private-storage Terraform package.

This is a deployable release package, not a completed production deployment.
The application must not be given to the HR leader as “live” until the P0 gates
below have evidence from the company Google Cloud project, Workspace tenant,
Slack workspace, provider tenant, and managed HR device.

## Status language

- **Verified locally** — implemented and exercised in this repository.
- **Configured in package** — represented in Docker/Terraform but not applied.
- **External gate** — requires IT, HR, legal/privacy, provider, or device access.
- **Gap** — product work still required before the named production stage.

## Go-live blockers

| ID | Blocker | Required closure evidence | Owner |
| --- | --- | --- | --- |
| P0-01 | Company Cloud Run/IAP environment does not exist in evidence | Applied plan, service URI, IAP enabled output, immutable image digest, cloud change record | IT |
| P0-02 | Google Group, MFA policy, and allow/deny identities are not proven | Group owner/membership export; authorized member success; anonymous, nonmember, wrong-domain, removed-member denial; MFA policy evidence | IT/security |
| P0-03 | Managed HR device is not inspected or enrolled | Encryption, EDR, patch, screen-lock, non-shared account, supported browser, and—if used—Context-Aware Access compliance evidence | IT/security |
| P0-04 | Live public-channel collection is not authorized or executed | Employee notice, approved channel map, read-only Slack installation/scopes, one-department shadow run, provider audit | HR/privacy + IT |
| P0-05 | Scheduled live Claude synthesis and embedded LIVE chat are not approved or proven | Provider/platform decision, terms/DPA and retention review, separate Secret Manager access, prompt privacy/refusal proof, cost/rate limits, one-department controlled result, and no-retention verification | Privacy/legal + IT |
| P0-06 | Production snapshot publishing job is not deployed | Separate job identity, approved channel-map input, private snapshot-bucket write, idempotency, run audit, failure alert | Engineering + IT |
| P0-07 | Central application audit does not yet persist a durable event for every decision record/restore and privileged configuration change | Implemented append-only audit sink, actor hash, event type, record ID, mode, timestamp, retention, query/alert proof | Engineering + IT |
| P0-08 | The validated Terraform package has not received an IT-owned production plan/security-policy scan | Reviewed plan against the real project/region/group/digest, policy scan, remote-state/change controls, named approver | IT/CI |
| P0-09 | Backup, restore, revocation, and rollback are not proven in staging | Snapshot restore, decision version restore, group removal, service disablement, Slack token revoke, prior-revision rollback with timestamps | IT + engineering |
| P0-10 | HR/legal/privacy acceptance is not signed | Retention, transparency, acceptable use, prohibited use, escalation, incident, and go/no-go signoff | HR + privacy/legal |

## Implemented security controls

| Control | Status | Repository evidence | Production proof still required |
| --- | --- | --- | --- |
| Signed IAP JWT verification | Verified locally | `googleIapIdentity.ts`; focused valid/invalid/audience/domain tests | Real IAP assertion against deployed audience |
| Server-side executive boundary | Verified locally | HTML and API return 401/403 without authorized identity | Anonymous/nonmember/wrong-domain staging tests |
| Existing Google sign-in reuse | Configured in package | Direct Cloud Run IAP; authoritative group Terraform binding | Workspace tenant and group creation |
| MFA/device context | External gate | IAP supports Workspace identity; PRD requires MFA/device control | Tenant policy and compliant-device result |
| HTTPS + same-origin mutation boundary | Verified locally/configured | Cloud Run HTTPS target; CSRF marker; forwarded HTTPS/host/origin validation | Staging proxy-header and cross-origin tests |
| Strict browser policy | Verified locally | Hash-based CSP; no `unsafe-inline`; no dynamic HTML/style injection; security/permissions headers | Browser response from final image/revision |
| Bounded HTTP input | Verified locally | JSON content type, 64 KiB body limit, strict Zod schemas, safe errors | Staging malformed/oversized request test |
| Rate/time limits | Verified locally | Per-subject 120/minute default plus separate Ask People Pulse 12/minute gate; `Retry-After`; server request/header/keep-alive timeouts | Cloud monitoring and load result |
| Slack least privilege | Verified locally | Separate manifest uses public-channel read scopes; runtime allowlist | Installed app scope export and token rotation |
| No writeback | Verified locally | `writeback` is a literal `OFF`; no People Pulse Slack write call | Deployed environment/mode evidence |
| Evidence link allowlist | Verified locally | HTTPS `*.slack.com/archives/` enforced in schema and UI | Real workspace permalink sample |
| Data minimization | Verified locally | Bounded evidence, hashes, privacy serializer tests, safe logger | Live one-department artifact review |
| Embedded chat boundary | Verified locally/MOCK | Snapshot-only prompt, local prohibited-question refusal, forced schema, evidence-ID allowlist, session-only display, zero-provider MOCK tests | Approved LIVE key/model, controlled provider receipt, cost/retention review |
| Private split storage | Configured in package | Two buckets, uniform access, public access prevention, versioning, soft delete; read-only snapshot mount | Applied IAM/bucket policy and restore proof |
| Single-writer decision safety | Configured/tested | Operation queue; Cloud Run max instances 1 and concurrency 1 | Concurrent staging decision test and version restore |
| Non-root runtime | Verified locally | Container `USER node`; successful local build | Registry digest scan/runtime identity proof |
| Immutable release | Configured in package | Base image digest pinned; Terraform accepts only `@sha256` app image | Registry digest, CI SHA, provenance/attestation |
| Terraform syntax/provider schema | Verified locally | Terraform 1.13.5 container; locked Google provider 7.45.0; `fmt`, backend-free `init`, and `validate` pass | IT plan/policy scan/apply in target project |
| Production dependency audit | Verified locally | `npm audit --omit=dev`: 0 after transitive fixes | Exact-lock CI audit on release SHA |
| Health probes | Configured/tested | Minimal `/api/health`; startup/liveness probes | Cloud Run probe and alert evidence |
| Safe logs | Verified locally | Prohibited log-field guard; auth/rate/error events contain no identity/content | Cloud Logging sink, retention, alert, access review |

## Security and IT feature list

### Identity and access

1. Google Workspace single sign-on through direct Cloud Run IAP.
2. MFA inherited from the company Workspace policy; phishing-resistant MFA is
   preferred for HR, sponsor, and IT administrators.
3. One authoritative Google Group for application access.
4. App-level verification of signed IAP identity, not trust in a plain email
   header.
5. Exact IAP audience and hosted-domain checks to prevent token replay across
   another service or tenant.
6. Server-side role enforcement on the page shell, data, and decisions.
7. No shared HR login and no local application password.
8. Immediate access revocation through group removal; time-bounded break-glass
   access must be separately logged and reviewed.

### Endpoint and browser

1. Company-owned or formally managed Windows/macOS device.
2. Full-disk encryption, supported OS, automatic patches, EDR/antimalware,
   firewall, and screen lock.
3. Current managed Chrome or Edge with password-save disabled for temporary
   test identities.
4. Context-Aware Access requiring compliant device where the Workspace edition
   supports it.
5. A managed shortcut only—no provider tokens, JSON keys, app runtime, local
   database, or scheduled task.
6. Browser downloads/export disabled in v1; clipboard contains only the bounded
   follow-up instruction the executive chose to copy.
7. Session and account removal tested before go-live.

### Application and API

1. Strict CSP with content hashes and no external CDN.
2. `frame-ancestors 'none'`, frame denial, no-referrer policy, HSTS, content-type
   protection, no-store caching, and restrictive permissions policy.
3. Same-HTTPS-origin and custom-header protection for state-changing requests.
4. Strict schemas, explicit route patterns, safe 4xx/5xx errors, 64 KiB maximum
   JSON body, header/request timeouts, and per-principal rate limits.
5. HTTPS Slack archive URL allowlist and same-origin queue URLs.
6. No employee PII in the browser session identity; the IAP subject is hashed
   before application use.
7. A minimal unauthenticated health payload that discloses no modes or data.

### Data and privacy

1. Public team-channel allowlist with excluded-by-default mapping proposals.
2. Runtime rejection of private/DM/unapproved/duplicate scopes.
3. Raw Slack text used only during bounded processing.
4. Bounded summaries, content hashes, timestamps, recurrence keys, and
   authorized links in durable evidence.
5. No individual sentiment, loyalty, productivity, performance, or attrition
   inference.
6. Separate read-only snapshot and read/write decision stores.
7. Private buckets with versioning, soft delete, uniform IAM, and public access
   prevention.
8. Explicit retention schedule, legal-hold behavior, and deletion proof.
9. Embedded chat turns exist only in browser-session memory; the server retains
   hashes/counts/modes for audit but no question, prompt, answer, or transcript.

### Provider and secret handling

1. Slack app separate from the anniversary assistant and limited to public
   channel read scopes.
2. Slack and scheduled-Claude credentials remain in the job runtime. Embedded
   LIVE chat receives a separate Anthropic secret through Secret Manager; no
   provider secret enters the image, source, logs, or HR browser.
3. Dedicated runtime identities for web and collector jobs.
4. Secret rotation, access logging, and emergency revocation runbooks.
5. Provider modes visible in the UI and run audit.
6. Scheduled and embedded-chat privacy serializers, forced schemas, bounded
   retries, separate MOCK/LIVE modes, token/cost logging, and cost limits.
7. The web-service model endpoint requires verified executive identity,
   same-origin mutation protection, a 500-character question schema, a separate
   rate limit, local refusal policy, selected-snapshot citation validation, and
   safe error responses.
8. A future current-Slack connector must be separately authorized for the
   application with read-only tools and verified source scope. Existing
   user-level Claude connector authorization is not assumed to transfer to the
   API, and no second copy/paste chat is exposed.

### Release, monitoring, and recovery

1. Exact Git SHA, lockfile, pinned Node base digest, immutable application image
   digest, dependency audit, tests, screenshots, and SHA-256 evidence inventory.
2. IT-owned Terraform state and reviewed plan; no developer-account production
   apply.
3. Cloud health probes and safe structured logs.
4. Alerts for failed runs, repeated 401/403/429/5xx, stale snapshot, budget
   exhaustion, and missing weekly artifact.
5. Versioned snapshot/decision restore and prior Cloud Run revision rollback.
6. Kill path: remove IAP group access or disable service, stop collector job,
   revoke Slack/Claude secrets, preserve evidence, and communicate incident.
7. A 30-day pilot review covering usefulness, false positives, privacy,
   incidents, cost, retention, and the transactional-storage decision.

## Threat model summary

| Threat | Primary control | Residual risk/gate |
| --- | --- | --- |
| Anonymous internet access | Direct IAP, no anonymous invoker, signed-JWT app check | Must prove applied policy and negative tests |
| Forged identity header | Cryptographically verified IAP assertion | Google key availability; fail-closed monitoring needed |
| Authorized but wrong company account | Hosted-domain and email-domain validation plus IAP group | Group ownership/membership hygiene |
| Cross-site decision request | Custom CSRF header + forwarded HTTPS same-origin validation | Must test final proxy headers |
| Stored/reflected script injection | `textContent`, strict schemas/URLs, hash CSP, no unsafe inline | Future UI changes must keep the gate |
| Snapshot tampering | Validated schema, semantic hash, private versioned bucket | Add signed artifact/provenance before broader scale |
| Prompt injection or employee-scoring request in chat | Treat question/evidence as untrusted data; deterministic refusal before provider; forced schema and citation allowlist | Sample LIVE red-team/UAT remains required |
| Chat cost or provider abuse | Executive-only auth, separate rate and per-question cost limits, MOCK default, Secret Manager key, safe logs | Cloud budget/alert and credential revocation drill required |
| Concurrent decision loss | One instance/concurrency one, in-process queue, versioned bucket | Deployment overlap; transactional DB needed for scale |
| Provider credential theft | Separate job, secret manager, least privilege, rotation | Job/secret configuration not yet implemented/proven |
| HR endpoint theft | MDM, encryption, EDR, screen lock, MFA/device context | Device proof pending |
| AI privacy leakage | Pure serializer, identifier/body tests, one-department gate | Live provider proof and terms pending |
| Employment misuse | Prohibited taxonomy/refusal, citations, human decision, training | Governance and periodic sample review required |

## Required IT evidence package

The production change record must contain:

1. repository commit and CI run URL;
2. container image digest, base image digest, dependency audit, SBOM, and scan;
3. reviewed Terraform plan and applied outputs;
4. IAP enabled proof, exact signed-header audience, authoritative group, and
   allow/deny test results;
5. Workspace MFA and device-policy evidence;
6. Cloud Run service identity and bucket IAM policies;
7. effective People Pulse modes and secret reference status;
8. Slack installed scopes and approved channel map;
9. live-provider tests explicitly separated from MOCK proof;
10. backup/restore, group revocation, service-disable, token-revoke, and rollback
    timestamps/results;
11. HR/privacy/legal UAT and go/no-go signatures; and
12. open risks with owner, expiry, and remediation date.

## Reference basis

- [Google: direct IAP for Cloud Run](https://docs.cloud.google.com/run/docs/securing/identity-aware-proxy-cloud-run)
- [Google: get and validate the IAP user identity](https://docs.cloud.google.com/iap/docs/identity-howto)
- [Google: signed IAP header requirements](https://docs.cloud.google.com/iap/docs/signed-headers-howto)
- [Google: Cloud Storage volume limitations](https://docs.cloud.google.com/run/docs/configuring/services/cloud-storage-volume-mounts)
- [Google Workspace: Context-Aware Access](https://support.google.com/a/answer/12645308)
- [Slack OAuth security](https://api.slack.com/docs/oauth-safety)
- [NIST SP 800-207 Zero Trust Architecture](https://csrc.nist.gov/pubs/sp/800/207/final)
- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/)
- [CISA Secure by Design](https://www.cisa.gov/sites/default/files/2023-06/principles_approaches_for_security-by-design-default_508c.pdf)
