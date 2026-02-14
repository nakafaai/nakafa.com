import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import { updateForumReadState } from "@repo/backend/convex/triggers/helpers/forums";
import { createNotification } from "@repo/backend/convex/triggers/helpers/notifications";
import { truncateText } from "@repo/backend/convex/utils/helper";
import type { GenericMutationCtx } from "convex/server";
import type { Change } from "convex-helpers/server/triggers";

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

      const forum = await ctx.db.get("schoolClassForums", post.forumId);
      if (forum) {
        await ctx.db.patch("schoolClassForums", post.forumId, {
          postCount: forum.postCount + 1,
          lastPostAt: post._creationTime,
          lastPostBy: post.createdBy,
          updatedAt: Date.now(),
        });

        await updateForumReadState(ctx, {
          forumId: post.forumId,
          classId: post.classId,
          userId: post.createdBy,
          lastReadAt: post._creationTime,
        });

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
            entityId: change.id,
            previewTitle: forum.title,
            previewBody: truncatedBody,
          });
        }

        if (post.mentions.length > 0) {
          for (const mentionedUserId of post.mentions) {
            if (
              mentionedUserId !== post.createdBy &&
              mentionedUserId !== post.replyToUserId
            ) {
              await createNotification(ctx, {
                recipientId: mentionedUserId,
                actorId: post.createdBy,
                type: "post_mention",
                entityType: "schoolClassForumPosts",
                entityId: change.id,
                previewTitle: forum.title,
                previewBody: truncatedBody,
              });
            }
          }
        }
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

      const forum = await ctx.db.get("schoolClassForums", oldPost.forumId);
      if (forum) {
        await ctx.db.patch("schoolClassForums", oldPost.forumId, {
          postCount: Math.max(forum.postCount - 1, 0),
          updatedAt: Date.now(),
        });
      }

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
