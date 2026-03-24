import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { MAX_FORUM_POST_ATTACHMENTS } from "@repo/backend/convex/classes/forums/utils/constants";
import {
  getMyPostReactions,
  getPostReactionPreviews,
} from "@repo/backend/convex/classes/forums/utils/postReactions";
import { getUserMap } from "@repo/backend/convex/lib/helpers/user";
import { ConvexError } from "convex/values";
import { asyncMap } from "convex-helpers";

export interface PostAttachment {
  _id: Id<"schoolClassForumPostAttachments">;
  mimeType: string;
  name: string;
  size: number;
  url: string | null;
}

/**
 * Enrich forum posts with user data, reactions, and attachments.
 */
export async function enrichForumPosts(
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

  const [reactionPreviews, myReactionsMap, allAttachments] = await Promise.all([
    getPostReactionPreviews(ctx, posts),
    getMyPostReactions(ctx, postIds, currentUserId),
    asyncMap(postIds, (postId) =>
      ctx.db
        .query("schoolClassForumPostAttachments")
        .withIndex("by_postId", (q) => q.eq("postId", postId))
        .take(MAX_FORUM_POST_ATTACHMENTS + 1)
    ),
  ]);

  for (const attachments of allAttachments) {
    if (attachments.length <= MAX_FORUM_POST_ATTACHMENTS) {
      continue;
    }

    throw new ConvexError({
      code: "FORUM_ATTACHMENT_LIMIT_EXCEEDED",
      message: "Forum post attachment count exceeds the supported limit.",
    });
  }

  const flatAttachments = allAttachments.flat();
  const [userMap, urls] = await Promise.all([
    getUserMap(ctx, postUserIds),
    asyncMap(flatAttachments, (attachment) =>
      ctx.storage.getUrl(attachment.fileId)
    ),
  ]);

  const urlMap = new Map(
    flatAttachments.map((attachment, index) => [attachment._id, urls[index]])
  );
  const attachmentsByPost = new Map(
    postIds.map((postId, index) => [
      postId,
      allAttachments[index].map((attachment) => ({
        _id: attachment._id,
        mimeType: attachment.mimeType,
        name: attachment.name,
        size: attachment.size,
        url: urlMap.get(attachment._id) ?? null,
      })),
    ])
  );

  return posts.map((post) => ({
    ...post,
    attachments: attachmentsByPost.get(post._id) ?? [],
    myReactions: myReactionsMap.get(post._id) ?? [],
    reactionUsers: post.reactionCounts.map(({ emoji, count }) => ({
      count,
      emoji,
      reactors: reactionPreviews.get(post._id)?.get(emoji) ?? [],
    })),
    replyToUser: post.replyToUserId
      ? (userMap.get(post.replyToUserId) ?? null)
      : null,
    user: userMap.get(post.createdBy) ?? null,
  }));
}
