export default {
  supplyChain: {
    // React Doctor documents warning severity after the exact package version
    // has been vetted and its residual risk has been accepted.
    // https://www.react.doctor/docs/rules/socket/low-supply-chain-score
    // posthog-js 1.414.0 has no Socket alerts and a 100 vulnerability score.
    // https://socket.dev/npm/package/posthog-js/overview/1.414.0
    severity: "warning",
  },
  surfaces: {
    ciFailure: {
      // CI blocks every warning. Exclude only this reviewed advisory from CI
      // failure while keeping it visible in the CLI, PR report, and score.
      // https://www.react.doctor/docs/configuration/config-files#common-keys
      excludeRules: ["socket/low-supply-chain-score"],
    },
  },
};
