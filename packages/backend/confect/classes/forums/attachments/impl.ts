import {
  DatabaseReader,
  DatabaseWriter,
  StorageWriter,
} from "@repo/backend/confect/_generated/services";
import {
  ForumAttachmentError,
  type ForumAttachmentErrorCode,
  ForumAttachmentIoError,
  type ForumAttachmentMetadataInput,
  type ForumAttachmentPolicyInput,
  type ForumAttachmentStorageClaimInput,
  type ForumAttachmentUpload,
  type ForumPendingUploadDoc,
  forumAttachmentAlreadyAttachedCode,
  forumAttachmentAlreadyClaimedCode,
  forumAttachmentDuplicateCode,
  forumAttachmentIncompleteCode,
  forumAttachmentIoFailedCode,
  forumAttachmentMetadataMismatchCode,
  forumAttachmentNameInvalidCode,
  forumAttachmentNotFoundCode,
  forumAttachmentTooLargeCode,
  forumAttachmentTypeUnsupportedCode,
  forumAttachmentUploadNotFoundCode,
} from "@repo/backend/confect/classes/forums/attachments/spec";
import {
  FORUM_ATTACHMENT_ALLOWED_EXTENSIONS,
  FORUM_ATTACHMENT_ALLOWED_MIME_TYPES,
  MAX_FORUM_ATTACHMENT_BYTES,
} from "@repo/backend/confect/classes/forums/constants";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Array as Arr, Effect, flow, Option } from "effect";

function hasAllowedForumAttachmentMimeType(mimeType: string) {
  if (mimeType.startsWith("image/")) {
    return true;
  }
  return Arr.some(
    FORUM_ATTACHMENT_ALLOWED_MIME_TYPES,
    (allowedMimeType) => allowedMimeType === mimeType
  );
}
function hasAllowedForumAttachmentExtension(fileName: string) {
  const normalizedFileName = fileName.trim().toLowerCase();
  return Arr.some(FORUM_ATTACHMENT_ALLOWED_EXTENSIONS, (extension) =>
    normalizedFileName.endsWith(extension)
  );
}
function failForumAttachment(code: ForumAttachmentErrorCode, message: string) {
  return Effect.fail(
    new ForumAttachmentError({
      code,
      message,
    })
  );
}
function toForumAttachmentIoError(cause: unknown) {
  return new ForumAttachmentIoError({
    cause,
    code: forumAttachmentIoFailedCode,
    message: "Could not read or update the forum attachment.",
  });
}

/**
 * Enforce the supported forum attachment size and mime policy server-side.
 *
 * @see https://effect.website/docs/error-management/expected-errors/
 */
export const validateForumAttachmentPolicy = Effect.fn(
  "classes.forums.attachments.validateForumAttachmentPolicy"
)(function* ({ mimeType, name, size }: ForumAttachmentPolicyInput) {
  if (name.trim().length === 0) {
    return yield* failForumAttachment(
      forumAttachmentNameInvalidCode,
      "Forum post attachment must have a filename."
    );
  }
  if (size > MAX_FORUM_ATTACHMENT_BYTES) {
    return yield* failForumAttachment(
      forumAttachmentTooLargeCode,
      "Forum post attachment exceeds the supported size limit."
    );
  }
  if (hasAllowedForumAttachmentMimeType(mimeType)) {
    return;
  }
  if (
    mimeType === "application/octet-stream" &&
    hasAllowedForumAttachmentExtension(name)
  ) {
    return;
  }
  return yield* failForumAttachment(
    forumAttachmentTypeUnsupportedCode,
    "Forum post attachment type is not supported."
  );
});

/**
 * Reject duplicate pending upload IDs in one forum post submission.
 */
const ensureDistinctUploadIds = Effect.fn(
  "classes.forums.attachments.ensureDistinctUploadIds"
)(function* (uploadIds: Id<"schoolClassForumPendingUploads">[]) {
  const seenUploadIds = new Set<Id<"schoolClassForumPendingUploads">>();
  for (const uploadId of uploadIds) {
    if (!seenUploadIds.has(uploadId)) {
      seenUploadIds.add(uploadId);
      continue;
    }
    return yield* failForumAttachment(
      forumAttachmentDuplicateCode,
      "Forum post attachments must reference distinct uploads."
    );
  }
});

/**
 * Verify that the stored file still matches the finalized upload metadata.
 */
export const validateStoredForumAttachmentMetadata = Effect.fn(
  "classes.forums.attachments.validateStoredForumAttachmentMetadata"
)(function* ({ size, storageId }: ForumAttachmentMetadataInput) {
  const metadata = yield* (yield* DatabaseReader)
    .table("_storage")
    .get(storageId)
    .pipe(
      Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
      Effect.mapError(toForumAttachmentIoError),
      Effect.catchDefect(flow(toForumAttachmentIoError, Effect.fail))
    );
  if (!metadata) {
    return yield* failForumAttachment(
      forumAttachmentNotFoundCode,
      "Forum post attachment not found."
    );
  }
  if (metadata.size === size) {
    return;
  }
  return yield* failForumAttachment(
    forumAttachmentMetadataMismatchCode,
    "Forum post attachment metadata no longer matches the upload."
  );
});

