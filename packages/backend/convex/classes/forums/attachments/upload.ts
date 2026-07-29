import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { isAccountDeletionPending } from "@repo/backend/convex/auth/deletion/state";
import {
  FORUM_ATTACHMENT_UPLOAD_PATH_PREFIX,
  FORUM_PENDING_UPLOAD_LEASE_MS,
} from "@repo/backend/convex/classes/forums/attachments/constants";
import { internalMutation } from "@repo/backend/convex/functions";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { type Infer, v } from "convex/values";
import { literals } from "convex-helpers/validators";
import { Clock, Config, Effect, Schema } from "effect";

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

/** Exclusively leases the capability before an HTTP action consumes its body. */
export const claim = internalMutation({
  args: {
    leaseId: v.string(),
    uploadId: v.string(),
    uploadToken: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const claimedAt = await runConvexProgram(Clock.currentTimeMillis);
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
      upload.expiresAt <= claimedAt ||
      upload.storageId ||
      (upload.uploadLease?.expiresAt ?? 0) > claimedAt
    ) {
      return false;
    }

    const owner = await ctx.db.get("users", upload.uploadedBy);
    if (!owner || isAccountDeletionPending(owner)) {
      return false;
    }

    await ctx.db.patch("schoolClassForumPendingUploads", upload._id, {
      uploadLease: {
        expiresAt: Math.min(
          upload.expiresAt,
          claimedAt + FORUM_PENDING_UPLOAD_LEASE_MS
        ),
        id: args.leaseId,
      },
    });
    return true;
  },
});

/** Releases only the matching interrupted upload lease. */
export const release = internalMutation({
  args: {
    leaseId: v.string(),
    uploadId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const uploadId = ctx.db.normalizeId(
      "schoolClassForumPendingUploads",
      args.uploadId
    );
    if (!uploadId) {
      return null;
    }
    const upload = await ctx.db.get("schoolClassForumPendingUploads", uploadId);

    if (upload?.uploadLease?.id === args.leaseId) {
      await ctx.db.patch("schoolClassForumPendingUploads", upload._id, {
        uploadLease: undefined,
      });
    }

    return null;
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
    leaseId: v.string(),
    size: v.number(),
    storageId: v.id("_storage"),
    uploadId: v.string(),
    uploadToken: v.string(),
  },
  returns: forumAttachmentUploadOutcomeValidator,
  handler: async (ctx, args): Promise<ForumAttachmentUploadOutcome> => {
    const settledAt = await runConvexProgram(Clock.currentTimeMillis);
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

    if (upload.expiresAt <= settledAt) {
      await ctx.storage.delete(args.storageId);
      await ctx.db.delete("schoolClassForumPendingUploads", upload._id);
      return "rejected";
    }

    if (
      upload.uploadLease?.id !== args.leaseId ||
      upload.uploadLease.expiresAt <= settledAt
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
      uploadLease: undefined,
    });

    return "accepted";
  },
});
