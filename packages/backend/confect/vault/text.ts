import { open, seal } from "@repo/backend/confect/vault/cipher";
import type { readLearnerKeys } from "@repo/backend/confect/vault/keys";
import type { VaultField } from "@repo/backend/confect/vault/schema";
import { encodeJsonText } from "@repo/utilities/json";
import { Effect } from "effect";

type LearnerKeys = Effect.Success<ReturnType<typeof readLearnerKeys>>;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * What a sealed text is bound to: one learner and one stored field. The parts
 * are encoded as a JSON list, so no two different triples share a binding.
 */
function fieldBinding(keys: LearnerKeys, field: typeof VaultField.Type) {
  return encodeJsonText([
    "nakafa/vault/text/v1",
    keys.userId,
    field.table,
    field.field,
  ]);
}

/** Seals a text for one stored field of the learner who owns `keys`. */
export const sealText = Effect.fn("vault.sealText")(function* (
  keys: LearnerKeys,
  field: typeof VaultField.Type,
  text: string
) {
  return yield* seal(keys, fieldBinding(keys, field), encoder.encode(text));
});

/**
 * Opens a sealed text. It fails with reason `cipher` when the value was sealed
 * for another learner or another field, or when any byte of it changed.
 */
export const openText = Effect.fn("vault.openText")(function* (
  keys: LearnerKeys,
  field: typeof VaultField.Type,
  sealed: ArrayBuffer
) {
  const plain = yield* open(keys, fieldBinding(keys, field), sealed);
  return decoder.decode(plain);
});
