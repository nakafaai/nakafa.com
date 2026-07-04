# ADR 0002: Curriculum Preferences Use a Dedicated Learning Preference Capability

## Status

Accepted for PR #198.

## Context

Nakafa needs a fast curriculum selector and a settings profile control that remember a signed-in user's default school curriculum. The public curriculum pages still need to work for anonymous users and SEO, and an explicit URL such as `/id/kurikulum/merdeka` must keep showing that curriculum instead of redirecting to a personalized default.

The existing `users` table owns auth, plan, credits, and profile identity. The existing `learningProfiles` table owns onboarding and generated learning-plan state. Reusing either of those would mix different lifecycles: a casual curriculum browsing preference must not regenerate learning plans, and profile identity must not become a catch-all settings document.

## Decision

Create a domain-owned Learning preference capability for signed-in user defaults. The first field is the user's preferred school-curriculum Learning program. It stores one row per user, validates the selected program against Convex `learningPrograms` data, and uses auth-derived user identity rather than a client-supplied user id.

The curriculum selector navigates immediately and persists the preference in the background. The user settings page exposes the same preference with an explicit save interaction. Onboarding may initialize the preference when the learner chooses a school curriculum, but selector and settings changes do not mutate `learningProfiles` or generated plans.

Public curriculum routes stay explicit and static. The Curriculum index is a public, localized, crawlable page that links to all school-curriculum roots. Anonymous users and signed-in users without a saved preference land on that index from default subject entry points. Signed-in users with a saved preference can have client-side entry links point directly at their preferred curriculum root.

## Implementation Contract

- Convex owns persistence through a `learningPreferences` capability with focused `schema`, `queries`, and `mutations` modules.
- Every Convex function has args and return validators, uses the narrowest public/internal visibility, and reads the current user through existing auth helpers.
- Preference reads use an index by `userId` and return a bounded single-row result.
- Preference writes are idempotent upserts that touch only the signed-in user's preference row and the selected Learning program row needed for validation.
- The stored curriculum identity is the stable Learning program key, not a localized URL or display title.
- Frontend route derivation converts that key to the localized public curriculum root for the active locale.
- Public metadata, canonical URLs, hreflang alternates, sitemap entries, and structured data do not vary by signed-in user preference.
- Server Components keep public curriculum content static; user-personalized preference reads happen in client surfaces or explicitly dynamic settings surfaces.
- Pure deterministic route/option helpers stay pure. Effect programs are used only at real effectful seams and are run at framework or test boundaries.
- No compatibility layer, duplicate curriculum union, legacy Merdeka-only default, or one-off repair path remains after implementation.

## Considered Options

- Store the field on `users`: rejected because `users` would become a mixed lifecycle settings document and every preference write would contend with auth/profile reads.
- Reuse `learningProfiles`: rejected because that table represents onboarding and generated plan state, and planned curricula can still be valid browsing preferences.
- Add a dynamic redirect from `/curriculum` to the saved preference: rejected because it makes the public discovery route request-personalized and weaker for SEO.
- Keep default entry links hardcoded to Merdeka: rejected because it ignores the user's saved curriculum and leaves the original product issue unresolved.

## Verification Gate

- `pnpm format`
- `pnpm --filter @repo/backend typecheck`
- `pnpm --filter @repo/backend exec vitest run convex/learningPreferences`
- `pnpm --filter www typecheck`
- Targeted `www` tests for curriculum route options, the Curriculum index, navigation hrefs, and settings integration
- `pnpm lint`
- Browser verification for `/id/kurikulum`, `/id/kurikulum/merdeka`, every curriculum selector option, and `/id/user/settings`
- Root `pnpm build`
- LOC proof for touched `.ts` and `.tsx` files, with no touched hand-written file over 500 LOC unless explicitly justified
- Source scans for raw `try/catch`, `any`, unsafe assertions, duplicate curriculum key unions, unindexed Convex reads, and stale Merdeka-only defaults
