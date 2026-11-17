export default {
  ignore: {
    overrides: [
      {
        // These are explicit Vitest entrypoints reached by the root
        // `check:site` script and its dedicated `--config` argument.
        // https://vitest.dev/guide/cli#config
        // https://vitest.dev/config/include
        // https://www.react.doctor/docs/configuration/config-files#narrow-ignores-and-suppressions
        files: ["checks/afdocs.test.ts", "afdocs.config.mts"],
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
    ],
  },
};
