# People Pulse — HR Leader Deployment Plan

## Outcome

Ship People Pulse as an IT-managed internal HTTPS application. The HR leader's
computer receives one managed browser bookmark/shortcut and uses the existing
Google Workspace account and MFA. The computer does not receive application
code, Slack or Claude credentials, Google service-account JSON, a database,
weekly files, or a local background service.

The primary target is Cloud Run with direct Identity-Aware Proxy (IAP). Direct
IAP is preferred because it protects the Cloud Run URL itself, supports
Workspace users and groups, and avoids a custom login page and separate load
balancer for this single-region pilot.

## What is already in the release package

- Node 22 production entrypoint that refuses non-LIVE cloud data mode.
- Signed Google IAP JWT validation for signature, issuer, exact Cloud Run
  audience, subject, hosted domain, and email domain.
- Server-side protection of the HTML shell, APIs, and decisions.
- Same-HTTPS-origin mutation checks, strict CSP/security headers, bounded body,
  schema validation, safe errors, rate limits, and timeouts.
- Non-root multi-stage container with a pinned Node base-image digest.
- Terraform for direct IAP, authoritative Google Group access, dedicated
  runtime identity, separate private/versioned snapshot and decision buckets,
  health probes, and single-writer pilot limits.
- Named unit, API, browser, contract, privacy, adversarial, deployment-static,
  dependency, and container-build checks.

These artifacts have not been applied to a company cloud project.

## Required owners

| Owner | Responsibility |
| --- | --- |
| Executive sponsor | Budget, business purpose, final go/no-go |
| HR leader | Channel approval, usefulness, UAT, prohibited-use adherence |
| IT cloud administrator | Google Cloud project, Terraform state/apply, registry, IAP, storage, monitoring, rollback |
| Workspace administrator | Google Group, MFA, session/device policy, managed browser bookmark |
| Security/privacy/legal | Employee notice, data boundary, retention, provider terms, incident handling |
| Engineering | Release image, migrations, tests, evidence, defect response |

One person may hold more than one role, but every responsibility must have a
named owner in the change record.

## Phase 0 — Confirm the company foundation

IT records these answers before infrastructure work:

1. Company Google Workspace hosted domain.
2. Dedicated Google Cloud project ID and billing owner.
3. Approved employee-data region.
4. Google Group name and two group owners.
5. Named HR pilot user and optional executive sponsor.
6. Whether Context-Aware Access is licensed and already used.
7. Managed-device platform: Google endpoint management, Intune, another MDM, or
   documented compensating controls.
8. Central logging/SIEM destination and incident contact.
9. Approved retention values and legal-hold owner.
10. Slack workspace owner and privacy/employee-communications approver.
11. Claude/Anthropic tenant owner, terms/DPA decision, weekly synthesis budget,
    embedded-chat per-question budget/rate limit, and retention decision.

Recommended pilot defaults are in PRD §21.

Exit evidence: completed decision record with no placeholder production names.

## Phase 1 — Create identity and access before the application

1. Create an IT-owned Google Group such as
   `people-pulse-hr@company.example`.
2. Assign at least two group owners; disable external membership.
3. Add only the named HR leader and optional sponsor.
4. Confirm MFA enforcement for both users; prefer passkeys/security keys for
   privileged users.
5. Configure Context-Aware Access to require a compliant managed device when
   licensed. If it is not licensed, document full-disk encryption, EDR, patch,
   firewall, screen-lock, and managed-browser evidence as compensating
   controls.
6. Create a time-bounded break-glass identity only if the company already has a
   governed break-glass process. Do not use a developer account as production
   fallback.

Exit tests:

- group member can satisfy the Workspace sign-in policy;
- a normal employee outside the group cannot gain application access after
  deployment;
- external-domain membership is prevented; and
- group removal time is measured and accepted.

## Phase 2 — Produce an immutable release

Engineering/CI performs this from a clean commit, never from the dirty local
working tree:

1. Run the complete named People Pulse QA suite.
2. Run `npm audit --omit=dev --audit-level=high` against the exact lockfile.
3. Generate a CycloneDX or SPDX SBOM.
4. Build from the repository root using
   `people-pulse/deploy/cloud-run/Dockerfile`.
