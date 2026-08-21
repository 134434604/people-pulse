# People Pulse Cloud Run release package

This package is the chosen production delivery path for an organization that
already uses Google Workspace:

- Cloud Run provides the managed HTTPS application runtime.
- Direct Identity-Aware Proxy (IAP) requires Google sign-in before any app
  route is reached.
- One authoritative Google Group receives IAP access.
- The server verifies the signed IAP JWT, exact Cloud Run audience, issuer,
  hosted Workspace domain, and subject on every request.
- Weekly snapshots mount read-only from a private, versioned bucket.
- Executive decisions mount read/write from a separate private, versioned
  bucket.
- The pilot is one instance with concurrency one. This makes the current
  append-preserved file decision store single-writer by construction.
- Notifications and all writeback remain off.
- The web service exposes a separately rate-limited Ask People Pulse endpoint
  over the validated snapshot. It defaults to MOCK. LIVE requires an explicit
  mode, approved model, and a dedicated Anthropic key injected from Secret
  Manager; the key never enters the image or browser.
- The embedded chat has no Slack-search or write path. Current Slack enrichment
  remains deferred until IT provisions an application-specific read-only
  connector behind the same chat.

The image must be built from the repository root and deployed by immutable
digest:

```powershell
docker build --file people-pulse/deploy/cloud-run/Dockerfile --tag people-pulse:release .
```

Do not run `terraform apply` from a developer account. IT owns the target
project, state backend, Google Group, approved region, image registry, data
buckets, device policy, and change record. The exact staged procedure and
evidence gates are in `docs/HR-LEADER-DEPLOYMENT-PLAN.md`.

The package is formatted and provider-validated with Terraform 1.13.5 and the
signed/hash-locked Google provider 7.45.0. Production CI repeats format,
backend-free initialization with the lockfile in read-only mode, validation,
dependency audit, SBOM generation, and the non-root image build. IT must still
review a real plan and policy scan before apply.

The only newly direct application dependency is `google-auth-library` 10.9.0.
It is Google's official verifier for the signed IAP assertion and was already
present transitively through `googleapis`; declaring it directly makes the
security boundary reproducible.
