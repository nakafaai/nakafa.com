import { FunctionImpl, GroupImpl } from "@confect/server";
import { storeFile } from "@convex-dev/agent";
import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import {
  NINA_FILE_COUNT,
  NINA_FILE_SIZE,
  NINA_FILE_SIZE_MESSAGE,
  NINA_UPLOAD_LIFETIME,
  NinaUploadError,
} from "@repo/backend/client/nina/uploads";
import { components } from "@repo/backend/confect/_generated/components";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import schema from "@repo/backend/confect/_generated/schema";
import {
  ActionCtx,
  DatabaseReader,
  DatabaseWriter,
  MutationCtx,
  MutationRunner,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import session from "@repo/backend/confect/middleware/session.impl";
import { sealFileName } from "@repo/backend/confect/nina/sealed/file";
import spec from "@repo/backend/confect/nina/uploads.spec";
import { ensureLearnerKeys } from "@repo/backend/confect/vault/keys";
import { Clock, Duration, Effect, Exit, Layer } from "effect";

const uploadQuota = new RateLimiter(components.agentRateLimiter, {
  ninaUpload: {
    kind: "token bucket",
    rate: NINA_FILE_COUNT,
    period: MINUTE,
    capacity: NINA_FILE_COUNT,
  },
});
const uploadFailure = () =>
  new NinaUploadError({
    code: "NINA_UPLOAD_FAILED",
    message: "Unable to save this attachment.",
  });

/** Reads one upload row, or null once it is gone. */
const readUpload = Effect.fn("nina.uploads.read")(function* (
  uploadId: Docs["ninaUploads"]["_id"]
) {
  return yield* (yield* DatabaseReader)
    .table("ninaUploads")
    .get(uploadId)
    .pipe(
      Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
});

const save = FunctionImpl.make(
  schema,
  spec,
  "save",
  Effect.fn("nina.uploads.save")(
    function* (args) {
      yield* requireAuth();
      if (
        args.bytes.byteLength === 0 ||
        args.bytes.byteLength > NINA_FILE_SIZE
      ) {
        return yield* new NinaUploadError({
          code: "NINA_UPLOAD_INVALID",
          message: NINA_FILE_SIZE_MESSAGE,
        });
      }
      const { runMutation: mutate } = yield* MutationRunner;
      // The reservation seals the name first, so the component never stores the plain name.
      const { storedFilename, uploadId } = yield* mutate(
        refs.internal.nina.uploads.reserve,
        { filename: args.filename }
      );
      const ctx = yield* ActionCtx;
      yield* Effect.gen(function* () {
        // The Agent SDK owns storage, hashing, deduplication and file references.
        const { file } = yield* Effect.tryPromise({
          try: () =>
            storeFile(
              ctx,
              components.nina,
              new Blob([args.bytes], { type: args.mediaType }),
              { filename: storedFilename }
            ),
          catch: uploadFailure,
        });
        yield* mutate(refs.internal.nina.uploads.complete, {
          uploadId,
          fileId: file.fileId,
        });
      }).pipe(
        Effect.onExit((exit) =>
          Exit.isFailure(exit)
            ? mutate(refs.internal.nina.uploads.discard, { uploadId }).pipe(
                Effect.orDie
              )
            : Effect.void
        )
      );
      return uploadId;
    },
    Effect.catchTag("SchemaError", uploadFailure),
    Effect.catchDefect(uploadFailure)
  )
);

const reserve = FunctionImpl.make(
  schema,
  spec,
  "reserve",
  Effect.fn("nina.uploads.reserve")(function* (args) {
    const { appUser } = yield* requireAuth();
    const now = yield* Clock.currentTimeMillis;
    const pending = yield* (yield* DatabaseReader)
      .table("ninaUploads")
      .index("by_userId_and_expiresAt", (q) =>
        q.eq("userId", appUser._id).gt("expiresAt", now)
      )
      .take(NINA_FILE_COUNT)
      .pipe(Effect.orDie);
    if (pending.length >= NINA_FILE_COUNT) {
      return yield* new NinaUploadError({
        code: "NINA_UPLOAD_LIMIT",
        message:
          "Send or remove your pending attachments before uploading more.",
      });
    }
    const ctx = yield* MutationCtx;
    const quota = yield* Effect.tryPromise({
      try: () => uploadQuota.limit(ctx, "ninaUpload", { key: appUser._id }),
      catch: uploadFailure,
    });
    if (!quota.ok) {
      return yield* new NinaUploadError({
        code: "NINA_UPLOAD_LIMIT",
        message: "Too many uploads. Try again shortly.",
      });
    }
    const keys = yield* ensureLearnerKeys(appUser._id).pipe(Effect.orDie);
    const storedFilename = yield* sealFileName(keys, args.filename).pipe(
      Effect.orDie
    );
    const uploadId = yield* (yield* DatabaseWriter)
      .table("ninaUploads")
      .insert({
        userId: appUser._id,
        expiresAt: now + Duration.toMillis(NINA_UPLOAD_LIFETIME),
        state: { status: "uploading" },
      })
      .pipe(Effect.orDie);
    yield* (yield* Scheduler).runAfter(
      NINA_UPLOAD_LIFETIME,
      refs.internal.nina.uploads.discard,
      { uploadId }
    );
    return { storedFilename, uploadId };
  }, Effect.catchDefect(uploadFailure))
);

const complete = FunctionImpl.make(
  schema,
  spec,
  "complete",
  Effect.fn("nina.uploads.complete")(function* (args) {
    const { appUser } = yield* requireAuth();
    const now = yield* Clock.currentTimeMillis;
    const upload = yield* readUpload(args.uploadId);
    if (
      !upload ||
      upload.userId !== appUser._id ||
      upload.expiresAt <= now ||
      upload.state.status !== "uploading"
    ) {
      return yield* new NinaUploadError({
        code: "NINA_UPLOAD_INVALID",
        message: "This attachment is no longer available to send.",
      });
    }
    yield* (yield* DatabaseWriter)
      .table("ninaUploads")
      .patch(upload._id, {
        state: { status: "ready", fileId: args.fileId },
      })
      .pipe(Effect.orDie);
    return null;
  }, Effect.catchDefect(uploadFailure))
);

const discard = FunctionImpl.make(
  schema,
  spec,
  "discard",
  Effect.fn("nina.uploads.discard")(function* (args) {
    const upload = yield* readUpload(args.uploadId);
    if (upload) {
      yield* (yield* DatabaseWriter)
        .table("ninaUploads")
        .delete(upload._id)
        .pipe(Effect.orDie);
    }
    // Unused component files remain under the SDK's 24-hour ownership grace.
    return null;
  })
);

/**
 * Gives back the place of an upload the learner will not send, so it stops
 * counting toward the pending limit. Only the learner's own upload is
 * released. A message that was sent took its upload, so none is left to
 * release: that call is refused and the message keeps its file. The file
 * itself stays under the SDK's 24-hour ownership grace, as for `discard`.
 */
const release = FunctionImpl.make(
  schema,
  spec,
  "release",
  Effect.fn("nina.uploads.release")(function* (args) {
    const { appUser } = yield* requireAuth();
    const upload = yield* readUpload(args.uploadId);
    if (upload?.userId !== appUser._id) {
      return yield* new NinaUploadError({
        code: "NINA_UPLOAD_INVALID",
        message: "This attachment is no longer available.",
      });
    }
    yield* (yield* DatabaseWriter)
      .table("ninaUploads")
      .delete(upload._id)
      .pipe(Effect.orDie);
    return null;
  }, Effect.catchDefect(uploadFailure))
);

export default GroupImpl.make(schema, spec).pipe(
  Layer.provide(save),
  Layer.provide(release),
  Layer.provide(reserve),
  Layer.provide(complete),
  Layer.provide(discard),
  Layer.provide(session),
  GroupImpl.finalize
);
