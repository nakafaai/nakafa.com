export default {
  ignore: {
    overrides: [
      {
        // These are explicit Vitest entrypoints reached by the root
        // `check:site` script and its dedicated `--config` argument.
        // https://vitest.dev/guide/cli#config
        // https://vitest.dev/config/include
        // https://www.react.doctor/docs/configuration/config-files#narrow-ignores-and-suppressions
        files: ["checks/afdocs.test.ts", "vitest.afdocs.mts"],
        rules: ["deslop/unused-file"],
      },
      {
        // Convex's public type mandates a React hook for the useAuth prop, so
        // every ConvexProviderWithAuth consumer passes a hook as a value.
        // Convex calls it unconditionally at the provider top level, which
        // keeps the Rules of Hooks intact at runtime; the static rule cannot
        // see across that boundary.
        // https://docs.convex.dev/api/modules/react#convexproviderwithauth
        // https://react.dev/reference/rules/react-calls-components-and-hooks#never-pass-around-hooks-as-regular-values
        files: ["src/components/providers/convex.tsx"],
        rules: ["react-hooks-js/hooks"],
      },
      {
        // Socket scores better-auth 1.6.33 at 25 on its vulnerability axis, but no
        // GitHub advisory affects that version: every one listed for better-auth is
        // patched at 1.6.22 or below (GHSA-qq9h-g4jm-xgf3 and the others, read 19 Oct
        // 2026), and OSV lists none (bun run security:audit). 1.6.33 is the last 1.6
        // release, and @convex-dev/better-auth 0.12.5 accepts only >=1.6.11 <1.7.0,
        // so no newer release fits (scripts/dependencies/policy.ts). The OSV audit
        // stays the vulnerability gate for every package. Remove this override when
        // the policy moves better-auth to 1.7.
        // https://github.com/advisories?query=better-auth
        files: ["package.json"],
        rules: ["socket/low-supply-chain-score"],
      },
    ],
  },
};
