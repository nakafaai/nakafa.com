import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import schoolClassForumPostsTable from "@repo/backend/confect/_generated/tables/schoolClassForumPosts";
import schoolClassForumsTable from "@repo/backend/confect/_generated/tables/schoolClassForums";
import { schoolClassReactionCountValidator } from "@repo/backend/confect/classes/schema";
import { userDataValidator } from "@repo/backend/confect/lib/validators/user";
import { Schema } from "effect";
/** Shared public-safe forum reaction preview payload. */
export const forumReactionUsersValidator = Schema.Struct({
  count: schoolClassReactionCountValidator.fields.count,
  emoji: schoolClassReactionCountValidator.fields.emoji,
  reactors: Schema.mutable(Schema.Array(Schema.String)),
});

/** Shared public-safe forum attachment payload. */
export const forumPostAttachmentValidator = Schema.Struct({
  _id: IdSchema("schoolClassForumPostAttachments"),
  mimeType: Schema.String,
  name: Schema.String,
  size: Schema.Finite,
  url: Schema.NullOr(Schema.String),
});

/** Shared forum thread owner snapshot returned to the frontend. */
const forumUserValidator = userDataValidator;

/** Shared enriched forum post payload returned by detached history queries. */
export const forumPostWithMetadataValidator = Schema.Struct({
  ...schoolClassForumPostsTable.Doc.fields,
  attachments: Schema.mutable(Schema.Array(forumPostAttachmentValidator)),
  myReactions: Schema.mutable(Schema.Array(Schema.String)),
  reactionUsers: Schema.mutable(Schema.Array(forumReactionUsersValidator)),
  replyToUser: Schema.NullOr(forumUserValidator),
  user: Schema.NullOr(forumUserValidator),
});

/** Shared enriched feed post payload returned by the live forum transcript. */
export const forumFeedPostValidator = Schema.Struct({
  ...forumPostWithMetadataValidator.fields,
  isUnread: Schema.Boolean,
});

/** Shared forum list row payload returned by the class forum list. */
export const forumListItemValidator = Schema.Struct({
  ...schoolClassForumsTable.Doc.fields,
  myReactions: Schema.mutable(Schema.Array(Schema.String)),
  unreadCount: Schema.Finite,
  user: Schema.NullOr(forumUserValidator),
});

/** Shared single-forum payload returned by the conversation panel query. */
export const forumDetailValidator = Schema.Struct({
  ...schoolClassForumsTable.Doc.fields,
  myReactions: Schema.mutable(Schema.Array(Schema.String)),
  reactionUsers: Schema.mutable(Schema.Array(forumReactionUsersValidator)),
  user: Schema.NullOr(forumUserValidator),
});

/** Paginated forum list payload used by the class forum sidebar. */

/** Mutation result for toggling a reaction on a forum or forum post. */
export const forumReactionToggleResultValidator = Schema.Struct({
  added: Schema.Boolean,
});

/** Mutation result for creating a signed forum attachment upload. */
export const forumUploadUrlResultValidator = Schema.Struct({
  uploadId: IdSchema("schoolClassForumPendingUploads"),
  uploadUrl: Schema.String,
});
