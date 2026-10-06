import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  StorageReader,
} from "@repo/backend/confect/_generated/services";
import { ForumAttachmentError } from "@repo/backend/confect/classes/forums/attachments/spec";
import { MAX_FORUM_POST_ATTACHMENTS } from "@repo/backend/confect/classes/forums/constants";
import {
  getMyPostReactions,
  getPostReactionPreviews,
} from "@repo/backend/confect/classes/forums/postReactions";
import { getUserMap } from "@repo/backend/confect/users/directory";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Array as Arr, Effect } from "effect";
export type PostAttachment = Pick<
  Docs["schoolClassForumPostAttachments"],
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
  posts: Docs["schoolClassForumPosts"][],
  currentUserId: Id<"users">
) {
  const _reader = yield* DatabaseReader;
  if (posts.length === 0) {
    return [];
  }
  const postIds = Arr.map(posts, (post) => post._id);
  const postUserIds = Arr.flatMap(posts, (post) =>
    post.replyToUserId ? [post.createdBy, post.replyToUserId] : [post.createdBy]
  );
  const [reactionPreviews, myReactions, allAttachments] = yield* Effect.all([
    getPostReactionPreviews(posts),
    getMyPostReactions(postIds, currentUserId),
    Effect.forEach(postIds, (postId) =>
      _reader
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
    getUserMap(postUserIds),
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
  return Arr.map(posts, (post, index) => ({
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
