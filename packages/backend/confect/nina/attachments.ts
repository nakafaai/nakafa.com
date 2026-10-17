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
import { readFile } from "@repo/backend/confect/nina/sealed/file";
import { NinaTurnError } from "@repo/backend/confect/nina/turns.spec";
import type { ModelMessage } from "ai";
import { Array as Arr, Clock, Effect } from "effect";

/**
 * Reads one stored attachment for its owner: its model part, with the name the
 * learner gave it, and the storage entry that holds its bytes.
 */
const readAttachment = Effect.fn("nina.attachments.read")(function* (
  owner: Docs["users"]["_id"],
  fileId: string
) {
  const ctx = yield* MutationCtx;
  const saved = yield* readFile(ctx, owner, fileId).pipe(
    Effect.mapError(
      () =>
        new NinaUploadError({
          code: "NINA_UPLOAD_FAILED",
          message: "Unable to read this attachment.",
        })
    )
  );
  return {
    fileId,
    part: saved.imagePart ?? saved.filePart,
    storageId: saved.file.storageId,
    document: saved.imagePart === undefined,
  };
});
type Attachment = Effect.Success<ReturnType<typeof readAttachment>>;

/** Refuses attachments whose documents exceed the bytes one request can carry. */
const requireDocumentLimit = Effect.fn("nina.attachments.limit")(function* (
  files: readonly Attachment[]
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
  function* (owner: Docs["users"]["_id"], fileIds: readonly string[]) {
    yield* requireDocumentLimit(
      yield* Effect.forEach(fileIds, (fileId) => readAttachment(owner, fileId))
    );
  }
);

/**
 * Resolves only this user's unexpired upload grants inside the send transaction.
 * The size checks run before any grant is deleted, so a refused message keeps
 * every upload available.
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
          ...(yield* readAttachment(userId, upload.state.fileId)),
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
