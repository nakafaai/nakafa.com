import { Ref } from "@confect/core";
import type { Id } from "@repo/backend/confect/_generated/dataModel";
import refs from "@repo/backend/confect/_generated/refs";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { requireAppUser } from "@repo/backend/confect/modules/identity/auth.service";
import { ClassActionError } from "@repo/backend/confect/modules/school/classErrors";
import { loadOpenForumWithAccess } from "@repo/backend/confect/modules/school/forums/access.service";
import {
  deleteForumPendingUpload,
  validateForumAttachmentPolicy,
  validateStoredForumAttachmentMetadata,
} from "@repo/backend/confect/modules/school/forums/attachments.service";
import { MAX_FORUM_POST_ATTACHMENTS } from "@repo/backend/confect/modules/school/forums/constants";
import { Effect } from "effect";

const STALE_FORUM_PENDING_UPLOAD_MAX_AGE_MS = 2 * 60 * 60 * 1000;

/** Generates a pending forum attachment upload URL. */
export const generateUploadUrl = Effect.fn("school.forums.generateUploadUrl")(
  function* (args: { forumId: Id<"schoolClassForums"> }) {
    const ctx = yield* MutationCtx;
    const user = yield* requireAppUser(ctx);
    const userId = user.appUser._id;
    const { forum } = yield* loadOpenForumWithAccess(ctx, args.forumId, userId);
    const activePendingUploads = yield* Effect.promise(() =>
      ctx.db
        .query("schoolClassForumPendingUploads")
        .withIndex("by_forumId_and_uploadedBy", (query) =>
          query.eq("forumId", forum._id).eq("uploadedBy", userId)
        )
        .take(MAX_FORUM_POST_ATTACHMENTS)
    );

    if (activePendingUploads.length >= MAX_FORUM_POST_ATTACHMENTS) {
      return yield* Effect.fail(
        new ClassActionError({
          message: "Forum post attachment count exceeds the supported limit.",
        })
      );
    }

    const uploadUrl = yield* Effect.promise(() =>
      ctx.storage.generateUploadUrl()
    );
    const uploadId = yield* Effect.promise(() =>
      ctx.db.insert("schoolClassForumPendingUploads", {
        classId: forum.classId,
        forumId: forum._id,
        uploadedBy: userId,
      })
    );
    yield* Effect.promise(() =>
      ctx.scheduler.runAfter(
        STALE_FORUM_PENDING_UPLOAD_MAX_AGE_MS,
        Ref.getFunctionReference(
          refs.internal.classes.forums.internalMutations
            .deleteExpiredPendingUpload
        ),
        { uploadId }
      )
    );

    return { uploadId, uploadUrl };
  }
);

/** Saves metadata for a completed forum attachment upload. */
export const saveForumUpload = Effect.fn("school.forums.saveForumUpload")(
  function* (args: {
    name: string;
    size: number;
    storageId: Id<"_storage">;
    type: string;
    uploadId: Id<"schoolClassForumPendingUploads">;
  }) {
    const ctx = yield* MutationCtx;
    const user = yield* requireAppUser(ctx);
    const userId = user.appUser._id;
    const upload = yield* Effect.promise(() => ctx.db.get(args.uploadId));

    if (!upload || upload.uploadedBy !== userId) {
      return yield* Effect.fail(
        new ClassActionError({
          message: "Forum post attachment upload not found.",
        })
      );
    }

    yield* loadOpenForumWithAccess(ctx, upload.forumId, userId);

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
    yield* validateStoredForumAttachmentMetadata(ctx, {
      mimeType: args.type,
      size: args.size,
      storageId: args.storageId,
    });

    const matchingPendingUploads = yield* Effect.promise(() =>
      ctx.db
        .query("schoolClassForumPendingUploads")
        .withIndex("by_storageId", (query) =>
          query.eq("storageId", args.storageId)
        )
        .take(2)
    );
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

    const existingAttachment = yield* Effect.promise(() =>
      ctx.db
        .query("schoolClassForumPostAttachments")
        .withIndex("by_fileId", (query) => query.eq("fileId", args.storageId))
        .first()
    );

    if (existingAttachment) {
      return yield* Effect.fail(
        new ClassActionError({
          message: "Forum post attachment has already been used.",
        })
      );
    }

    yield* Effect.promise(() =>
      ctx.db.patch(args.uploadId, {
        mimeType: args.type,
        name: args.name,
        size: args.size,
        storageId: args.storageId,
      })
    );

    return args.uploadId;
  }
);

/** Discards pending forum uploads owned by the current user. */
export const discardForumUploads = Effect.fn(
  "school.forums.discardForumUploads"
)(function* (args: { uploadIds: Id<"schoolClassForumPendingUploads">[] }) {
  const ctx = yield* MutationCtx;
  const user = yield* requireAppUser(ctx);
  const userId = user.appUser._id;

  for (const uploadId of args.uploadIds) {
    const upload = yield* Effect.promise(() => ctx.db.get(uploadId));

    if (!upload || upload.uploadedBy !== userId) {
      continue;
    }

    yield* deleteForumPendingUpload(ctx, upload);
  }

  return null;
});

/** Removes a stale pending upload. */
export const deleteExpiredPendingUpload = Effect.fn(
  "school.forums.deleteExpiredPendingUpload"
)(function* (args: { uploadId: Id<"schoolClassForumPendingUploads"> }) {
  const ctx = yield* MutationCtx;
  const upload = yield* Effect.promise(() => ctx.db.get(args.uploadId));

  if (!upload) {
    return null;
  }

  yield* deleteForumPendingUpload(ctx, upload);
  return null;
});
