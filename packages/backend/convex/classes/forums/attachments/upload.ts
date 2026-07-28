import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { internalQuery } from "@repo/backend/convex/_generated/server";
import { isAccountDeletionPending } from "@repo/backend/convex/auth/deletion/state";
import { FORUM_ATTACHMENT_UPLOAD_PATH_PREFIX } from "@repo/backend/convex/classes/forums/attachments/constants";
import { internalMutation } from "@repo/backend/convex/functions";
import { type Infer, v } from "convex/values";
import { literals } from "convex-helpers/validators";
import { Config, Effect, Schema } from "effect";

const forumAttachmentUploadOutcomeValidator = literals(
  "accepted",
  "discarded",
  "rejected"
);
type ForumAttachmentUploadOutcome = Infer<
  typeof forumAttachmentUploadOutcomeValidator
>;

class ForumAttachmentUploadConfigError extends Schema.TaggedError<ForumAttachmentUploadConfigError>()(
  "ForumAttachmentUploadConfigError",
  {
    code: Schema.Literal("FORUM_ATTACHMENT_UPLOAD_CONFIG_INVALID"),
    message: Schema.String,
  }
) {}

/** Builds one opaque, deployment-owned upload capability URL. */
export const createForumAttachmentUploadUrl = Effect.fn(
  "classes.forums.attachments.createUploadUrl"
)(function* (
  uploadId: Id<"schoolClassForumPendingUploads">,
  uploadToken: string
) {
  const siteUrl = yield* Config.url("CONVEX_SITE_URL").pipe(
    Effect.mapError(
      () =>
        new ForumAttachmentUploadConfigError({
          code: "FORUM_ATTACHMENT_UPLOAD_CONFIG_INVALID",
          message: "Forum attachment upload is not configured.",
        })
    )
  );
  const url = new URL(
    `${FORUM_ATTACHMENT_UPLOAD_PATH_PREFIX}/${uploadId}/${uploadToken}`,
    siteUrl
  );

  return url.toString();
});

/** Checks the capability before an HTTP action consumes the request body. */
export const authorize = internalQuery({
  args: {
    uploadId: v.string(),
    uploadToken: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const uploadId = ctx.db.normalizeId(
      "schoolClassForumPendingUploads",
      args.uploadId
    );
    if (!uploadId) {
      return false;
    }
    const upload = await ctx.db.get("schoolClassForumPendingUploads", uploadId);

    if (
      !upload ||
      upload.uploadToken !== args.uploadToken ||
      upload.storageId
    ) {
      return false;
    }

    const owner = await ctx.db.get("users", upload.uploadedBy);
    return Boolean(owner && !isAccountDeletionPending(owner));
  },
});

/**
 * Atomically binds a server-created storage object to its pending upload.
 *
 * The storage ID is accepted only from the internal HTTP adapter. Rejected or
 * deletion-raced uploads are removed in this same transaction.
 */
export const settle = internalMutation({
  args: {
    contentType: v.string(),
    size: v.number(),
    storageId: v.id("_storage"),
    uploadId: v.string(),
    uploadToken: v.string(),
  },
  returns: forumAttachmentUploadOutcomeValidator,
  handler: async (ctx, args): Promise<ForumAttachmentUploadOutcome> => {
    const uploadId = ctx.db.normalizeId(
      "schoolClassForumPendingUploads",
      args.uploadId
    );
    if (!uploadId) {
      await ctx.storage.delete(args.storageId);
      return "rejected";
    }
    const upload = await ctx.db.get("schoolClassForumPendingUploads", uploadId);

    if (
      !upload ||
      upload.uploadToken !== args.uploadToken ||
      upload.storageId
    ) {
      await ctx.storage.delete(args.storageId);
      return "rejected";
    }

    const owner = await ctx.db.get("users", upload.uploadedBy);

    if (!owner || isAccountDeletionPending(owner)) {
      await ctx.storage.delete(args.storageId);
      await ctx.db.delete("schoolClassForumPendingUploads", upload._id);
      return "discarded";
    }

    await ctx.db.patch("schoolClassForumPendingUploads", upload._id, {
      mimeType: args.contentType,
      size: args.size,
      storageId: args.storageId,
    });

    return "accepted";
  },
});