5. Scan OS and npm packages for high/critical findings.
6. Push to the IT-owned Artifact Registry.
7. Record the immutable `@sha256:<digest>` reference; do not deploy a mutable
   tag.
8. Attach CI logs, screenshots, SBOM, audit, scan, source SHA, base-image
   digest, application-image digest, and SHA-256 evidence inventory.

Release command shape for an authorized CI runner:

```powershell
docker build --file people-pulse/deploy/cloud-run/Dockerfile --tag $ApprovedRegistryImage .
docker push $ApprovedRegistryImage
docker buildx imagetools inspect $ApprovedRegistryImage
```

`$ApprovedRegistryImage` is supplied by IT. Do not paste credentials or secrets
into the command, Dockerfile, Terraform variables, or build arguments.

Exit evidence: scan-approved immutable digest tied to the exact commit and CI
run.

## Phase 3 — Validate and apply infrastructure

IT copies the Terraform example to a protected environment-specific variable
file outside the repository or uses the company's normal encrypted variables
system. No provider secret belongs in Terraform state.

Required pre-apply checks:

```powershell
terraform fmt -check -recursive people-pulse/deploy/cloud-run/terraform
terraform -chdir=people-pulse/deploy/cloud-run/terraform init -backend=false
terraform -chdir=people-pulse/deploy/cloud-run/terraform validate
terraform -chdir=people-pulse/deploy/cloud-run/terraform plan -out=people-pulse.plan
```

IT reviews the plan for:

- the correct project and region;
- direct IAP enabled;
- no `allUsers` or `allAuthenticatedUsers` binding;
- only the IAP service agent can invoke Cloud Run;
- only the approved Google Group can access through IAP;
- a dedicated non-default runtime service account;
- read-only access to the snapshot bucket;
- read/write access only to the decision bucket;
- uniform bucket access, public-access prevention, versioning, and soft delete;
- one instance and concurrency one;
- immutable image digest;
- `PP_DATA_MODE=LIVE`, provider modes matching the approved stage,
  notifications off, and writeback off; and
- deletion protection and company-standard labels/logging.

After approval, IT applies through the normal change pipeline using its remote
state backend. A developer does not apply from a workstation.

Exit evidence: applied outputs, service URI, IAP audience, group binding,
service account, bucket IAM, image digest, and cloud change record.

## Phase 4 — Seed authenticated staging safely

1. Upload one validated synthetic TEST/MOCK snapshot to the snapshot bucket.
2. Keep Slack read, scheduled AI synthesis, and embedded chat in MOCK for the
   first authenticated test.
3. Ensure the decision bucket is empty or contains only a test-run-marked
   decision file.
4. Confirm Cloud Run startup/liveness probes are healthy.
5. Confirm the application startup log shows data LIVE, providers MOCK,
   notification OFF, and writeback OFF without identity, email, content, or
   secret fields.

Exit evidence: healthy revision, rendered fixture dashboard, storage object
versions, and effective modes.

## Phase 5 — Prove identity and application security in staging

Run all of these against the final HTTPS service:

| Test | Expected result |
| --- | --- |
| Anonymous/private browser | Google sign-in or denial before app content |
| Authenticated company user outside group | Denied |
| External Google account | Denied |
| Authorized HR group member | Dashboard succeeds |
| Removed group member after propagation window | Denied |
| Missing/forged/wrong-audience IAP assertion through an authorized test path | App returns 401 |
| Cross-origin POST or missing People Pulse CSRF header | App returns 403 |
| Oversized/malformed JSON | Bounded 413/400, no stack or content leak |
| Burst above rate limit | 429 with `Retry-After` |
| Ask People Pulse in MOCK | Cited snapshot answer, `providerContacted=false`, no Anthropic request |
| Ask People Pulse DM/employee-scoring request | Local refusal, no provider request |
| Ask People Pulse forged evidence ID through provider test double | Response rejected before render |
| Direct JSON file/path traversal attempt | 404 |
| CSP/header inspection | No `unsafe-inline`; required hashes/security headers present |
| Non-Slack evidence URL in a test artifact | Artifact rejected before render |

Do not disable IAP to make these tests easier. Programmatic probes use an
approved IAP test identity or test through a staging-only controlled path.

