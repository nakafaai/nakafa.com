import type {
  LearnerKeys,
  readLearnerKeys,
} from "@repo/backend/confect/vault/keys";
import type { VaultField } from "@repo/backend/confect/vault/schema";
import { openText, sealText } from "@repo/backend/confect/vault/text";
import { Effect, Result, String as Str } from "effect";
import { Base64Url } from "effect/encoding";

/** The keys of one learner, read by the caller once for a whole read (ADR 0024). */
type ReadKeys = ReturnType<typeof readLearnerKeys>;

/** The stored field of a file's name, which seals the same way for every upload of one learner (ADR 0024). */
const FILE_NAME_FIELD: typeof VaultField.Type = {
  field: "filename",
  table: "files",
};

/** The prefix of a sealed name, so a stored name shows that it is sealed (ADR 0024). */
const SEALED_NAME_PREFIX = "nakafa.sealed.v1:";

/**
 * Seals a file's name for the learner who uploads the file, and returns the name the upload keeps: the prefix, then
 * the sealed bytes in URL-safe Base64.
 */
export const sealFileName = Effect.fn("nina.sealed.file.seal")(function* (
  keys: LearnerKeys,
  name: string
) {
  const sealed = yield* sealText(keys, FILE_NAME_FIELD, name);
  return SEALED_NAME_PREFIX + Base64Url.encode(new Uint8Array(sealed));
});

/**
 * Opens the sealed name of an upload for the learner whose keys `readKeys` reads, so the part a model reads carries
 * the name the learner gave. A name without the prefix, or with a payload that is not Base64, opens as empty bytes,
 * which the vault refuses as a cipher failure, as it refuses any value shorter than its header.
 */
export const openFileName = Effect.fn("nina.sealed.file.open")(function* (
  readKeys: ReadKeys,
  sealed: string
) {
  const encoded = Str.startsWith(SEALED_NAME_PREFIX)(sealed)
    ? sealed.slice(SEALED_NAME_PREFIX.length)
    : "";
  const bytes = Result.getOrElse(
    Base64Url.decode(encoded),
    () => new Uint8Array()
  );
  const keys = yield* readKeys;
  return yield* openText(keys, FILE_NAME_FIELD, new Uint8Array(bytes).buffer);
});
