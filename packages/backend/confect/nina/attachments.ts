import { getFile } from "@convex-dev/agent";
import { components } from "@repo/backend/confect/_generated/components";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx,
} from "@repo/backend/confect/_generated/services";
import {
  NINA_DOCUMENT_SIZE,
  NinaUploadError,
} from "@repo/backend/confect/nina/uploads.spec";
import { Array as Arr, Clock, Effect } from "effect";

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
    const ctx = yield* MutationCtx;
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
        const fileId = upload.state.fileId;
        const saved = yield* Effect.tryPromise({
          try: () => getFile(ctx, components.nina, fileId),
          catch: () =>
            new NinaUploadError({
              code: "NINA_UPLOAD_FAILED",
              message: "Unable to read this attachment.",
            }),
        });
        // getFile has just read this storage entry, so its system row exists.
        const stored = yield* Effect.promise(() =>
          ctx.db.system.get("_storage", saved.file.storageId)
        ).pipe(Effect.flatMap(Effect.fromNullishOr), Effect.orDie);
        return {
          uploadId,
          fileId,
          part: saved.imagePart ?? saved.filePart,
          size: stored.size,
          document: saved.imagePart === undefined,
        };
      })
    );
    const documentBytes = Arr.reduce(files, 0, (total, file) =>
      file.document ? total + file.size : total
    );
    if (documentBytes > NINA_DOCUMENT_SIZE) {
      return yield* new NinaUploadError({
        code: "NINA_UPLOAD_SIZE",
        message:
          "The documents in one message can hold at most 10 MiB together.",
      });
    }
    yield* Effect.forEach(files, (file) =>
      writer.table("ninaUploads").delete(file.uploadId).pipe(Effect.orDie)
    );
    return {
      fileIds: Arr.map(files, (file) => file.fileId),
      parts: Arr.map(files, (file) => file.part),
    };
  }
);
