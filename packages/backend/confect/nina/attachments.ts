import { getFile } from "@convex-dev/agent";
import { components } from "@repo/backend/confect/_generated/components";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx,
} from "@repo/backend/confect/_generated/services";
import { NinaUploadError } from "@repo/backend/confect/nina/uploads.spec";
import { Clock, Effect } from "effect";

/** Resolves only this user's unexpired upload grants inside the send transaction. */
export const consumeAttachments = Effect.fn("nina.attachments.consume")(
  function* (
    userId: Docs["users"]["_id"],
    uploadIds: readonly Docs["ninaUploads"]["_id"][]
  ) {
    if (new Set(uploadIds).size !== uploadIds.length) {
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
        yield* writer.table("ninaUploads").delete(uploadId).pipe(Effect.orDie);
        return { fileId, part: saved.imagePart ?? saved.filePart };
      })
    );
    return {
      fileIds: files.map((file) => file.fileId),
      parts: files.map((file) => file.part),
    };
  }
);
