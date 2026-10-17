import { blindHash, open, seal } from "@repo/backend/confect/vault/cipher";
import type {
  readLearnerKeys,
  readTenantKeys,
} from "@repo/backend/confect/vault/keys";
import type { VaultField } from "@repo/backend/confect/vault/schema";
import { encodeJsonText } from "@repo/utilities/json";
import { Effect, Predicate } from "effect";
import { Base64Url } from "effect/encoding";

type LearnerKeys = Effect.Success<ReturnType<typeof readLearnerKeys>>;
type TenantKeys = Effect.Success<ReturnType<typeof readTenantKeys>>;
/** The keys of the owner of a sealed text: one learner, or one school. */
type OwnerKeys = LearnerKeys | TenantKeys;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * What a sealed text is bound to: its owner, one stored table, one field and,
 * when the field belongs to a row, the values that name the row. A learner's text
 * and a school's text bind under different labels, so a text opens only for the
 * owner it was sealed for. The parts are encoded as a JSON list, so no two
 * different bindings share a value, and a field without a row binds as it did
 * before rows were named.
 */
function fieldBinding(keys: OwnerKeys, field: typeof VaultField.Type) {
  const row = field.row ?? [];
  if (Predicate.hasProperty(keys, "tenantId")) {
    return encodeJsonText([
      "nakafa/vault/school-text/v1",
      keys.tenantId,
      keys.generation,
      field.table,
      field.field,
      ...row,
    ]);
  }
  return encodeJsonText([
    "nakafa/vault/text/v1",
    keys.userId,
    field.table,
    field.field,
    ...row,
  ]);
}

/** Seals a text for one stored field of the owner of `keys`. */
export const sealText = Effect.fn("vault.sealText")(function* (
  keys: OwnerKeys,
  field: typeof VaultField.Type,
  text: string
) {
  return yield* seal(keys, fieldBinding(keys, field), encoder.encode(text));
});

/**
 * Opens a sealed text. It fails with reason `cipher` when the value was sealed
 * for another owner or another field, or when any byte of it changed.
 */
export const openText = Effect.fn("vault.openText")(function* (
  keys: OwnerKeys,
  field: typeof VaultField.Type,
  sealed: ArrayBuffer
) {
  const plain = yield* open(keys, fieldBinding(keys, field), sealed);
  return decoder.decode(plain);
});

/**
 * Blinds a text for one stored field of the owner of `keys`: 22 URL-safe
 * characters that stand for the text. The database can match the same text again
 * without being able to read it. Another owner, another field or another text
 * gives another value. The value stays the same for ever, because rows that hold
 * it are looked up by it.
 */
export const blindText = Effect.fn("vault.blindText")(function* (
  keys: OwnerKeys,
  field: typeof VaultField.Type,
  text: string
) {
  return Base64Url.encode(
    yield* blindHash(keys, fieldBinding(keys, field), encoder.encode(text))
  );
});
