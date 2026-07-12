import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import { type QueryCtx, query } from "@repo/backend/convex/_generated/server";
import { commentVoteValidator } from "@repo/backend/convex/comments/schema";
import { getOptionalAppUser } from "@repo/backend/convex/lib/helpers/auth";
import { getUserMap } from "@repo/backend/convex/lib/helpers/user";
import { userDataValidator } from "@repo/backend/convex/lib/validators/user";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { cleanSlug } from "@repo/utilities/helper";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";
import { asyncMap } from "convex-helpers";
import { nullable } from "convex-helpers/validators";

const publicCommentUserValidator = v.object({
  _id: userDataValidator.fields._id,
  image: userDataValidator.fields.image,
  name: userDataValidator.fields.name,
});

const commentWithViewerVoteValidator = v.object({
  ...vv.doc("comments").fields,
  viewerVote: nullable(commentVoteValidator),
});

const commentWithUserValidator = v.object({
  ...commentWithViewerVoteValidator.fields,
  user: nullable(publicCommentUserValidator),
  replyToUser: nullable(publicCommentUserValidator),
});

/** Load the current viewer's vote for each bounded comment page row. */
async function getViewerVotes(
  ctx: QueryCtx,
  comments: Doc<"comments">[],
  userId: Id<"users"> | null
) {
  if (!userId) {
    return new Map<Id<"comments">, -1 | 1>();
  }

  const votes = await asyncMap(comments, (comment) =>
    ctx.db
      .query("commentVotes")
      .withIndex("by_commentId_and_userId", (q) =>
        q.eq("commentId", comment._id).eq("userId", userId)
      )
      .unique()
  );

  return new Map(
    comments.flatMap((comment, index) => {
      const vote = votes[index];
      return vote ? [[comment._id, vote.vote] as const] : [];
    })
  );
}

export const getCommentsBySlug = query({
  args: {
    slug: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(commentWithUserValidator),
  handler: async (ctx, args) => {
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_slug", (q) => q.eq("slug", cleanSlug(args.slug)))
      .order("desc")
      .paginate(args.paginationOpts);
    const commentUserIds = comments.page.map((comment) => comment.userId);
    const replyToUserIds = comments.page.flatMap((comment) =>
      comment.replyToUserId ? [comment.replyToUserId] : []
    );

    const viewer = await getOptionalAppUser(ctx);
    const [userMap, replyToUserMap, viewerVotes] = await Promise.all([
      getUserMap(ctx, commentUserIds),
      getUserMap(ctx, replyToUserIds),
      getViewerVotes(ctx, comments.page, viewer?.appUser._id ?? null),
    ]);

    return {
      ...comments,
      page: comments.page.map((comment) => {
        const user = userMap.get(comment.userId);
        const replyToUser = comment.replyToUserId
          ? replyToUserMap.get(comment.replyToUserId)
          : undefined;

        return {
          ...comment,
          viewerVote: viewerVotes.get(comment._id) ?? null,
          user: user
            ? {
                _id: user._id,
                image: user.image,
                name: user.name,
              }
            : null,
          replyToUser: replyToUser
            ? {
                _id: replyToUser._id,
                image: replyToUser.image,
                name: replyToUser.name,
              }
            : null,
        };
      }),
    };
  },
});

export const getCommentsByUserId = query({
  args: {
    userId: vv.id("users"),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(commentWithViewerVoteValidator),
  handler: async (ctx, args) => {
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .paginate(args.paginationOpts);
    const viewer = await getOptionalAppUser(ctx);
    const viewerVotes = await getViewerVotes(
      ctx,
      comments.page,
      viewer?.appUser._id ?? null
    );

    return {
      ...comments,
      page: comments.page.map((comment) => ({
        ...comment,
        viewerVote: viewerVotes.get(comment._id) ?? null,
      })),
    };
  },
});
