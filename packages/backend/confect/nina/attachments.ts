import { getFile } from "@convex-dev/agent";
import {
  NINA_DOCUMENT_SIZE,
  NinaUploadError,
} from "@repo/backend/client/nina/uploads";
import { components } from "@repo/backend/confect/_generated/components";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx,
} from "@repo/backend/confect/_generated/services";
import { Array as Arr, Clock, Effect } from "effect";

/** Reads one stored attachment: its model part and the storage entry that holds its bytes. */
const readAttachment = Effect.fn("nina.attachments.read")(function* (
  fileId: string
) {
  const ctx = yield* MutationCtx;
  const saved = yield* Effect.tryPromise({
    try: () => getFile(ctx, components.nina, fileId),
    catch: () =>
      new NinaUploadError({
        code: "NINA_UPLOAD_FAILED",
        message: "Unable to read this attachment.",
      }),
  });
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
      message: "The documents in one message can hold at most 10 MiB together.",
    });
  }
});

/**
 * Applies the document limit to the files of a stored message before a retry
 * sends them again. A message stored before the limit existed can exceed it.
 */
export const requireStoredDocumentLimit = Effect.fn("nina.attachments.stored")(
  function* (fileIds: readonly string[]) {
    yield* requireDocumentLimit(yield* Effect.forEach(fileIds, readAttachment));
  }
);

/**
 * Resolves only this user's unexpired upload grants inside the send transaction.
 * The document size check runs before any grant is deleted, so a refused
 * message keeps every upload available.
 */
export const consumeAttachments = Effect.fn("nina.attachments.consume")(
  function* (
    userId: Docs["users"]["_id"],
    uploadIds: readonly Docs["ninaUploads"]["_id"][]
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
        return { uploadId, ...(yield* readAttachment(upload.state.fileId)) };
      })
    );
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
