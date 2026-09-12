# @repo/analytics

## 0.1.1

### Patch Changes

- [#617](https://github.com/nakafaai/nakafa.com/pull/617) [`09b9e89`](https://github.com/nakafaai/nakafa.com/commit/09b9e891f869f0226f04613fb437471514a777a3) Thanks [@nabilfatih](https://github.com/nabilfatih)! - Deepen the browser analytics gate into a single transition table with SDK-derived types and explicit pageviews. The gate module owns baseline, grant admission, and baseline revocation atomically, so callers can never opt in without authorizing identity. The hand-written PostHog client mirror is replaced with types picked from the installed SDK, and automatic pageviews give way to explicit initial-plus-history capture: each view lands exactly once, after identity is known, with no duplicate on consent transitions. Undecided, declined, and DNT visitors stay counted through cookieless baseline capture with minimized URLs.

## 0.1.0

### Minor Changes

- [`e9c4947`](https://github.com/nakafaai/nakafa.com/commit/e9c4947c95d674cb42a21c34544c0939d1bd804d) Thanks [@nabilfatih](https://github.com/nabilfatih)! - add email package with welcome template and components

- [`aa179b9`](https://github.com/nakafaai/nakafa.com/commit/aa179b9e3a196cc6117d997246a150e1561b7442) Thanks [@nabilfatih](https://github.com/nabilfatih)! - Add exercise tracking, get results, timer

## 0.0.3

### Patch Changes

- [`ddb5d7b`](https://github.com/nakafaai/nakafa.com/commit/ddb5d7bb1d92e9b2463bf5171ea75331311c6989) Thanks [@nabilfatih](https://github.com/nabilfatih)! - Exclude changeset

## 0.0.2

### Patch Changes

- [`2d694d8`](https://github.com/nakafaai/nakafa.com/commit/2d694d81af7285defab038f2518f2f5279dfafab) Thanks [@nabilfatih](https://github.com/nabilfatih)! - Avoid vercel build for changeset merge

- [`03373ce`](https://github.com/nakafaai/nakafa.com/commit/03373ceada6429e75e94a81b2d655f6e20f999f2) Thanks [@nabilfatih](https://github.com/nabilfatih)! - Update release workflow

## 0.0.1

### Patch Changes

- 3a66784: Implement changeset to nakafa monorepo