Exit evidence: timestamped allow/deny matrix, response headers, safe logs, and
zero unresolved high/critical finding.

## Phase 6 — Prove persistence and recovery

1. Record a marked test decision through the UI.
2. Restart the Cloud Run revision and confirm the decision remains.
3. Restore/reopen the decision and confirm history remains.
4. Inspect object version history and restore the previous decision object into
   an isolated validation path.
5. Restore a weekly snapshot version into an isolated path and validate it with
   the current schema before use.
6. Deploy the prior approved image to a staging revision and route staging
   traffic back to it.
7. Remove the test artifacts by test-run ID only; never broadly clear a bucket.

Because the pilot decision store is file-based, no deployment occurs while an
executive decision is being recorded. Multi-instance rollout remains blocked
until a transactional database migration passes concurrency and restore tests.

Exit evidence: backup/restore and prior-revision rollback timestamps with
artifact hashes.

## Phase 7 — One-department live Slack shadow

This is a separate approval gate from application deployment.

1. Complete employee transparency/notice and channel-owner approval.
2. Install the separate People Pulse Slack app with only public-channel read
   scopes.
3. Export and retain the installed scope list.
4. Approve exactly one department and set only its mapped public channels to
   included.
5. Store the Slack token in Secret Manager for the collector job identity—not
   the web service.
6. Keep scheduled AI synthesis MOCK; notification and writeback remain OFF.
   Keep embedded chat MOCK unless its separate Phase 8A gate has passed.
7. Run the collector, review provider audit and rate-limit behavior, validate
   the snapshot, and compare sampled signals with human review.
8. Confirm no DM/private/file endpoint is called and no prohibited data appears
   in prompt, artifact, log, or CI evidence.

Exit evidence: approved map, scope export, run audit, privacy sample, false-
positive review, and revocation proof.

## Phase 8 — Optional scheduled live Claude synthesis pilot

After HR/privacy/legal and IT approve provider terms:

1. Store the Anthropic key in Secret Manager for the collector/summarizer job,
   or use the company's approved workload-identity path.
2. Set an explicit model and weekly dollar budget.
3. Keep one department and one summary call per department.
4. Run privacy preflight before provider contact.
5. Record model, tokens, cost, retries, and result hash without prompt/body/PII.
6. Have the HR leader compare live and MOCK interpretation quality.
7. Revoke/rotate the key as a drill.

Exit evidence: privacy test, provider audit, cost, structured-output validation,
human usefulness review, and key-revocation result.

## Phase 8A — Optional embedded LIVE chat pilot

This gate is separate from scheduled synthesis and does not enable Slack search.

1. Create or approve a dedicated Anthropic API credential for the People Pulse
   web runtime and store it in Secret Manager.
2. Configure an explicit chat model, `PP_CHAT_MODE=LIVE`, the 12/minute
   per-executive limit, and the approved per-question cost ceiling.
3. Run the prompt privacy suite, prohibited-question refusal matrix, citation-
   allowlist tests, malformed/provider-error cases, and no-retention review.
4. Submit only marked task-level questions against the synthetic or approved
   one-department snapshot; confirm the provider receipt and safe log fields.
5. Confirm a passive page load produces no model request and a rejected
   DM/scoring question produces no model request.
6. Rotate/revoke the chat secret and return chat to MOCK as a drill.

Exit evidence: approved provider terms, exact model/secret reference, controlled
provider receipt, prompt/citation/refusal results, cost, safe logs, no-retention
proof, and revocation result.

## Phase 9 — Put it on the HR leader's machine

### 9.1 Device preflight

IT verifies the exact device and named user:

- company asset record;
- supported OS and current patches;
- full-disk encryption and recovery-key custody;
- EDR/antimalware healthy;
- firewall and screen-lock policy;
- no shared Windows/macOS account;
- managed current Chrome or Edge;
- Workspace profile and MFA working; and
- Context-Aware Access compliance result where enabled.

### 9.2 Deliver the shortcut

Preferred Google-managed Chrome path:

1. Enroll/manage Chrome through Chrome Enterprise Core or the existing Google
   Admin device/browser structure.
2. Add a managed bookmark named **People Pulse** for the HR organizational unit
   or pilot group.
