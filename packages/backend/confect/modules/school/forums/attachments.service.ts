import type { Doc, Id } from "@repo/backend/confect/_generated/dataModel";
import {
  DatabaseReader,
  DatabaseWriter,
  StorageWriter,
} from "@repo/backend/confect/_generated/services";
import { ClassActionError } from "@repo/backend/confect/modules/school/classErrors";
import {
  FORUM_ATTACHMENT_ALLOWED_EXTENSIONS,
  FORUM_ATTACHMENT_ALLOWED_MIME_TYPES,
  MAX_FORUM_ATTACHMENT_BYTES,
} from "@repo/backend/confect/modules/school/forums/constants";
import { Effect, Option } from "effect";

type FinalizedPendingUpload = Doc<"schoolClassForumPendingUploads"> & {
  readonly mimeType: string;
  readonly name: string;
  readonly size: number;
  readonly storageId: Id<"_storage">;
};

/** Checks whether a MIME type is allowed for forum attachments. */
function hasAllowedForumAttachmentMimeType(mimeType: string) {
  if (mimeType.startsWith("image/")) {
    return true;
  }

  return FORUM_ATTACHMENT_ALLOWED_MIME_TYPES.some(
    (allowedMimeType) => allowedMimeType === mimeType
  );
}

/** Checks whether a file name has an allowed fallback extension. */
function hasAllowedForumAttachmentExtension(fileName: string) {
  const normalizedFileName = fileName.trim().toLowerCase();

  return FORUM_ATTACHMENT_ALLOWED_EXTENSIONS.some((extension) =>
    normalizedFileName.endsWith(extension)
  );
}

/** Validates size and type limits for forum attachments. */
export function validateForumAttachmentPolicy(args: {
  readonly mimeType: string;
  readonly name: string;
  readonly size: number;
}) {
  if (args.size > MAX_FORUM_ATTACHMENT_BYTES) {
    return Effect.fail(
      new ClassActionError({
        message: "Forum post attachment exceeds the supported size limit.",
      })
    );
  }

  if (hasAllowedForumAttachmentMimeType(args.mimeType)) {
    return Effect.succeed(null);
  }

  if (
    args.mimeType === "application/octet-stream" &&
    hasAllowedForumAttachmentExtension(args.name)
  ) {
    return Effect.succeed(null);
  }

  return Effect.fail(
    new ClassActionError({
      message: "Forum post attachment type is not supported.",
    })
  );
}

/** Fails when attachment upload ids contain duplicates. */
function ensureDistinctUploadIds(
  uploadIds: readonly Id<"schoolClassForumPendingUploads">[]
) {
  const seenUploadIds = new Set<Id<"schoolClassForumPendingUploads">>();

  for (const uploadId of uploadIds) {
    if (!seenUploadIds.has(uploadId)) {
      seenUploadIds.add(uploadId);
      continue;
    }

    return Effect.fail(
      new ClassActionError({
        message: "Forum post attachments must reference distinct uploads.",
      })
    );
  }

  return Effect.succeed(null);
}

/** Verifies that Convex storage metadata still matches saved upload metadata. */
export const validateStoredForumAttachmentMetadata = Effect.fn(
  "school.forums.validateStoredForumAttachmentMetadata"
)(function* (args: {
  readonly mimeType: string;
  readonly size: number;
  readonly storageId: Id<"_storage">;
}) {
  const reader = yield* DatabaseReader;
  const metadata = yield* reader
    .table("_storage")
    .get(args.storageId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

  if (!metadata) {
    return yield* Effect.fail(
      new ClassActionError({ message: "Forum post attachment not found." })
    );
  }

  const contentType = metadata.contentType ?? "";
  if (metadata.size === args.size && contentType === args.mimeType) {
    return null;
  }

  return yield* Effect.fail(
    new ClassActionError({
      message: "Forum post attachment metadata no longer matches the upload.",
    })
  );
});

/** Checks whether a pending upload has all finalized metadata. */
function isForumAttachmentUpload(
  upload: Doc<"schoolClassForumPendingUploads">
): upload is FinalizedPendingUpload {
  return (
    upload.storageId !== undefined &&
    upload.mimeType !== undefined &&
    upload.name !== undefined &&
    upload.size !== undefined
  );
}

/** Loads and validates pending uploads referenced by a post. */
export const resolveForumAttachmentUploads = Effect.fn(
  "school.forums.resolveForumAttachmentUploads"
)(function* (args: {
  readonly forumId: Id<"schoolClassForums">;
  readonly uploadIds: readonly Id<"schoolClassForumPendingUploads">[];
  readonly userId: Id<"users">;
}) {
  const reader = yield* DatabaseReader;

  yield* ensureDistinctUploadIds(args.uploadIds);
  return yield* Effect.forEach(args.uploadIds, (uploadId) =>
    Effect.gen(function* () {
      const upload = yield* reader
        .table("schoolClassForumPendingUploads")
        .get(uploadId)
        .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

      if (
        !upload ||
        upload.uploadedBy !== args.userId ||
        upload.forumId !== args.forumId
      ) {
        return yield* Effect.fail(
          new ClassActionError({
            message: "Forum post attachment upload not found.",
          })
        );
      }

      if (!isForumAttachmentUpload(upload)) {
        return yield* Effect.fail(
          new ClassActionError({
            message: "Forum post attachment upload has not finished yet.",
          })
        );
      }

      yield* validateForumAttachmentPolicy(upload);
      yield* validateStoredForumAttachmentMetadata(upload);
      return upload;
    })
  );
});

/** Removes a pending upload and its orphaned storage file when needed. */
export const deleteForumPendingUpload = Effect.fn(
  "school.forums.deleteForumPendingUpload"
)(function* (upload: Doc<"schoolClassForumPendingUploads">) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const storage = yield* StorageWriter;
  const storageId = upload.storageId;

  if (storageId) {
    const existingAttachment = yield* reader
      .table("schoolClassForumPostAttachments")
      .index("by_fileId", (query) => query.eq("fileId", storageId))
      .first()
      .pipe(Effect.map(Option.getOrNull));
    const metadata = yield* reader
      .table("_storage")
      .get(storageId)
      .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

    if (!(existingAttachment || !metadata)) {
      yield* storage
        .delete(storageId)
        .pipe(Effect.catchTag("BlobNotFoundError", () => Effect.succeed(null)));
    }
  }

  yield* writer.table("schoolClassForumPendingUploads").delete(upload._id);
  return null;
});
