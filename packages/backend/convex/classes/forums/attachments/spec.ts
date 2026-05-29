import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import { Schema } from "effect";

export type ForumPendingUploadDoc = Doc<"schoolClassForumPendingUploads">;

export const forumAttachmentAlreadyAttachedCode =
  "FORUM_ATTACHMENT_ALREADY_ATTACHED";
export const forumAttachmentAlreadyClaimedCode =
  "FORUM_ATTACHMENT_UPLOAD_ALREADY_CLAIMED";
export const forumAttachmentDuplicateCode = "FORUM_ATTACHMENT_DUPLICATE";
export const forumAttachmentIncompleteCode =
  "FORUM_ATTACHMENT_UPLOAD_INCOMPLETE";
export const forumAttachmentIoFailedCode = "FORUM_ATTACHMENT_IO_FAILED";
export const forumAttachmentMetadataMismatchCode =
  "FORUM_ATTACHMENT_METADATA_MISMATCH";
export const forumAttachmentNotFoundCode = "FORUM_ATTACHMENT_NOT_FOUND";
export const forumAttachmentTooLargeCode = "FORUM_ATTACHMENT_TOO_LARGE";
export const forumAttachmentTypeUnsupportedCode =
  "FORUM_ATTACHMENT_TYPE_UNSUPPORTED";
export const forumAttachmentUploadNotFoundCode =
  "FORUM_ATTACHMENT_UPLOAD_NOT_FOUND";

export const forumAttachmentErrorCodeSchema = Schema.Literal(
  forumAttachmentAlreadyAttachedCode,
  forumAttachmentAlreadyClaimedCode,
  forumAttachmentDuplicateCode,
  forumAttachmentIncompleteCode,
  forumAttachmentMetadataMismatchCode,
  forumAttachmentNotFoundCode,
  forumAttachmentTooLargeCode,
  forumAttachmentTypeUnsupportedCode,
  forumAttachmentUploadNotFoundCode
);
export type ForumAttachmentErrorCode = Schema.Schema.Type<
  typeof forumAttachmentErrorCodeSchema
>;

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

export type ForumAttachmentPolicyInput = Pick<
  ForumAttachmentUpload,
  "mimeType" | "name" | "size"
>;

export type ForumAttachmentMetadataInput = Pick<
  ForumAttachmentUpload,
  "mimeType" | "size" | "storageId"
>;

export interface ForumAttachmentStorageClaimInput {
  readonly storageId: Id<"_storage">;
  readonly uploadId: Id<"schoolClassForumPendingUploads">;
}

/** Raised when a forum attachment violates an expected domain rule. */
export class ForumAttachmentError extends Schema.TaggedError<ForumAttachmentError>()(
  "ForumAttachmentError",
  {
    code: forumAttachmentErrorCodeSchema,
    message: Schema.String,
  }
) {}

/** Raised when Convex storage or database IO fails during attachment handling. */
export class ForumAttachmentIoError extends Schema.TaggedError<ForumAttachmentIoError>()(
  "ForumAttachmentIoError",
  {
    code: Schema.Literal(forumAttachmentIoFailedCode),
    message: Schema.String,
  }
) {}

export type ForumAttachmentFailure =
  | ForumAttachmentError
  | ForumAttachmentIoError;
