import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { updateForumReadState } from "@repo/backend/convex/classes/forums/utils/readStateWrite";
import {
  notifyForumPostParticipants,
  updateForumAfterDelete,
  updateForumAfterInsert,
} from "@repo/backend/convex/triggers/helpers/forumPosts";
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
  ctx: MutationCtx,
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
