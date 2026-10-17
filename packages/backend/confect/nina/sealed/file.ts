import { getFile } from "@convex-dev/agent";
import { components } from "@repo/backend/confect/_generated/components";
import type { MutationCtx } from "@repo/backend/confect/_generated/services";
import { SealedReadError } from "@repo/backend/confect/nina/sealed.spec";
import type {
  LearnerKeys,
  readLearnerKeys,
} from "@repo/backend/confect/vault/keys";
import type { VaultField } from "@repo/backend/confect/vault/schema";
import { openText, sealText } from "@repo/backend/confect/vault/text";
import { Effect, Result, String as Str, Struct } from "effect";
import { Base64Url } from "effect/encoding";

/** The keys of one learner, read by the caller once for a whole read (ADR 0024). */
type ReadKeys = ReturnType<typeof readLearnerKeys>;

/**
 * The stored field of a file's name. A sealed name has no row of its own: the
 * component gives the file its id only after it stores the name, so the field
 * names the table alone (ADR 0024).
 */
const FILE_NAME_FIELD: typeof VaultField.Type = {
  field: "filename",
  table: "files",
};

/**
 * The prefix of a sealed name, so a stored name shows that it is sealed. The prefix
 * does not decide how a name is read. The upload that stored the name does, because
 * a name stored before sealing can begin with the prefix too (ADR 0024).
 */
const SEALED_NAME_PREFIX = "nakafa.sealed.v1:";

/**
 * Seals a file's name for the learner who uploads the file, and returns the name
 * that the component stores: the prefix, then the sealed bytes in URL-safe Base64.
 * The seal is deterministic for one learner and one name, so the Agent still reuses
 * a file that the same learner stores again. Two learners never share a name, so
 * the Agent never reuses one learner's file for another.
 */
export const sealFileName = Effect.fn("nina.sealed.file.seal")(function* (
  keys: LearnerKeys,
  name: string
) {
  const sealed = yield* sealText(keys, FILE_NAME_FIELD, name);
  return SEALED_NAME_PREFIX + Base64Url.encode(new Uint8Array(sealed));
});

/**
 * Opens a stored file name that its upload sealed, for the learner whose keys
 * `readKeys` reads. A name the upload did not seal is returned as it is, so a name
 * stored before sealing stays readable whatever its text. A missing name stays
 * missing. A sealed name without the prefix, or with a payload that is not Base64,
 * opens as empty bytes, which the vault refuses as a cipher failure, as it refuses
 * any value shorter than its header.
 */
const openFileName = Effect.fn("nina.sealed.file.open")(function* (
  readKeys: ReadKeys,
  sealed: boolean,
  stored: string | undefined
) {
  if (!sealed || stored === undefined) {
    return stored;
  }
  const encoded = Str.startsWith(SEALED_NAME_PREFIX)(stored)
    ? stored.slice(SEALED_NAME_PREFIX.length)
    : "";
  const bytes = Result.getOrElse(
    Base64Url.decode(encoded),
    () => new Uint8Array()
  );
  const keys = yield* readKeys;
  return yield* openText(keys, FILE_NAME_FIELD, new Uint8Array(bytes).buffer);
});

/**
 * Reads one stored file of the component as the Agent holds it, with its name in
 * the stored form, sealed or plain. A reader that needs no name, such as the size
 * check of a retry, reads the file here. It fails with `SealedReadError` when the
 * component does not hold the file.
 */
export const getStoredFile = Effect.fn("nina.sealed.file.stored")(function* (
  ctx: MutationCtx,
  fileId: string
) {
  return yield* Effect.tryPromise({
    try: () => getFile(ctx, components.nina, fileId),
    catch: () => new SealedReadError(),
  });
});

/**
 * Reads one stored file of the component, with its name opened when `sealed` says
 * that its upload sealed it, so the part a model reads and the file that the page
 * shows carry the name the learner gave (ADR 0024). It fails with `SealedReadError`
 * when the component does not hold the file, and with `VaultError` when a sealed
 * name does not open for the learner.
 */
export const readFile = Effect.fn("nina.sealed.file")(function* (
  ctx: MutationCtx,
  readKeys: ReadKeys,
  fileId: string,
  sealed: boolean
) {
  const saved = yield* getStoredFile(ctx, fileId);
  const filename = yield* openFileName(readKeys, sealed, saved.file.filename);
  return {
    ...saved,
    file: { ...saved.file, filename },
    // A part of a file that has no name keeps none, as the Agent gives it.
    filePart:
      filename === undefined
        ? Struct.omit(saved.filePart, ["filename"])
        : { ...saved.filePart, filename },
  };
});
