import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { ConvexError } from "convex/values";

type ForumPendingUploadDoc = Doc<"schoolClassForumPendingUploads">;

/**
 * One pending forum upload after the storage file and metadata have both been
 * finalized.
 */
export type ForumAttachmentUpload = ForumPendingUploadDoc & {
  mimeType: NonNullable<ForumPendingUploadDoc["mimeType"]>;
  name: NonNullable<ForumPendingUploadDoc["name"]>;
  size: NonNullable<ForumPendingUploadDoc["size"]>;
  storageId: NonNullable<ForumPendingUploadDoc["storageId"]>;
};

/**
 * Reject duplicate pending upload IDs in one forum post submission.
 */
function ensureDistinctUploadIds(
  uploadIds: Id<"schoolClassForumPendingUploads">[]
) {
  const seenUploadIds = new Set<Id<"schoolClassForumPendingUploads">>();

  for (const uploadId of uploadIds) {
    if (!seenUploadIds.has(uploadId)) {
      seenUploadIds.add(uploadId);
      continue;
    }

    throw new ConvexError({
      code: "FORUM_ATTACHMENT_DUPLICATE",
      message: "Forum post attachments must reference distinct uploads.",
    });
  }
}

/**
 * Verify that the stored file still matches the finalized upload metadata.
 */
export async function validateStoredForumAttachmentMetadata(
  ctx: MutationCtx,
  {
    mimeType,
    size,
    storageId,
  }: {
    mimeType: string;
    size: number;
    storageId: Id<"_storage">;
  }
) {
  const metadata = await ctx.db.system.get("_storage", storageId);

  if (!metadata) {
    throw new ConvexError({
      code: "FORUM_ATTACHMENT_NOT_FOUND",
      message: "Forum post attachment not found.",
    });
  }

  const contentType = metadata.contentType ?? "";

  if (metadata.size === size && contentType === mimeType) {
    return;
  }

  throw new ConvexError({
    code: "FORUM_ATTACHMENT_METADATA_MISMATCH",
    message: "Forum post attachment metadata no longer matches the upload.",
  });
}

/**
 * Narrow one pending upload document to a fully finalized attachment upload.
 */
function isForumAttachmentUpload(
  upload: ForumPendingUploadDoc
): upload is ForumAttachmentUpload {
  return (
    Boolean(upload.storageId) &&
    Boolean(upload.mimeType) &&
    Boolean(upload.name) &&
    upload.size !== undefined
  );
}

/**
 * Resolve finalized upload claims for one forum post submission.
 */
export async function resolveForumAttachmentUploads(
  ctx: MutationCtx,
  {
    forumId,
    uploadIds,
    userId,
  }: {
    forumId: Id<"schoolClassForums">;
    uploadIds: Id<"schoolClassForumPendingUploads">[];
    userId: Id<"users">;
  }
) {
  ensureDistinctUploadIds(uploadIds);

  const uploads = await Promise.all(
    uploadIds.map((uploadId) =>
      ctx.db.get("schoolClassForumPendingUploads", uploadId)
    )
  );

  const finalizedUploads: ForumAttachmentUpload[] = [];

  for (const upload of uploads) {
    if (!upload || upload.uploadedBy !== userId || upload.forumId !== forumId) {
      throw new ConvexError({
        code: "FORUM_ATTACHMENT_UPLOAD_NOT_FOUND",
        message: "Forum post attachment upload not found.",
      });
    }

    if (!isForumAttachmentUpload(upload)) {
      throw new ConvexError({
        code: "FORUM_ATTACHMENT_UPLOAD_INCOMPLETE",
        message: "Forum post attachment upload has not finished yet.",
      });
    }

    const finalizedUpload: ForumAttachmentUpload = upload;

    await validateStoredForumAttachmentMetadata(ctx, finalizedUpload);
    finalizedUploads.push(finalizedUpload);
  }

  return finalizedUploads;
}
