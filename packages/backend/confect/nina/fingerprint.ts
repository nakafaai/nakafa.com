import type { NinaInput } from "@repo/backend/confect/nina/turns.spec";
import type { LearnerKeys } from "@repo/backend/confect/vault/keys";
import type { VaultField } from "@repo/backend/confect/vault/schema";
import { blindText } from "@repo/backend/confect/vault/text";
import { JsonTextSchema } from "@repo/utilities/json";
import { Effect, Schema } from "effect";

/** The stored field the fingerprint of a turn is blinded for (ADR 0024). */
const FINGERPRINT_FIELD = {
  field: "fingerprint",
  table: "ninaTurns",
} satisfies typeof VaultField.Type;

/**
 * A keyed hash of one request: its chat and its input. A repeated request gives the
 * same value, because the learner's key stays the same, so the stored fingerprint
 * still recognizes the request. Another learner's key gives another value, and no
 * unkeyed hash is stored, so a guessed message cannot be confirmed from the database
 * (ADR 0024).
 */
export const requestFingerprint = Effect.fn("nina.fingerprint")(function* (
  keys: LearnerKeys,
  chatId: string | null,
  input: typeof NinaInput.Type
) {
  const text = yield* Schema.encodeEffect(JsonTextSchema)([chatId, input]);
  return yield* blindText(keys, FINGERPRINT_FIELD, text);
});