/**
 * Ensure one storage object has not already been claimed by another upload or
 * attached to an existing post.
 */
export const validateForumAttachmentStorageClaim = Effect.fn(
  "classes.forums.attachments.validateForumAttachmentStorageClaim"
)(
  function* ({ storageId, uploadId }: ForumAttachmentStorageClaimInput) {
    const database = yield* DatabaseReader;
    const matchingPendingUploads = yield* database
      .table("schoolClassForumPendingUploads")
      .index("by_storageId", (q) => q.eq("storageId", storageId))
      .take(2)
      .pipe(Effect.orDie);
    const conflictingPendingUpload = Option.getOrUndefined(
      Arr.findFirst(
        matchingPendingUploads,
        (pendingUpload) => pendingUpload._id !== uploadId
      )
    );
    if (conflictingPendingUpload) {
      return yield* failForumAttachment(
        forumAttachmentAlreadyClaimedCode,
        "Forum post attachment upload has already been claimed."
      );
    }
    const existingAttachment = yield* database
      .table("schoolClassForumPostAttachments")
      .index("by_fileId", (q) => q.eq("fileId", storageId))
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie);
    if (existingAttachment) {
      return yield* failForumAttachment(
        forumAttachmentAlreadyAttachedCode,
        "Forum post attachment has already been used."
      );
    }
  },
  Effect.catchDefect(flow(toForumAttachmentIoError, Effect.fail))
);

/**
 * Narrow one pending upload document to a fully finalized attachment upload.
 */
function isForumAttachmentUpload(
  upload: ForumPendingUploadDoc
): upload is ForumAttachmentUpload {
  return (
    Boolean(upload.storageId) &&
    Boolean(upload.mimeType) &&
    Boolean(upload.name) &&
    upload.size !== undefined
  );
}

/** Loads one pending upload through the typed attachment error channel. */
const getPendingUpload = Effect.fn(
  "classes.forums.attachments.getPendingUpload"
)(
  function* (uploadId: Id<"schoolClassForumPendingUploads">) {
    const database = yield* DatabaseReader;
    return yield* database
      .table("schoolClassForumPendingUploads")
      .get(uploadId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
  },
  Effect.catchDefect(flow(toForumAttachmentIoError, Effect.fail))
);

/**
 * Resolve finalized upload claims for one forum post submission.
 */
export const resolveForumAttachmentUploads = Effect.fn(
  "classes.forums.attachments.resolveForumAttachmentUploads"
)(function* ({
  forumId,
  uploadIds,
  userId,
}: {
  forumId: Id<"schoolClassForums">;
  uploadIds: Id<"schoolClassForumPendingUploads">[];
  userId: Id<"users">;
}) {
  yield* ensureDistinctUploadIds(uploadIds);
  const uploads = yield* Effect.forEach(uploadIds, (uploadId) =>
    getPendingUpload(uploadId)
  );
  let finalizedUploads: ForumAttachmentUpload[] = [];
  for (const upload of uploads) {
    if (!upload || upload.uploadedBy !== userId || upload.forumId !== forumId) {
      return yield* failForumAttachment(
        forumAttachmentUploadNotFoundCode,
        "Forum post attachment upload not found."
      );
    }
    if (!isForumAttachmentUpload(upload)) {
      return yield* failForumAttachment(
        forumAttachmentIncompleteCode,
        "Forum post attachment upload has not finished yet."
      );
    }
    const finalizedUpload: ForumAttachmentUpload = upload;
    yield* validateForumAttachmentPolicy(finalizedUpload);
    yield* validateStoredForumAttachmentMetadata(finalizedUpload);
    finalizedUploads = Arr.append(finalizedUploads, finalizedUpload);
  }
  return finalizedUploads;
});

/**
 * Delete one pending forum upload and remove its storage file when nothing else
 * references it.
 */
export const deleteForumPendingUpload = Effect.fn(
  "classes.forums.attachments.deleteForumPendingUpload"
)(
  function* (upload: ForumPendingUploadDoc) {
    const storageWriter = yield* StorageWriter;
    const database = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const storageId = upload.storageId;
    if (storageId) {
      const existingAttachment = yield* database
        .table("schoolClassForumPostAttachments")
        .index("by_fileId", (q) => q.eq("fileId", storageId))
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      const metadata = yield* (yield* DatabaseReader)
        .table("_storage")
        .get(storageId)
        .pipe(
          Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
          Effect.mapError(toForumAttachmentIoError)
        );
      if (!(existingAttachment || !metadata)) {
        yield* storageWriter
          .delete(storageId)
          .pipe(Effect.mapError(toForumAttachmentIoError));
      }
    }
    yield* writer.table("schoolClassForumPendingUploads").delete(upload._id);
  },
  Effect.catchDefect(flow(toForumAttachmentIoError, Effect.fail))
);
