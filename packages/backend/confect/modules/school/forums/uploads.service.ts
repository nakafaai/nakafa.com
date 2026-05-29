import type { Id } from "@repo/backend/confect/_generated/dataModel";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
  StorageWriter,
} from "@repo/backend/confect/_generated/services";
import { requireAppUser } from "@repo/backend/confect/modules/identity/auth/session.service";
import { ClassActionError } from "@repo/backend/confect/modules/school/classErrors";
import { loadOpenForumWithAccess } from "@repo/backend/confect/modules/school/forums/access.service";
import {
  deleteForumPendingUpload,
  validateForumAttachmentPolicy,
  validateStoredForumAttachmentMetadata,
} from "@repo/backend/confect/modules/school/forums/attachments.service";
import { MAX_FORUM_POST_ATTACHMENTS } from "@repo/backend/confect/modules/school/forums/constants";
import { Duration, Effect, Option } from "effect";

const STALE_FORUM_PENDING_UPLOAD_MAX_AGE_MS = 2 * 60 * 60 * 1000;

/** Generates a pending forum attachment upload URL. */
export const generateUploadUrl = Effect.fnUntraced(function* (args: {
  forumId: Id<"schoolClassForums">;
}) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const scheduler = yield* Scheduler;
  const storage = yield* StorageWriter;
  const user = yield* requireAppUser();
  const userId = user.appUser._id;
  const { forum } = yield* loadOpenForumWithAccess(args.forumId, userId);
  const activePendingUploads = yield* reader
    .table("schoolClassForumPendingUploads")
    .index("by_forumId_and_uploadedBy", (query) =>
      query.eq("forumId", forum._id).eq("uploadedBy", userId)
    )
    .take(MAX_FORUM_POST_ATTACHMENTS);

  if (activePendingUploads.length >= MAX_FORUM_POST_ATTACHMENTS) {
    return yield* Effect.fail(
      new ClassActionError({
        message: "Forum post attachment count exceeds the supported limit.",
      })
    );
  }

  const uploadUrl = yield* storage.generateUploadUrl();
  const uploadId = yield* writer
    .table("schoolClassForumPendingUploads")
    .insert({
      classId: forum.classId,
      forumId: forum._id,
      uploadedBy: userId,
    });
  yield* scheduler.runAfter(
    Duration.millis(STALE_FORUM_PENDING_UPLOAD_MAX_AGE_MS),
    refs.internal.classes.forums.internalMutations.deleteExpiredPendingUpload,
    { uploadId }
  );

  return { uploadId, uploadUrl: uploadUrl.toString() };
});

/** Saves metadata for a completed forum attachment upload. */
export const saveForumUpload = Effect.fnUntraced(function* (args: {
  name: string;
  size: number;
  storageId: Id<"_storage">;
  type: string;
  uploadId: Id<"schoolClassForumPendingUploads">;
}) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const user = yield* requireAppUser();
  const userId = user.appUser._id;
  const upload = yield* reader
    .table("schoolClassForumPendingUploads")
    .get(args.uploadId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

  if (!upload || upload.uploadedBy !== userId) {
    return yield* Effect.fail(
      new ClassActionError({
        message: "Forum post attachment upload not found.",
      })
    );
  }

  yield* loadOpenForumWithAccess(upload.forumId, userId);

  if (
    upload.storageId === args.storageId &&
    upload.name === args.name &&
    upload.mimeType === args.type &&
    upload.size === args.size
  ) {
    return upload._id;
  }

  if (upload.storageId) {
    return yield* Effect.fail(
      new ClassActionError({
        message: "Forum post attachment upload has already been finalized.",
      })
    );
  }

  yield* validateForumAttachmentPolicy({
    mimeType: args.type,
    name: args.name,
    size: args.size,
  });
  yield* validateStoredForumAttachmentMetadata({
    mimeType: args.type,
    size: args.size,
    storageId: args.storageId,
  });

  const matchingPendingUploads = yield* reader
    .table("schoolClassForumPendingUploads")
    .index("by_storageId", (query) => query.eq("storageId", args.storageId))
    .take(2);
  const conflictingPendingUpload = matchingPendingUploads.find(
    (pendingUpload) => pendingUpload._id !== args.uploadId
  );

  if (conflictingPendingUpload) {
    return yield* Effect.fail(
      new ClassActionError({
        message: "Forum post attachment upload has already been claimed.",
      })
    );
  }

  const existingAttachment = yield* reader
    .table("schoolClassForumPostAttachments")
    .index("by_fileId", (query) => query.eq("fileId", args.storageId))
    .first()
    .pipe(Effect.map(Option.getOrNull));

  if (existingAttachment) {
    return yield* Effect.fail(
      new ClassActionError({
        message: "Forum post attachment has already been used.",
      })
    );
  }

  yield* writer.table("schoolClassForumPendingUploads").patch(args.uploadId, {
    mimeType: args.type,
    name: args.name,
    size: args.size,
    storageId: args.storageId,
  });

  return args.uploadId;
});

/** Discards pending forum uploads owned by the current user. */
export const discardForumUploads = Effect.fnUntraced(function* (args: {
  readonly uploadIds: readonly Id<"schoolClassForumPendingUploads">[];
}) {
  const reader = yield* DatabaseReader;
  const user = yield* requireAppUser();
  const userId = user.appUser._id;

  for (const uploadId of args.uploadIds) {
    const upload = yield* reader
      .table("schoolClassForumPendingUploads")
      .get(uploadId)
      .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

    if (!upload || upload.uploadedBy !== userId) {
      continue;
    }

    yield* deleteForumPendingUpload(upload);
  }

  return null;
});

/** Removes a stale pending upload. */
export const deleteExpiredPendingUpload = Effect.fnUntraced(function* (args: {
  uploadId: Id<"schoolClassForumPendingUploads">;
}) {
  const reader = yield* DatabaseReader;
  const upload = yield* reader
    .table("schoolClassForumPendingUploads")
    .get(args.uploadId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

  if (!upload) {
    return null;
  }

  yield* deleteForumPendingUpload(upload);
  return null;
});