3. Point it to the Terraform `service_uri` or approved custom domain.
4. Put it in a clearly named **HR tools** managed bookmark folder.

For an Intune-managed Windows/Edge fleet, deploy the same URL through the
mandatory Managed Favorites policy. Do not create a local app package when a
managed bookmark provides the required experience.

Official administration references:

- [Google Chrome managed bookmarks](https://support.google.com/chrome/a/answer/10265060)
- [Microsoft Edge ManagedFavorites](https://learn.microsoft.com/en-us/deployedge/microsoft-edge-policies/managedfavorites)
- [Intune Edge policy deployment](https://learn.microsoft.com/intune/intune-service/configuration/administrative-templates-configure-edge)

### 9.3 HR leader UAT

The HR leader—not engineering—performs these tasks on the actual device:

1. Open the managed bookmark and complete normal Google sign-in/MFA.
2. Confirm the identity label, freshness, effective modes, and “No DMs / no
   employee scoring / no outbound actions” boundary.
3. Review needs attention across all departments.
4. Filter to one department and return to All.
5. Open a signal and distinguish observation, interpretation, evidence,
   uncertainty, suggested next step, and wrong-decision risk.
6. Open an authorized Slack citation.
7. Ask an unscheduled work-system question and verify a cited answer is visibly
   scoped to the selected snapshot and department.
8. Ask one DM/private-source question and one employee-scoring question; verify
   local refusal and no provider contact. Confirm chat turns disappear after a
   page reload and no question/answer appears in server storage or logs.
9. Record a marked UAT answer, copy the instruction, reopen the decision, and
   confirm history.
10. Confirm no Slack message, email, task, job, or notification is created.
11. Test dark mode and the normal laptop viewport without overflow.
12. Sign out, remove group access in a controlled test window, and verify denial
    after the agreed propagation period.

Exit evidence: signed HR UAT, IT device evidence, screenshots without sensitive
content, and the access-revocation result.

## Phase 10 — Go-live and 30-day care

Go-live requires all P0 blockers in `SECURITY-IT-READINESS.md` closed or a
time-bounded signed risk acceptance. At go-live:

1. Record the final image digest, modes, group membership, channel map, snapshot
   week/hash, retention, support owner, and rollback revision.
2. Enable monitoring/alerts for failed health, repeated auth denial, rate limit,
   HTTP 5xx, stale/missing snapshot, collector failure, and cost-budget stop.
3. Check health and the primary HR workflow at the start and end of the first
   business day.
4. Review logs and storage versions daily for the first week without reading
   message content.
5. Hold weekly HR usefulness/false-positive reviews during the first month.
6. At day 30, decide whether to expand departments, enable an IT-managed
   read-only current-Slack connector behind Ask People Pulse, migrate decision
   storage, change retention, or stop the pilot.

## Emergency stop and rollback

Use the smallest action that contains the issue:

1. **Access concern:** remove the IAP group binding or affected member.
2. **Application defect:** route traffic to the prior approved Cloud Run
   revision/digest.
3. **Bad snapshot:** remove it from active use, restore the prior validated
   version, and record the reason/hash.
4. **Decision-store issue:** make the workspace temporarily read-only, preserve
   current object versions, and restore into isolation before replacement.
5. **Slack scope/token concern:** stop the collector and revoke the Slack token;
   the dashboard can continue rendering the last approved snapshot if HR/IT
   explicitly allow it and freshness is visible.
6. **Claude concern:** stop the scheduled synthesis job, set embedded chat to
   MOCK, and revoke the affected scheduled or chat Anthropic credential; verify
   a passive dashboard load and MOCK chat make no provider request.
7. **Privacy incident:** preserve safe logs and object versions, notify the
   incident/privacy owners, follow the company response plan, and do not broadly
   delete evidence before legal direction.

Rollback never requires a Slack write, employee-record mutation, or action from
the HR leader's computer.

## Local-machine fallback

The loopback TEST/MOCK demo remains useful for engineering QA and a controlled
offline demonstration. It is not the production delivery path. Installing that
local service, provider credentials, or durable data on the HR leader's machine
would increase support and compromise risk and therefore requires a new
architecture/security review.
