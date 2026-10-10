/**
 * Two inert root keys of 32 bytes each. `current` wraps new learner keys in
 * tests; `retired` only unwraps, as during a rotation.
 */
export const TEST_ROOT_KEYS = {
  current: "test:dGVzdC1yb290LWtleS1mb3ItdGhlLXZhdWx0LTAwMDE=",
  retired: "old:dGVzdC1yb290LWtleS1mb3ItdGhlLXZhdWx0LTAwMDA=",
};
