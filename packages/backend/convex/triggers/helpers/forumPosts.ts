import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { createNotification } from "@repo/backend/convex/triggers/helpers/notifications";
import { truncateText } from "@repo/backend/convex/utils/text";
import type { Change } from "convex-helpers/server/triggers";

/** Update forum counters and last-post metadata after inserting one post. */
export async function updateForumAfterInsert(
  ctx: MutationCtx,
  post: NonNullable<Change<DataModel, "schoolClassForumPosts">["newDoc"]>
) {
  const forum = await ctx.db.get("schoolClassForums", post.forumId);

  if (!forum) {
    return null;
  }

  await ctx.db.patch("schoolClassForums", post.forumId, {
    postCount: forum.postCount + 1,
    lastPostAt: post._creationTime,
    lastPostBy: post.createdBy,
    updatedAt: Date.now(),
  });

  return forum;
}

/** Update forum counters and last-post metadata after deleting one post. */
export async function updateForumAfterDelete(
  ctx: MutationCtx,
  oldPost: NonNullable<Change<DataModel, "schoolClassForumPosts">["oldDoc"]>
) {
  const forum = await ctx.db.get("schoolClassForums", oldPost.forumId);

  if (!forum) {
    return;
  }

  const latestRemainingPost = await ctx.db
    .query("schoolClassForumPosts")
    .withIndex("by_forumId_and_sequence", (q) =>
      q.eq("forumId", oldPost.forumId)
    )
    .order("desc")
    .first();

  await ctx.db.patch("schoolClassForums", oldPost.forumId, {
    postCount: Math.max(forum.postCount - 1, 0),
    lastPostAt: latestRemainingPost?._creationTime ?? forum._creationTime,
    lastPostBy: latestRemainingPost?.createdBy ?? forum.createdBy,
    updatedAt: Date.now(),
  });
}

/** Send reply and mention notifications for one newly inserted forum post. */
export async function notifyForumPostParticipants(
  ctx: MutationCtx,
  {
    forum,
    post,
    postId,
  }: {
    forum: NonNullable<Awaited<ReturnType<typeof updateForumAfterInsert>>>;
    post: NonNullable<Change<DataModel, "schoolClassForumPosts">["newDoc"]>;
    postId: Change<DataModel, "schoolClassForumPosts">["id"];
  }
) {
  const truncatedBody = truncateText({ text: post.body });

  if (
    post.parentId &&
    post.replyToUserId &&
    post.replyToUserId !== post.createdBy
  ) {
    await createNotification(ctx, {
      recipientId: post.replyToUserId,
      actorId: post.createdBy,
      type: "post_reply",
      entityType: "schoolClassForumPosts",
      entityId: postId,
      previewTitle: forum.title,
      previewBody: truncatedBody,
    });
  }

  for (const mentionedUserId of post.mentions) {
    if (
      mentionedUserId === post.createdBy ||
      mentionedUserId === post.replyToUserId
    ) {
      continue;
    }

    await createNotification(ctx, {
      recipientId: mentionedUserId,
      actorId: post.createdBy,
      type: "post_mention",
      entityType: "schoolClassForumPosts",
      entityId: postId,
      previewTitle: forum.title,
      previewBody: truncatedBody,
    });
  }
}
