import { deleteForumPendingUpload } from "@repo/backend/convex/classes/forums/utils/attachments";
import { internalMutation } from "@repo/backend/convex/functions";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { v } from "convex/values";

export const STALE_FORUM_PENDING_UPLOAD_MAX_AGE_MS = 2 * 60 * 60 * 1000;

/**
 * Delete one pending upload if it is still present when its scheduled expiry
 * window elapses.
 */
export const deleteExpiredPendingUpload = internalMutation({
  args: {
    uploadId: vv.id("schoolClassForumPendingUploads"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const upload = await ctx.db.get(
      "schoolClassForumPendingUploads",
      args.uploadId
    );

    if (!upload) {
      return null;
    }

    await deleteForumPendingUpload(ctx, upload);

    return null;
  },
});
