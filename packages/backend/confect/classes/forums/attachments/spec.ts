import { GenericId } from "@confect/core";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import schoolClassForumPendingUploadsTable from "@repo/backend/confect/_generated/tables/schoolClassForumPendingUploads";
import { publicFailure } from "@repo/backend/confect/failure";
import { Schema } from "effect";
export type ForumPendingUploadDoc = Docs["schoolClassForumPendingUploads"];
const forumAttachmentLimitExceededCode = "FORUM_ATTACHMENT_LIMIT_EXCEEDED";
const forumAttachmentAlreadySavedCode = "FORUM_ATTACHMENT_UPLOAD_ALREADY_SAVED";
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
export const forumAttachmentNameInvalidCode = "FORUM_ATTACHMENT_NAME_INVALID";
export const forumAttachmentNotFoundCode = "FORUM_ATTACHMENT_NOT_FOUND";
export const forumAttachmentTooLargeCode = "FORUM_ATTACHMENT_TOO_LARGE";
export const forumAttachmentTypeUnsupportedCode =
  "FORUM_ATTACHMENT_TYPE_UNSUPPORTED";
export const forumAttachmentUploadNotFoundCode =
  "FORUM_ATTACHMENT_UPLOAD_NOT_FOUND";
const forumAttachmentErrorCodeSchema = Schema.Literals([
  forumAttachmentLimitExceededCode,
  forumAttachmentAlreadySavedCode,
  forumAttachmentAlreadyAttachedCode,
  forumAttachmentAlreadyClaimedCode,
  forumAttachmentDuplicateCode,
  forumAttachmentIncompleteCode,
  forumAttachmentMetadataMismatchCode,
  forumAttachmentNameInvalidCode,
  forumAttachmentNotFoundCode,
  forumAttachmentTooLargeCode,
  forumAttachmentTypeUnsupportedCode,
  forumAttachmentUploadNotFoundCode,
]);
export type ForumAttachmentErrorCode =
  typeof forumAttachmentErrorCodeSchema.Type;
const ForumAttachmentUploadSchema = Schema.Struct({
  ...schoolClassForumPendingUploadsTable.Doc.fields,
  mimeType: Schema.String,
  name: Schema.String,
  size: Schema.Finite,
  storageId: GenericId.GenericId("_storage"),
});
/**
 * One pending forum upload after the storage file and metadata have both been
 * finalized.
 */
export type ForumAttachmentUpload = typeof ForumAttachmentUploadSchema.Type;
export type ForumAttachmentPolicyInput = Pick<
  ForumAttachmentUpload,
  "mimeType" | "name" | "size"
>;
export type ForumAttachmentMetadataInput = Pick<
  ForumAttachmentUpload,
  "size" | "storageId"
>;
const ForumAttachmentStorageClaimInputSchema = Schema.Struct({
  storageId: GenericId.GenericId("_storage"),
  uploadId: IdSchema("schoolClassForumPendingUploads"),
});
export type ForumAttachmentStorageClaimInput =
  typeof ForumAttachmentStorageClaimInputSchema.Type;
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
    cause: Schema.optional(Schema.Unknown),
    code: Schema.Literal(forumAttachmentIoFailedCode),
    message: Schema.String,
  }
) {}
export const ForumAttachmentIoErrorWire = publicFailure(ForumAttachmentIoError);
export class ForumAttachmentUploadConfigError extends Schema.TaggedError<ForumAttachmentUploadConfigError>()(
  "ForumAttachmentUploadConfigError",
  {
    code: Schema.Literal("FORUM_ATTACHMENT_UPLOAD_CONFIG_INVALID"),
    message: Schema.String,
  }
) {}

/** Builds one opaque, deployment-owned upload capability URL. */
/** Public failure payload keeps the domain tag while preserving the deployed code/message transport. */
