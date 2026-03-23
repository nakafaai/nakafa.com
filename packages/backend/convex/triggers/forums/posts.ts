import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import { updateForumReadState } from "@repo/backend/convex/triggers/helpers/forums";
import { createNotification } from "@repo/backend/convex/triggers/helpers/notifications";
import { truncateText } from "@repo/backend/convex/utils/helper";
import type { GenericMutationCtx } from "convex/server";
import type { Change } from "convex-helpers/server/triggers";

/**
 * Updates forum counters and last-post metadata after inserting one post.
 */
async function updateForumAfterInsert(
  ctx: GenericMutationCtx<DataModel>,
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

/**
 * Updates forum counters and last-post metadata after deleting one post.
 */
async function updateForumAfterDelete(
  ctx: GenericMutationCtx<DataModel>,
  oldPost: NonNullable<Change<DataModel, "schoolClassForumPosts">["oldDoc"]>
) {
  const forum = await ctx.db.get("schoolClassForums", oldPost.forumId);

  if (!forum) {
    return;
  }

  const latestRemainingPost = await ctx.db
    .query("schoolClassForumPosts")
    .withIndex("forumId", (q) => q.eq("forumId", oldPost.forumId))
    .order("desc")
    .first();

  await ctx.db.patch("schoolClassForums", oldPost.forumId, {
    postCount: Math.max(forum.postCount - 1, 0),
    lastPostAt: latestRemainingPost?._creationTime ?? forum._creationTime,
    lastPostBy: latestRemainingPost?.createdBy ?? forum.createdBy,
    updatedAt: Date.now(),
  });
}

/**
 * Sends reply and mention notifications for one newly inserted forum post.
 */
async function notifyForumPostParticipants(
  ctx: GenericMutationCtx<DataModel>,
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

/**
 * Trigger handler for schoolClassForumPosts table changes.
 *
 * Manages forum post lifecycle with comprehensive side effects:
 * - Updates forum statistics (post count, last post info)
 * - Updates author's read state to prevent unread flash
 * - Creates notifications for replies and mentions
 * - Manages reply counts on parent posts
 *
 * @param ctx - The Convex mutation context with database access
 * @param change - The change object containing operation details and document state
 */
export async function forumPostsHandler(
  ctx: GenericMutationCtx<DataModel>,
  change: Change<DataModel, "schoolClassForumPosts">
) {
  const post = change.newDoc;
  const oldPost = change.oldDoc;

  switch (change.operation) {
    case "insert": {
      if (!post) {
        break;
      }

      const forum = await updateForumAfterInsert(ctx, post);
      if (forum) {
        await updateForumReadState(ctx, {
          forumId: post.forumId,
          classId: post.classId,
          userId: post.createdBy,
          lastReadAt: post._creationTime,
          lastReadPostId: post._id,
        });

        await notifyForumPostParticipants(ctx, {
          forum,
          post,
          postId: change.id,
        });
      }

      if (post.parentId) {
        const parentPost = await ctx.db.get(
          "schoolClassForumPosts",
          post.parentId
        );
        if (parentPost) {
          await ctx.db.patch("schoolClassForumPosts", post.parentId, {
            replyCount: parentPost.replyCount + 1,
            updatedAt: Date.now(),
          });
        }
      }
      break;
    }

    case "delete": {
      if (!oldPost) {
        break;
      }

      await updateForumAfterDelete(ctx, oldPost);

      if (oldPost.parentId) {
        const parentPost = await ctx.db.get(
          "schoolClassForumPosts",
          oldPost.parentId
        );
        if (parentPost) {
          await ctx.db.patch("schoolClassForumPosts", oldPost.parentId, {
            replyCount: Math.max(parentPost.replyCount - 1, 0),
            updatedAt: Date.now(),
          });
        }
      }
      break;
    }

    default: {
      break;
    }
  }
}
