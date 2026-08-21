# People Pulse UI Direction

## Dashboard contract

- Primary operator: an authenticated executive HR leader who may not be
  technical and reviews the workspace weekly or when a cross-team issue is
  escalated.
- Main question: what work is stuck across departments, what decision is
  needed, and what evidence makes that decision safe?
- Decision path: `cited signal -> plain-language interpretation -> embedded
  cited question -> declared executive answer -> durable decision record`.
- Authoritative data: the versioned weekly snapshot API; cards never infer live
  production state from the browser.
- Freshness: always-visible generated time, source week, and effective mode
  flags. TEST/MOCK data is labeled in the header and footer.
- Actions: decision recording is local and audited; queue deep links enter the
  existing HR review flow; no dashboard action posts to Slack or assigns work.

## Visual thesis

A calm, editorial operations desk: warm paper surfaces, ink-black hierarchy,
one cobalt action color, compact evidence rows, and a single orange exception
marker. It should feel closer to a well-run executive briefing binder than a
generic analytics dashboard.

## Content plan

1. Compact orientation bar: product, scope, week, freshness, modes, theme.
2. Ranked attention ledger: what happened, interpretation, evidence, decision.
3. Department coverage table: workload context and follow-up gaps across all
   teams without employee scoring.
4. Recurring work and capacity review: task patterns first, role hypothesis
   last, with the intervention ladder visible.
5. People moments and one-axis activity context.
6. Ask People Pulse: compact session-only chat over the selected validated
   snapshot, with citations, limitations, refusal states, and visible provider
   mode/contact status.

## Interaction thesis

- Rows enter with a short stagger only after validated data loads, making the
  weekly priority order immediately legible.
- Opening a signal uses one contained inspector transition; evidence and
  accepted answers stay in context.
- Recording an answer gives an inline confirmation and reveals the exact
  follow-up instruction that was copied; reduced-motion users get no movement.

## State contract

Loading, empty, stale, partial, permission-denied, invalid-data, network-error,
chat-loading, chat-refusal, chat-error, and rate-limit states are first-class.
Desktop uses a dense
two-column workspace; narrow screens move navigation into the header and stack
attention, coverage, and Ask People Pulse without clipped controls.
