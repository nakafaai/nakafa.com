import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
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
  forumAttachmentNotFoundCode,
  forumAttachmentTooLargeCode,
  forumAttachmentTypeUnsupportedCode,
  forumAttachmentUploadNotFoundCode,
} from "@repo/backend/convex/classes/forums/attachments/spec";
import {
  FORUM_ATTACHMENT_ALLOWED_EXTENSIONS,
  FORUM_ATTACHMENT_ALLOWED_MIME_TYPES,
  MAX_FORUM_ATTACHMENT_BYTES,
} from "@repo/backend/convex/classes/forums/utils/constants";
import { getUnknownErrorMessage } from "@repo/backend/convex/lib/effect";
import { Effect } from "effect";

function hasAllowedForumAttachmentMimeType(mimeType: string) {
  if (mimeType.startsWith("image/")) {
    return true;
  }

  return FORUM_ATTACHMENT_ALLOWED_MIME_TYPES.some(
    (allowedMimeType) => allowedMimeType === mimeType
  );
}

function hasAllowedForumAttachmentExtension(fileName: string) {
  const normalizedFileName = fileName.trim().toLowerCase();

  return FORUM_ATTACHMENT_ALLOWED_EXTENSIONS.some((extension) =>
    normalizedFileName.endsWith(extension)
  );
}

function failForumAttachment(code: ForumAttachmentErrorCode, message: string) {
  return Effect.fail(new ForumAttachmentError({ code, message }));
}

function toForumAttachmentIoError(error: unknown) {
  return new ForumAttachmentIoError({
    code: forumAttachmentIoFailedCode,
    message: getUnknownErrorMessage(error),
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
)(function* (
  ctx: MutationCtx,
  { mimeType, size, storageId }: ForumAttachmentMetadataInput
) {
  const metadata = yield* Effect.tryPromise({
    try: () => ctx.db.system.get("_storage", storageId),
    catch: toForumAttachmentIoError,
  });

  if (!metadata) {
    return yield* failForumAttachment(
      forumAttachmentNotFoundCode,
      "Forum post attachment not found."
    );
  }

  const contentType = metadata.contentType ?? "";

  if (metadata.size === size && contentType === mimeType) {
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
)(function* (
  ctx: MutationCtx,
  { storageId, uploadId }: ForumAttachmentStorageClaimInput
) {
  const matchingPendingUploads = yield* Effect.tryPromise({
    try: () =>
      ctx.db
        .query("schoolClassForumPendingUploads")
        .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
        .take(2),
    catch: toForumAttachmentIoError,
  });
  const conflictingPendingUpload = matchingPendingUploads.find(
    (pendingUpload) => pendingUpload._id !== uploadId
  );

  if (conflictingPendingUpload) {
    return yield* failForumAttachment(
      forumAttachmentAlreadyClaimedCode,
      "Forum post attachment upload has already been claimed."
    );
  }

  const existingAttachment = yield* Effect.tryPromise({
    try: () =>
      ctx.db
        .query("schoolClassForumPostAttachments")
        .withIndex("by_fileId", (q) => q.eq("fileId", storageId))
        .first(),
    catch: toForumAttachmentIoError,
  });

  if (existingAttachment) {
    return yield* failForumAttachment(
      forumAttachmentAlreadyAttachedCode,
      "Forum post attachment has already been used."
    );
  }
});

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
)(function* (ctx: MutationCtx, uploadId: Id<"schoolClassForumPendingUploads">) {
  return yield* Effect.tryPromise({
    try: () => ctx.db.get("schoolClassForumPendingUploads", uploadId),
    catch: toForumAttachmentIoError,
  });
});

/**
 * Resolve finalized upload claims for one forum post submission.
 */
export const resolveForumAttachmentUploads = Effect.fn(
  "classes.forums.attachments.resolveForumAttachmentUploads"
)(function* (
  ctx: MutationCtx,
  {
    forumId,
    uploadIds,
    userId,
  }: {
    forumId: Id<"schoolClassForums">;
    uploadIds: Id<"schoolClassForumPendingUploads">[];
    userId: Id<"users">;
  }
) {
  yield* ensureDistinctUploadIds(uploadIds);

  const uploads = yield* Effect.forEach(uploadIds, (uploadId) =>
    getPendingUpload(ctx, uploadId)
  );

  const finalizedUploads: ForumAttachmentUpload[] = [];

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
    yield* validateStoredForumAttachmentMetadata(ctx, finalizedUpload);
    finalizedUploads.push(finalizedUpload);
  }

  return finalizedUploads;
});

/**
 * Delete one pending forum upload and remove its storage file when nothing else
 * references it.
 */
export const deleteForumPendingUpload = Effect.fn(
  "classes.forums.attachments.deleteForumPendingUpload"
)(function* (ctx: MutationCtx, upload: ForumPendingUploadDoc) {
  const storageId = upload.storageId;

  if (storageId) {
    const existingAttachment = yield* Effect.tryPromise({
      try: () =>
        ctx.db
          .query("schoolClassForumPostAttachments")
          .withIndex("by_fileId", (q) => q.eq("fileId", storageId))
          .first(),
      catch: toForumAttachmentIoError,
    });
    const metadata = yield* Effect.tryPromise({
      try: () => ctx.db.system.get("_storage", storageId),
      catch: toForumAttachmentIoError,
    });

    if (!(existingAttachment || !metadata)) {
      yield* Effect.tryPromise({
        try: () => ctx.storage.delete(storageId),
        catch: toForumAttachmentIoError,
      });
    }
  }

  yield* Effect.tryPromise({
    try: () => ctx.db.delete("schoolClassForumPendingUploads", upload._id),
    catch: toForumAttachmentIoError,
  });
});
