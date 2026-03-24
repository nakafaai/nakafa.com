import { internal } from "@repo/backend/convex/_generated/api";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { deleteForumPendingUpload } from "@repo/backend/convex/classes/forums/utils/attachments";
import { internalMutation } from "@repo/backend/convex/functions";
import { v } from "convex/values";

const STALE_FORUM_PENDING_UPLOAD_BATCH_SIZE = 25;
const STALE_FORUM_PENDING_UPLOAD_MAX_AGE_MS = 2 * 60 * 60 * 1000;

/**
 * Delete forum pending uploads that stayed unclaimed past the upload URL
 * lifetime, processing old rows in bounded batches.
 */
export const cleanupStalePendingUploads = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const staleBefore = Date.now() - STALE_FORUM_PENDING_UPLOAD_MAX_AGE_MS;
    const uploads = await ctx.db
      .query("schoolClassForumPendingUploads")
      .take(STALE_FORUM_PENDING_UPLOAD_BATCH_SIZE);
    const staleUploads: Doc<"schoolClassForumPendingUploads">[] = [];

    for (const upload of uploads) {
      if (upload._creationTime >= staleBefore) {
        break;
      }

      staleUploads.push(upload);
    }

    if (staleUploads.length === 0) {
      return null;
    }

    for (const upload of staleUploads) {
      await deleteForumPendingUpload(ctx, upload);
    }

    if (
      staleUploads.length < uploads.length ||
      uploads.length < STALE_FORUM_PENDING_UPLOAD_BATCH_SIZE
    ) {
      return null;
    }

    await ctx.scheduler.runAfter(
      0,
      internal.classes.forums.internalMutations.cleanupStalePendingUploads,
      {}
    );

    return null;
  },
});
