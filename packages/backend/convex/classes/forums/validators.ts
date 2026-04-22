import { schoolClassReactionCountValidator } from "@repo/backend/convex/classes/schema";
import { userDataValidator } from "@repo/backend/convex/lib/validators/user";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import { nullable } from "convex-helpers/validators";

/** Shared public-safe forum reaction preview payload. */
export const forumReactionUsersValidator = v.object({
  count: schoolClassReactionCountValidator.fields.count,
  emoji: schoolClassReactionCountValidator.fields.emoji,
  reactors: v.array(v.string()),
});

/** Shared public-safe forum attachment payload. */
export const forumPostAttachmentValidator = v.object({
  _id: vv.id("schoolClassForumPostAttachments"),
  mimeType: v.string(),
  name: v.string(),
  size: v.number(),
  url: nullable(v.string()),
});

/** Shared forum thread owner snapshot returned to the frontend. */
export const forumUserValidator = userDataValidator;

/** Shared enriched forum post payload returned by detached history queries. */
export const forumPostWithMetadataValidator = v.object({
  ...vv.doc("schoolClassForumPosts").fields,
  attachments: v.array(forumPostAttachmentValidator),
  myReactions: v.array(v.string()),
  reactionUsers: v.array(forumReactionUsersValidator),
  replyToUser: nullable(forumUserValidator),
  user: nullable(forumUserValidator),
});

/** Shared enriched feed post payload returned by the live forum transcript. */
export const forumFeedPostValidator = v.object({
  ...forumPostWithMetadataValidator.fields,
  isUnread: v.boolean(),
});

/** Shared forum list row payload returned by the class forum list. */
export const forumListItemValidator = v.object({
  ...vv.doc("schoolClassForums").fields,
  myReactions: v.array(v.string()),
  unreadCount: v.number(),
  user: nullable(forumUserValidator),
});

/** Shared single-forum payload returned by the conversation panel query. */
export const forumDetailValidator = v.object({
  ...vv.doc("schoolClassForums").fields,
  myReactions: v.array(v.string()),
  reactionUsers: v.array(forumReactionUsersValidator),
  user: nullable(forumUserValidator),
});

/** Paginated forum list payload used by the class forum sidebar. */
export const paginatedForumsValidator = paginationResultValidator(
  forumListItemValidator
);

/** Paginated live forum feed payload used by the conversation transcript. */
export const paginatedForumFeedValidator = paginationResultValidator(
  forumFeedPostValidator
);

/** Mutation result for toggling a reaction on a forum or forum post. */
export const forumReactionToggleResultValidator = v.object({
  added: v.boolean(),
});

/** Mutation result for creating a signed forum attachment upload. */
export const forumUploadUrlResultValidator = v.object({
  uploadId: vv.id("schoolClassForumPendingUploads"),
  uploadUrl: v.string(),
});
