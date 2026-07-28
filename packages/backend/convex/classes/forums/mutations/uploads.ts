import { internal } from "@repo/backend/convex/_generated/api";
import { isAccountDeletionPending } from "@repo/backend/convex/auth/deletion/state";
import { FORUM_PENDING_UPLOAD_EXPIRATION_MS } from "@repo/backend/convex/classes/forums/attachments/constants";
import {
  deleteForumPendingUpload,
  validateForumAttachmentPolicy,
  validateForumAttachmentStorageClaim,
  validateStoredForumAttachmentMetadata,
} from "@repo/backend/convex/classes/forums/attachments/impl";
import { forumAttachmentMetadataMismatchCode } from "@repo/backend/convex/classes/forums/attachments/spec";
import { createForumAttachmentUploadUrl } from "@repo/backend/convex/classes/forums/attachments/upload";
import { loadOpenForumWithAccess } from "@repo/backend/convex/classes/forums/utils/access";
import { MAX_FORUM_POST_ATTACHMENTS } from "@repo/backend/convex/classes/forums/utils/constants";
import { forumUploadUrlResultValidator } from "@repo/backend/convex/classes/forums/validators";
import { mutation } from "@repo/backend/convex/functions";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { generateId } from "@repo/backend/convex/utils/id";
import { ConvexError, v } from "convex/values";

/**
 * Create an upload URL for one new forum post attachment.
 */
export const generateUploadUrl = mutation({
  args: {
    forumId: vv.id("schoolClassForums"),
  },
  returns: forumUploadUrlResultValidator,
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const userId = user.appUser._id;
    const { forum } = await loadOpenForumWithAccess(ctx, args.forumId, userId);
    const activePendingUploads = await ctx.db
      .query("schoolClassForumPendingUploads")
      .withIndex("by_forumId_and_uploadedBy", (q) =>
        q.eq("forumId", forum._id).eq("uploadedBy", userId)
      )
      .take(MAX_FORUM_POST_ATTACHMENTS);

    if (activePendingUploads.length >= MAX_FORUM_POST_ATTACHMENTS) {
      throw new ConvexError({
        code: "FORUM_ATTACHMENT_LIMIT_EXCEEDED",
        message: "Forum post attachment count exceeds the supported limit.",
      });
    }

    const uploadToken = generateId();
    const uploadId = await ctx.db.insert("schoolClassForumPendingUploads", {
      classId: forum.classId,
      forumId: forum._id,
      uploadToken,
      uploadedBy: userId,
    });

    await ctx.scheduler.runAfter(
      FORUM_PENDING_UPLOAD_EXPIRATION_MS,
      internal.classes.forums.internalMutations.deleteExpiredPendingUpload,
      { uploadId }
    );
    const uploadUrl = await runConvexProgram(
      createForumAttachmentUploadUrl(uploadId, uploadToken)
    );

    return {
      uploadId,
      uploadUrl,
    };
  },
});

/**
 * Finalize one uploaded file so it can be attached to a forum post.
 */
export const saveForumUpload = mutation({
  args: {
    uploadId: vv.id("schoolClassForumPendingUploads"),
    storageId: v.id("_storage"),
    name: v.string(),
    size: v.number(),
    type: v.string(),
  },
  returns: vv.id("schoolClassForumPendingUploads"),
  handler: async (ctx, args) => {
    const upload = await ctx.db.get(
      "schoolClassForumPendingUploads",
      args.uploadId
    );

    if (!upload) {
      throw new ConvexError({
        code: "FORUM_ATTACHMENT_UPLOAD_NOT_FOUND",
        message: "Forum post attachment upload not found.",
      });
    }

    const hasBoundStorage = upload.storageId === args.storageId;
    const owner = await ctx.db.get("users", upload.uploadedBy);

    if (!owner || isAccountDeletionPending(owner)) {
      if (!hasBoundStorage) {
        throw new ConvexError({
          code: "FORUM_ATTACHMENT_UPLOAD_NOT_FOUND",
          message: "Forum post attachment upload not found.",
        });
      }

      await runConvexProgram(deleteForumPendingUpload(ctx, upload));
      return args.uploadId;
    }

    if (upload.storageId && !hasBoundStorage) {
      throw new ConvexError({
        code: "FORUM_ATTACHMENT_UPLOAD_ALREADY_SAVED",
        message: "Forum post attachment upload has already been finalized.",
      });
    }

    const user = await requireAuth(ctx);
    const userId = user.appUser._id;

    if (upload.uploadedBy !== userId) {
      throw new ConvexError({
        code: "FORUM_ATTACHMENT_UPLOAD_NOT_FOUND",
        message: "Forum post attachment upload not found.",
      });
    }

    await loadOpenForumWithAccess(ctx, upload.forumId, userId);

    if (upload.mimeType !== args.type || upload.size !== args.size) {
      throw new ConvexError({
        code: forumAttachmentMetadataMismatchCode,
        message: "Forum post attachment metadata no longer matches the upload.",
      });
    }

    await runConvexProgram(
      validateForumAttachmentPolicy({
        mimeType: args.type,
        name: args.name,
        size: args.size,
      })
    );
    await runConvexProgram(
      validateStoredForumAttachmentMetadata(ctx, {
        size: args.size,
        storageId: args.storageId,
      })
    );

    await runConvexProgram(
      validateForumAttachmentStorageClaim(ctx, {
        storageId: args.storageId,
        uploadId: args.uploadId,
      })
    );

    if (
      upload.name === args.name &&
      upload.mimeType === args.type &&
      upload.size === args.size
    ) {
      return upload._id;
    }

    await ctx.db.patch("schoolClassForumPendingUploads", args.uploadId, {
      mimeType: args.type,
      name: args.name,
      size: args.size,
      storageId: args.storageId,
    });

    return args.uploadId;
  },
});

/**
 * Delete pending forum uploads that should no longer be attached.
 */
export const discardForumUploads = mutation({
  args: {
    uploadIds: v.array(vv.id("schoolClassForumPendingUploads")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const userId = user.appUser._id;

    for (const uploadId of args.uploadIds) {
      const upload = await ctx.db.get(
        "schoolClassForumPendingUploads",
        uploadId
      );

      if (!upload || upload.uploadedBy !== userId) {
        continue;
      }

      await runConvexProgram(deleteForumPendingUpload(ctx, upload));
    }

    return null;
  },
});
