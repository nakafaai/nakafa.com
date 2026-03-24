import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { ConvexError, type Infer, v } from "convex/values";

export const attachmentArgValidator = v.object({
  name: v.string(),
  size: v.number(),
  storageId: v.id("_storage"),
  type: v.string(),
});

export type AttachmentArg = Infer<typeof attachmentArgValidator>;

/**
 * Validate that every client-supplied attachment still exists in Convex
 * storage and still matches the uploaded file metadata.
 */
export async function validateForumAttachments(
  ctx: MutationCtx,
  attachments: AttachmentArg[]
) {
  const seenStorageIds = new Set<AttachmentArg["storageId"]>();

  for (const attachment of attachments) {
    if (seenStorageIds.has(attachment.storageId)) {
      throw new ConvexError({
        code: "FORUM_ATTACHMENT_DUPLICATE",
        message: "Forum post attachments must reference distinct files.",
      });
    }

    seenStorageIds.add(attachment.storageId);
  }

  await Promise.all(
    attachments.map(async (attachment) => {
      const metadata = await ctx.db.system.get(
        "_storage",
        attachment.storageId
      );

      if (!metadata) {
        throw new ConvexError({
          code: "FORUM_ATTACHMENT_NOT_FOUND",
          message: "Forum post attachment not found.",
        });
      }

      const contentType = metadata.contentType ?? "";

      if (
        metadata.size === attachment.size &&
        contentType === attachment.type
      ) {
        return;
      }

      throw new ConvexError({
        code: "FORUM_ATTACHMENT_METADATA_MISMATCH",
        message: "Forum post attachment metadata no longer matches the upload.",
      });
    })
  );
}
