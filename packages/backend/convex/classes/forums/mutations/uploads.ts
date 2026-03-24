import { loadOpenForumWithAccess } from "@repo/backend/convex/classes/forums/utils/access";
import { validateStoredForumAttachmentMetadata } from "@repo/backend/convex/classes/forums/utils/attachments";
import { mutation } from "@repo/backend/convex/functions";
import { requireAuthWithSession } from "@repo/backend/convex/lib/helpers/auth";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { ConvexError, v } from "convex/values";

/**
 * Create an upload URL for one new forum post attachment.
 */
export const generateUploadUrl = mutation({
  args: {
    forumId: vv.id("schoolClassForums"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthWithSession(ctx);
    const { forum } = await loadOpenForumWithAccess(
      ctx,
      args.forumId,
      user.appUser._id
    );

    const uploadUrl = await ctx.storage.generateUploadUrl();
    const uploadId = await ctx.db.insert("schoolClassForumPendingUploads", {
      classId: forum.classId,
      forumId: forum._id,
      uploadedBy: user.appUser._id,
    });

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
  handler: async (ctx, args) => {
    const user = await requireAuthWithSession(ctx);
    const userId = user.appUser._id;
    const upload = await ctx.db.get(
      "schoolClassForumPendingUploads",
      args.uploadId
    );

    if (!upload || upload.uploadedBy !== userId) {
      throw new ConvexError({
        code: "FORUM_ATTACHMENT_UPLOAD_NOT_FOUND",
        message: "Forum post attachment upload not found.",
      });
    }

    await loadOpenForumWithAccess(ctx, upload.forumId, userId);

    if (
      upload.storageId === args.storageId &&
      upload.name === args.name &&
      upload.mimeType === args.type &&
      upload.size === args.size
    ) {
      return upload._id;
    }

    if (upload.storageId) {
      throw new ConvexError({
        code: "FORUM_ATTACHMENT_UPLOAD_ALREADY_SAVED",
        message: "Forum post attachment upload has already been finalized.",
      });
    }

    await validateStoredForumAttachmentMetadata(ctx, {
      mimeType: args.type,
      size: args.size,
      storageId: args.storageId,
    });

    const matchingPendingUploads = await ctx.db
      .query("schoolClassForumPendingUploads")
      .withIndex("by_storageId", (q) => q.eq("storageId", args.storageId))
      .take(2);
    const conflictingPendingUpload = matchingPendingUploads.find(
      (pendingUpload) => pendingUpload._id !== args.uploadId
    );

    if (conflictingPendingUpload) {
      throw new ConvexError({
        code: "FORUM_ATTACHMENT_UPLOAD_ALREADY_CLAIMED",
        message: "Forum post attachment upload has already been claimed.",
      });
    }

    const existingAttachment = await ctx.db
      .query("schoolClassForumPostAttachments")
      .withIndex("by_fileId", (q) => q.eq("fileId", args.storageId))
      .first();

    if (existingAttachment) {
      throw new ConvexError({
        code: "FORUM_ATTACHMENT_ALREADY_ATTACHED",
        message: "Forum post attachment has already been used.",
      });
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
