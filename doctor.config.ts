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
        // Convex's public API explicitly requires an authentication Hook prop.
        // https://docs.convex.dev/api/modules/react#convexproviderwithauth
        // https://github.com/get-convex/convex-js/blob/d28852aa028dede94796a012a2a802ae6ad04188/src/react/ConvexAuthState.tsx#L75-L99
        // This conflicts with React's generic rule against passing Hooks as values.
        // https://react.dev/reference/rules/react-calls-components-and-hooks#never-pass-around-hooks-as-regular-values
        files: ["components/providers/convex.tsx"],
        rules: ["react-hooks-js/hooks"],
      },
    ],
  },
};
