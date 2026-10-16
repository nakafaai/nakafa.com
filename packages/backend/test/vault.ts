import { ConfigProvider, Effect } from "effect";

/**
 * Two inert root keys of 32 bytes each. `current` wraps new learner and school
 * keys in tests; `retired` only unwraps, as during a rotation.
 */
export const TEST_ROOT_KEYS = {
  current: "test:dGVzdC1yb290LWtleS1mb3ItdGhlLXZhdWx0LTAwMDE=",
  retired: "old:dGVzdC1yb290LWtleS1mb3ItdGhlLXZhdWx0LTAwMDA=",
};

/** Runs an effect with only the named root keys in the environment. */
export const withRoots = (roots: string) =>
  Effect.provide(
    ConfigProvider.layer(ConfigProvider.fromUnknown({ VAULT_ROOT_KEYS: roots }))
  );
