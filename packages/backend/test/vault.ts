import { Id } from "@repo/backend/confect/_generated/id";
import { ConfigProvider, Effect, Result, Schema } from "effect";
import { Hex } from "effect/encoding";

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

/**
 * A learner whose stored form the golden values of the vault tests were written
 * for. The test database accepts an ID made of digits and the table name only.
 */
const GOLDEN_USER = "1users";
export const goldenUser = Schema.decodeUnknownSync(Id("users"))(GOLDEN_USER);
/** The learner's key under the test root key, as the code wrote it before school keys. */
export const GOLDEN_WRAPPED =
  "0132f26fc9be7efd3b0c3840e3209fd9c71d5e151771c32b7dff0825effa85289411a2ae84127036bf2b6ed993451fff581f3fcddbce36fdf71eb6eed6";

/** The bytes of a stored value, written as hex. */
export const bytes = (hex: string) =>
  new Uint8Array(Result.getOrThrow(Hex.decode(hex))).buffer;
