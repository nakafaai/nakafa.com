import { getFile } from "@convex-dev/agent";
import { components } from "@repo/backend/confect/_generated/components";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import type { MutationCtx } from "@repo/backend/confect/_generated/services";
import { SealedReadError } from "@repo/backend/confect/nina/sealed.spec";
import { readLearnerKeys } from "@repo/backend/confect/vault/keys";
import {
  VaultError,
  type VaultField,
} from "@repo/backend/confect/vault/schema";
import { openText, sealText } from "@repo/backend/confect/vault/text";
import { Effect, Result, String as Str, Struct } from "effect";
import { Base64Url } from "effect/encoding";

type LearnerId = Docs["users"]["_id"];
type LearnerKeys = Effect.Success<ReturnType<typeof readLearnerKeys>>;

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
 * The prefix of a stored name that is sealed. A name stored before sealing has no
 * prefix, and it is read as it is until the old-message migration replaces it.
 */
const SEALED_NAME_PREFIX = "nakafa.sealed.v1:";

/** The failure of a sealed name that does not decode or open. It reveals nothing about it. */
const nameCipherError = () => new VaultError({ reason: "cipher" });

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
 * Opens a stored file name for `owner`. A name without the prefix was stored plain,
 * and it is returned as it is. A missing name stays missing, as the Agent stores a
 * file that has none.
 */
const openFileName = Effect.fn("nina.sealed.file.open")(function* (
  owner: LearnerId,
  stored: string | undefined
) {
  if (stored === undefined || !Str.startsWith(SEALED_NAME_PREFIX)(stored)) {
    return stored;
  }
  const bytes = Result.getOrUndefined(
    Base64Url.decode(stored.slice(SEALED_NAME_PREFIX.length))
  );
  if (bytes === undefined) {
    return yield* nameCipherError();
  }
  const keys = yield* readLearnerKeys(owner);
  return yield* openText(keys, FILE_NAME_FIELD, new Uint8Array(bytes).buffer);
});

/**
 * Reads one stored file of the component, opened for `owner`. Its name is the name
 * it was stored under, opened, so the part a model reads and the file that the page
 * shows carry the learner's own name (ADR 0024). It fails with `SealedReadError`
 * when the component does not hold the file, and with `VaultError` when a sealed
 * name does not open for `owner`.
 */
export const readFile = Effect.fn("nina.sealed.file")(function* (
  ctx: MutationCtx,
  owner: LearnerId,
  fileId: string
) {
  const saved = yield* Effect.tryPromise({
    try: () => getFile(ctx, components.nina, fileId),
    catch: () => new SealedReadError(),
  });
  const filename = yield* openFileName(owner, saved.file.filename);
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
