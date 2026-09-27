import { DatabaseReader } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { StorageReader } from "@repo/backend/confect/_generated/services";
import { ForumAttachmentError } from "@repo/backend/confect/classes/forums/attachments/spec";
import { MAX_FORUM_POST_ATTACHMENTS } from "@repo/backend/confect/classes/forums/constants";
import {
  getMyPostReactions,
  getPostReactionPreviews,
} from "@repo/backend/confect/classes/forums/postReactions";
import { getUserMap } from "@repo/backend/confect/users/directory";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { Effect } from "effect";
export type PostAttachment = Pick<
  Doc<"schoolClassForumPostAttachments">,
  "_id" | "mimeType" | "name" | "size"
> & {
  url: string | null;
};

/**
 * Enrich forum posts with user data, reactions, and attachments.
 */
export const enrichForumPosts = Effect.fn(
  "classes.forums.posts.enrichForumPosts"
)(function* (
  ctx: QueryCtx,
  posts: Doc<"schoolClassForumPosts">[],
  currentUserId: Id<"users">
) {
  if (posts.length === 0) {
    return [];
  }
  const postIds = posts.map((post) => post._id);
  const postUserIds = posts.flatMap((post) =>
    post.replyToUserId ? [post.createdBy, post.replyToUserId] : [post.createdBy]
  );
  const [reactionPreviews, myReactions, allAttachments] = yield* Effect.all([
    getPostReactionPreviews(ctx, posts),
    getMyPostReactions(ctx, postIds, currentUserId),
    Effect.forEach(postIds, (postId) =>
      DatabaseReader.make(databaseSchema, ctx.db)
        .table("schoolClassForumPostAttachments")
        .index("by_postId", (q) => q.eq("postId", postId))
        .take(MAX_FORUM_POST_ATTACHMENTS + 1)
        .pipe(Effect.orDie)
    ),
  ]);
  for (const attachments of allAttachments) {
    if (attachments.length <= MAX_FORUM_POST_ATTACHMENTS) {
      continue;
    }
    return yield* new ForumAttachmentError({
      code: "FORUM_ATTACHMENT_LIMIT_EXCEEDED",
      message: "Forum post attachment count exceeds the supported limit.",
    });
  }
  const [userMap, attachmentLists] = yield* Effect.all([
    getUserMap(ctx, postUserIds),
    Effect.forEach(allAttachments, (attachments) =>
      Effect.forEach(attachments, (attachment) =>
        Effect.gen(function* () {
          const storage = yield* StorageReader;
          const url = yield* storage.getUrl(attachment.fileId).pipe(
            Effect.map((value) => value.toString()),
            Effect.catchTag("BlobNotFoundError", () => Effect.succeed(null))
          );
          return {
            _id: attachment._id,
            mimeType: attachment.mimeType,
            name: attachment.name,
            size: attachment.size,
            url,
          };
        })
      )
    ),
  ]);
  return posts.map((post, index) => ({
    ...post,
    attachments: attachmentLists[index],
    myReactions: myReactions[index],
    reactionUsers: reactionPreviews[index],
    replyToUser: post.replyToUserId
      ? (userMap.get(post.replyToUserId) ?? null)
      : null,
    user: userMap.get(post.createdBy) ?? null,
  }));
});
