# HR Moments Slack Assistant

Slack-native work-anniversary review built from the existing Google Apps Script behavior. It reads the existing `Employees` sheet, checks the prior year's celebration-channel history, creates three Claude drafts, and gives approved HR users a private review flow before any public post.

## Safety model

- Weekly preparation posts only to a private HR review channel.
- Claude receives preferred name, years of service, approved tone, optional department, and the prior Slack message. It does not receive employee email, employee ID, birthdays, API keys, or full HR records.
- Prior-message matches are shown to HR and never silently treated as authoritative.
- Every public post requires variant selection plus typed `POST` confirmation.
- `DRY_RUN=true` replaces Claude generation with local fixtures and changes confirmation to typed `TEST`; no celebration-channel message is created.
- Queue IDs are stable per employee and anniversary year. Posted, skipped, and dry-run-approved rows are not recreated by the weekly job.
- Only Slack users listed in `HR_APPROVER_USER_IDS` can select, edit, skip, or post.

## Architecture

```text
Employees sheet -> weekly one-shot job -> celebration channel history
               -> Claude structured drafts -> private Block Kit review
               -> HR selection/edit -> typed confirmation -> public post
               -> Slack Review Queue + Slack Message History sheets
```

The interactive service must run on an approved HTTPS host. Run the weekly command from that host's scheduler; do not depend on an employee laptop remaining awake. Configure a single application instance until queue persistence is moved from Sheets to a transactional store.

## Google Sheet requirements

No existing employee data or original workbook needs to be transferred. Create a blank company Google Sheet or select an approved existing company Sheet, then copy the ID between `/d/` and `/edit` in its URL into `GOOGLE_SPREADSHEET_ID`.

Run `npm run bootstrap:sheet`. On a blank Sheet, the app creates `Employees` with the required headers. On an existing `Employees` tab, it preserves existing columns and appends any missing required headers. Add `Slack User ID` when possible to improve prior-message matching; otherwise the app falls back to employee names. The service also creates and maintains:

- `Slack Review Queue`
- `Slack Message History`

Share the Sheet with the service account as an editor. Use Application Default Credentials, `GOOGLE_APPLICATION_CREDENTIALS`, or base64-encode the approved service-account JSON into `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64` in the host's secret manager.

Only the Slack application/server and its Google service account use the Sheet ID. Claude receives the minimum prompt fields assembled by the application; it does not need direct access to the Sheet.

## Slack setup

1. Create an internal Slack app from `manifest.example.yml`.
2. Point Interactivity to `https://<approved-host>/slack/events`.
3. Install it to the company workspace after admin review.
4. Invite the bot to the private HR review channel and the celebration channel.
5. Configure the bot token and signing secret in the host's secret manager.
6. Put only approved HR Slack user IDs in `HR_APPROVER_USER_IDS`.

Minimum scopes in the example manifest are `chat:write`, `channels:history`, and `groups:history`. Remove `groups:history` if the celebration channel is public and private-channel history is not needed.

## Local setup

```powershell
Copy-Item .env.example .env
npm install
npm run check
npm test
npm run build
```

Populate `.env` with test credentials. Never commit `.env` or credentials.

Initialize the selected company Sheet:

```powershell
npm run bootstrap:sheet
```

Start the interaction server:

```powershell
npm run dev
```

Run the weekly preparation once:

```powershell
npm run weekly
```

The scheduler should invoke `npm run weekly:built` after deployment. Schedule it for Monday morning in the company's chosen time zone.

## Acceptance sequence

1. Use a development Slack workspace or private test channels.
2. Keep `DRY_RUN=true` and place only false `TEST-*` employees in the source sheet.
3. Run `npm run weekly` and verify the report appears only in the review channel.
4. Verify prior-message found/not-found labeling and links.
5. Choose each variant, edit a final message, go back, regenerate, and skip.
6. Confirm unauthorized Slack users cannot act.
7. Type an incorrect confirmation and verify it is rejected.
8. Type `TEST` and verify no celebration-channel message exists.
9. Run the weekly job again and verify final rows are not duplicated.
10. Only after company approval, set `DRY_RUN=false`, provide the Claude secret, and use a designated test celebration channel for the first real post.

## Verification boundaries

Unit tests cover date parsing, week and year boundaries, leap-day policy, similarity detection, and the no-public-post weekly preparation path. Live verification still requires company Slack credentials, a test Sheet, a reachable HTTPS deployment, and an approved Claude API key.
