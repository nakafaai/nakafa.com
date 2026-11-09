import type { GenericId } from "@confect/core";
import { FunctionImpl, GroupImpl } from "@confect/server";
import bucketInternal from "@repo/backend/confect/_generated/refs/bucket.server";
import commentsInternal from "@repo/backend/confect/_generated/refs/comments.server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationRunner,
} from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import { reserveUpload } from "@repo/backend/confect/bucket/file";
import { inspectFile } from "@repo/backend/confect/bucket/stored";
import { CommentWriteError } from "@repo/backend/confect/comments/errors";
import spec from "@repo/backend/confect/comments/files.spec";
import {
  COMMENT_PHOTO_BYTE_LIMIT,
  COMMENT_THUMBNAIL_BYTE_LIMIT,
} from "@repo/backend/confect/comments/photo";
import { spendCommentWrite } from "@repo/backend/confect/comments/rate";
import { dropUpload } from "@repo/backend/confect/comments/unposted";
import { imageTypeOf } from "@repo/backend/confect/exams/image";
import session from "@repo/backend/confect/middleware/session.impl";
import { Array as Arr, Clock, Duration, Effect, Layer, Option } from "effect";

/** A file of the bucket that a photo names. */
type FileId = GenericId.GenericId<"bucketFiles">;

/** The leading bytes the server reads of a file, which name its kind of image. */
const HEAD_BYTES = 16;

/** How long a photo may wait for its comment, which covers a learner who leaves a draft overnight. */
const UNPOSTED_LIFETIME = Duration.days(1);

/** How many unposted photos one daily sweep deletes. What stays waits for the next day, so a sweep's size stays bounded. */
const SWEEP_BATCH = 256;

/** The refusal of a photo whose bytes never arrived or are no image. */
const refused = () =>
  new CommentWriteError({
    code: "COMMENT_PHOTO_REFUSED",
    message: "The photo must be a PNG, JPEG, WebP or GIF image.",
  });

/** The refusal of a photo, or its small copy, past its size limit. */
const tooLarge = () =>
  new CommentWriteError({
    code: "COMMENT_PHOTO_TOO_LARGE",
    message: "The photo is too large.",
  });

/**
 * Reserves one file of a photo, the photo or its small copy, before any byte moves: a file over the photo
 * limit is refused, and any other answers the R2 address it is uploaded to, which binds its length and type.
 */
const reserve = FunctionImpl.make(
  databaseSchema,
  spec,
  "reserve",
  Effect.fn("comments.files.reserve")(function* ({ byteSize, contentType }) {
    const user = yield* requireAuth();
    if (byteSize > COMMENT_PHOTO_BYTE_LIMIT) {
      return yield* tooLarge();
    }
    yield* spendCommentWrite("commentPhoto", user.appUser._id);
    return yield* reserveUpload({ byteSize, contentType, tenantId: null });
  })
);

/** Deletes the files of a refused photo, so a refused file is never stored. */
const discardAll = (files: readonly FileId[]) =>
  Effect.gen(function* () {
    const { runMutation } = yield* MutationRunner;
    yield* Effect.forEach(files, (fileId) =>
      runMutation(bucketInternal.discard, { fileId })
    );
  });

/**
 * Registers an uploaded photo as one its learner may post. The leading bytes name the image, whatever its
 * declared type says, and its small copy must be an image too. A photo that passes waits for its comment;
 * any other is deleted with its small copy, and the refusal names why.
 */
const register = FunctionImpl.make(
  databaseSchema,
  spec,
  "register",
  Effect.fn("comments.files.register")(
    function* ({ fileId, height, thumbnailId, width }) {
      const user = yield* requireAuth();
      const files = Arr.appendAll(
        [fileId],
        thumbnailId === null ? [] : [thumbnailId]
      );
      const stored = yield* inspectFile(fileId, HEAD_BYTES);
      const small =
        thumbnailId === null
          ? Option.none()
          : yield* inspectFile(thumbnailId, HEAD_BYTES);
      if (
        Option.isNone(stored) ||
        (thumbnailId !== null && Option.isNone(small))
      ) {
        yield* discardAll(files);
        return yield* refused();
      }
      if (
        stored.value.byteSize > COMMENT_PHOTO_BYTE_LIMIT ||
        Option.exists(
          small,
          (copy) => copy.byteSize > COMMENT_THUMBNAIL_BYTE_LIMIT
        )
      ) {
        yield* discardAll(files);
        return yield* tooLarge();
      }
      if (
        Option.isNone(imageTypeOf(stored.value.head)) ||
        Option.exists(small, (copy) => Option.isNone(imageTypeOf(copy.head)))
      ) {
        yield* discardAll(files);
        return yield* refused();
      }
      const { runMutation } = yield* MutationRunner;
      return yield* runMutation(commentsInternal.files.commit, {
        fileId,
        height,
        thumbnailId,
        userId: user.appUser._id,
        width,
      });
    },
    // The runner decodes the server's own answer, so a decode failure is a defect.
    Effect.catchTag("SchemaError", Effect.die)
  )
);

/** Stores a registered photo for its learner. Its bytes were charged at its reservation. */
const commit = FunctionImpl.make(
  databaseSchema,
  spec,
  "commit",
  Effect.fn("comments.files.commit")(function* ({
    fileId,
    height,
    thumbnailId,
    userId,
    width,
  }) {
    return yield* (yield* DatabaseWriter)
      .table("commentUploads")
      .insert({
        createdAt: yield* Clock.currentTimeMillis,
        fileId,
        height,
        userId,
        width,
        ...(thumbnailId === null ? {} : { thumbnailId }),
      })
      .pipe(Effect.orDie);
  })
);

/** Takes back a photo its learner has not posted. Another learner's photo is refused as a gone one. */
const withdraw = FunctionImpl.make(
  databaseSchema,
  spec,
  "withdraw",
  Effect.fn("comments.files.withdraw")(function* ({ uploadId }) {
    const user = yield* requireAuth();
    const upload = yield* (yield* DatabaseReader)
      .table("commentUploads")
      .get(uploadId)
      .pipe(Effect.option);
    if (Option.isNone(upload) || upload.value.userId !== user.appUser._id) {
      return yield* new CommentWriteError({
        code: "COMMENT_UPLOAD_GONE",
        message: "The photo is gone.",
      });
    }
    yield* dropUpload(upload.value);
    return null;
  })
);

/** Deletes the photos that stayed unposted past their lifetime. */
const sweep = FunctionImpl.make(
  databaseSchema,
  spec,
  "sweep",
  Effect.fn("comments.files.sweep")(function* () {
    const now = yield* Clock.currentTimeMillis;
    const stale = yield* (yield* DatabaseReader)
      .table("commentUploads")
      .index("by_createdAt", (query) =>
        query.lt("createdAt", now - Duration.toMillis(UNPOSTED_LIFETIME))
      )
      .take(SWEEP_BATCH)
      .pipe(Effect.orDie);
    yield* Effect.forEach(stale, dropUpload);
    return { deleted: stale.length };
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(reserve),
  Layer.provide(register),
  Layer.provide(commit),
  Layer.provide(withdraw),
  Layer.provide(sweep),
  Layer.provide(session),
  GroupImpl.finalize
);
