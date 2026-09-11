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
        // AI SDK 7 appends text, reasoning, and data parts and mutates active
        // parts in place. Text and reasoning parts expose no stable public id.
        // https://github.com/vercel/ai/blob/ai%407.0.58/packages/ai/src/ui/process-ui-message-stream.ts#L415-L495
        // React's index-key warning applies when list order can change.
        // https://react.dev/learn/rendering-lists#rules-of-keys
        files: ["components/ai/message-parts.tsx"],
        rules: ["react-doctor/no-array-index-as-key"],
      },
      {
        // Convex's public type mandates a React hook for the useAuth prop, so
        // every ConvexProviderWithAuth consumer passes a hook as a value.
        // Convex calls it unconditionally at the provider top level, which
        // keeps the Rules of Hooks intact at runtime; the static rule cannot
        // see across that boundary.
        // https://docs.convex.dev/api/modules/react#convexproviderwithauth
        // https://react.dev/reference/rules/react-calls-components-and-hooks#never-pass-around-hooks-as-regular-values
        files: ["components/providers/convex.tsx"],
        rules: ["react-hooks-js/hooks"],
      },
    ],
  },
};
