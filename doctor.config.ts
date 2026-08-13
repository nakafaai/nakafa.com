export default {
  ignore: {
    overrides: [
      {
        // These are explicit Vitest entrypoints reached by the root
        // `agent-docs` script and its dedicated `--config` argument.
        // https://vitest.dev/guide/cli#config
        // https://vitest.dev/config/include
        // https://www.react.doctor/docs/configuration/config-files#narrow-ignores-and-suppressions
        files: ["agent-docs.check.ts", "vitest.agent-docs.config.mts"],
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
    ],
  },
};
