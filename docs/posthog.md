# PostHog Self-Driving For Nakafa

Operational runbook for the shared self-driving setup. Server state lives in
PostHog cloud, not in this repo. This file records what was verified, what is
on, and what remains manual.

## Project

- Project Nakafa `114144` on `https://eu.posthog.com`, timezone UTC.
- Site `https://nakafa.com`. Browser traffic uses the same-origin proxy path
  `/_nakafa` (see `packages/analytics/posthog/config.ts`).
- Cookieless baseline is stateless server hash. The consent gate and browser
  SDK posture are owned by the analytics work in PR #617 and are unchanged
  by this runbook.

## GitHub

- Organization integration `nakafaai` (`kind: github`, id `83776`) is
  connected with no errors.
- Cached repo list includes `nakafaai/nakafa.com` (default branch `main`)
  plus 6 sibling repos. The cached list reports `can_push: false`.
- Follow-up before merge-by-agent: each teammate who ships PRs connects a
  personal GitHub account, and a project admin confirms the project
  repository connection grants PR writes. Scouts research read-only until
  then.

## Signal Sources (8 Enabled)

| Product | Type |
| --- | --- |
| `github` | `issue` |
| `health_checks` | `health_issue` |
| `analytics` | `anomaly_investigation` |
| `llm_analytics` | `evaluation_report` |
| `error_tracking` | `issue_created` |
| `error_tracking` | `issue_reopened` |
| `error_tracking` | `issue_spiking` |
| `session_replay` | `session_analysis_cluster` |

The scout gate needs no row: scout findings reach the inbox by default.
Verify with `inbox-source-configs-list` (`limit: 100`).

## Scout Fleet (6 Enabled, 21 Disabled)

Enabled, daily (`1440` min), emitting, trusted network:

| Scout | Watches |
| --- | --- |
| `signals-scout-general` | Cross-product correlations no specialist covers |
| `signals-scout-error-tracking` | `$exception` bursts, loops, fingerprint clusters |
| `signals-scout-session-replay` | Recording cliffs, rage/dead-click friction |
| `signals-scout-web-analytics` | Channel volume, attribution, landing-page health |
| `signals-scout-web-vitals` | p75 LCP/INP/CLS/FCP vs thresholds and history |
| `signals-scout-health-checks` | Active PostHog health issues by blast radius |

Total stays under the 10-enabled guidance. The rest of the canonical fleet
is materialized but paused. Verify with `scout-config-list`. Tune one scout
with `scout-config-update` (`enabled`, `emit` for dry-run, schedule).

## Custom Scouts (None Created)

A custom scout is a scheduled agent you describe in plain English to watch a
Nakafa-specific surface the built-ins miss. It lives in PostHog cloud, reads
PostHog data on schedule, and files inbox reports. Proposals need approval;
the wizard caps proposals at 2. This setup creates none.

Candidates for later (create in UI, then run on demand before enabling):

1. Localized content drift: per-locale share of pageviews and 404s so a dead
   `id`/`en`/`de` route cannot hide inside a flat total.
2. Quran renderer health: surah-page error and vital regressions dated
   against deploys, without touching authored Aksara content.

## Inbox Workflow

- Inbox: `https://eu.posthog.com/project/114144/inbox`.
- Review reports, ask AI with evidence in context, approve/snooze/decline,
  merge PRs like any other PR. Nothing ships without review.
- Dismissal/snooze notes are forwarded to the filing scout, so honest
  triage quiets repeats. Resolved stays resolved; recurrences file anew.
- At setup the inbox held 0 reports. Expect first findings in ~30 minutes.
  Scout output is also queryable as `$scout_report_emitted` events.

## Cost And Guardrails

- First 3 agent PRs per month free, then $15 flat per PR. Reports free.
- Default fleet budget is 100 scout runs per day. Prefer slowing a noisy
  scout over disabling coverage.
- No Slack destination is configured. Optional: connect Slack once, then set
  per-scout channel/DM delivery and a monthly PR cap in the inbox sidebar.
- AI data processing must stay on for the organization.

## Repo Scope Of This Change

- This runbook only. No SDK init, consent gate, proxy, or instrumentation
  file is touched, so PR #617 (`fix/analytics-always-on-baseline`) has no
  file overlap.
- Follow-ups outside this change: `npx @posthog/wizard upload-source-maps`
  for symbolicated Next.js traces, Replay Vision scanners once recordings
  flow, and the personal-GitHub step above.

## References

- Setup: `https://posthog.com/docs/self-driving/setup`
- Inbox: `https://posthog.com/docs/self-driving/inbox`
- Sources: `https://posthog.com/docs/self-driving/inbox/sources`
- Scouts: `https://posthog.com/docs/self-driving/scouts`
- Scout examples: `https://posthog.com/docs/self-driving/scout-examples`
- Next.js error tracking: `https://posthog.com/docs/error-tracking/installation/nextjs`
- Upload source maps: `https://posthog.com/docs/error-tracking/upload-source-maps/nextjs`
