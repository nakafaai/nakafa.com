import {
  NINA_DOCUMENT_SIZE,
  NINA_DOCUMENT_SIZE_MESSAGE,
  NinaUploadError,
} from "@repo/backend/client/nina/uploads";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx,
} from "@repo/backend/confect/_generated/services";
import {
  countMessageTokens,
  NINA_BUDGET,
} from "@repo/backend/confect/nina/budget";
import {
  getStoredFile,
  readFile,
} from "@repo/backend/confect/nina/sealed/file";
import { NinaTurnError } from "@repo/backend/confect/nina/turns.spec";
import { readLearnerKeys } from "@repo/backend/confect/vault/keys";
import type { ModelMessage } from "ai";
import { Array as Arr, Clock, Effect } from "effect";

/** The keys of one learner, read by the caller once for a whole send (ADR 0024). */
type ReadKeys = ReturnType<typeof readLearnerKeys>;

const readFailure = () =>
  new NinaUploadError({
    code: "NINA_UPLOAD_FAILED",
    message: "Unable to read this attachment.",
  });

/**
 * Reads the storage entry of one stored file, and whether it is a document. The size
 * check needs no name, so a retry never opens one.
 */
const readEntry = Effect.fn("nina.attachments.entry")(function* (
  fileId: string
) {
  const ctx = yield* MutationCtx;
  const saved = yield* getStoredFile(ctx, fileId).pipe(
    Effect.mapError(readFailure)
  );
  return {
    document: saved.imagePart === undefined,
    storageId: saved.file.storageId,
  };
});
type Entry = Effect.Success<ReturnType<typeof readEntry>>;

/**
 * Reads one stored attachment for its learner: its model part, with the name the
 * learner gave it, and the storage entry that holds its bytes. The name is opened
 * only when `sealed` says that its upload sealed it.
 */
const readAttachment = Effect.fn("nina.attachments.read")(function* (
  readKeys: ReadKeys,
  sealed: boolean,
  fileId: string
) {
  const ctx = yield* MutationCtx;
  const saved = yield* readFile(ctx, readKeys, fileId, sealed).pipe(
    Effect.mapError(readFailure)
  );
  return {
    fileId,
    part: saved.imagePart ?? saved.filePart,
    storageId: saved.file.storageId,
    document: saved.imagePart === undefined,
  };
});

/** Refuses attachments whose documents exceed the bytes one request can carry. */
const requireDocumentLimit = Effect.fn("nina.attachments.limit")(function* (
  files: readonly Entry[]
) {
  const ctx = yield* MutationCtx;
  // Only documents count toward the limit, so images never read their size.
  // getFile has just read these storage entries, so their system rows exist.
  const documentSizes = yield* Effect.forEach(
    Arr.filter(files, (file) => file.document),
    (file) =>
      Effect.promise(() => ctx.db.system.get("_storage", file.storageId)).pipe(
        Effect.flatMap(Effect.fromNullishOr),
        Effect.map((stored) => stored.size),
        Effect.orDie
      )
  );
  const documentBytes = Arr.reduce(
    documentSizes,
    0,
    (total, size) => total + size
  );
  if (documentBytes > NINA_DOCUMENT_SIZE) {
    return yield* new NinaUploadError({
      code: "NINA_UPLOAD_SIZE",
      message: NINA_DOCUMENT_SIZE_MESSAGE,
    });
  }
});

/**
 * Refuses a learner message that costs more than one turn can carry. The cost is
 * the one the history counts for the message: its text, its files and the
 * provider overhead. So the call fits the context limit with its reserved parts
 * and the turn's evidence.
 */
export const requirePromptLimit = Effect.fn("nina.attachments.prompt")(
  function* (message: ModelMessage) {
    if (countMessageTokens(message) <= NINA_BUDGET.prompt) {
      return;
    }
    return yield* new NinaTurnError({
      code: "NINA_MESSAGE_SIZE",
      message:
        "This message is too long for one turn. Shorten it, or send the rest in a new message.",
    });
  }
);

/**
 * Applies the document limit to the files of a stored message before a retry
 * sends them again. A message stored before the limit existed can exceed it.
 */
export const requireStoredDocumentLimit = Effect.fn("nina.attachments.stored")(
  function* (fileIds: readonly string[]) {
    yield* requireDocumentLimit(
      yield* Effect.forEach(fileIds, (fileId) => readEntry(fileId))
    );
  }
);

/**
 * Resolves only this user's unexpired upload grants inside the send transaction.
 * The size checks run before any grant is deleted, so a refused message keeps
 * every upload available. The learner's keys are read once for the whole send, and
 * only a sealed name reads them.
 */
export const consumeAttachments = Effect.fn("nina.attachments.consume")(
  function* (
    userId: Docs["users"]["_id"],
    uploadIds: readonly Docs["ninaUploads"]["_id"][],
    text: string
  ) {
    if (Arr.dedupe(uploadIds).length !== uploadIds.length) {
      return yield* new NinaUploadError({
        code: "NINA_UPLOAD_INVALID",
        message: "An attachment cannot be submitted twice.",
      });
    }
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const now = yield* Clock.currentTimeMillis;
    const readKeys = yield* Effect.cached(readLearnerKeys(userId));
    const files = yield* Effect.forEach(
      uploadIds,
      Effect.fn("nina.attachments.resolve")(function* (uploadId) {
        const upload = yield* reader
          .table("ninaUploads")
          .get(uploadId)
          .pipe(
            Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
            Effect.orDie
          );
        if (
          !upload ||
          upload.userId !== userId ||
          upload.expiresAt <= now ||
          upload.state.status !== "ready"
        ) {
          return yield* new NinaUploadError({
            code: "NINA_UPLOAD_INVALID",
            message: "This attachment is no longer available to send.",
          });
        }
        return {
          uploadId,
          ...(yield* readAttachment(
            readKeys,
            upload.nameSealed === true,
            upload.state.fileId
          )),
        };
      })
    );
    yield* requirePromptLimit({
      role: "user",
      content: [{ type: "text", text }, ...Arr.map(files, (file) => file.part)],
    });
    yield* requireDocumentLimit(files);
    yield* Effect.forEach(files, (file) =>
      writer.table("ninaUploads").delete(file.uploadId).pipe(Effect.orDie)
    );
    return {
      fileIds: Arr.map(files, (file) => file.fileId),
      parts: Arr.map(files, (file) => file.part),
    };
  }
);
