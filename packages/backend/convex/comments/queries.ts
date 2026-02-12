import { query } from "@repo/backend/convex/_generated/server";
import {
  attachReplyToUsers,
  attachUsers,
} from "@repo/backend/convex/comments/utils";
import { cleanSlug } from "@repo/backend/convex/utils/helper";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";
import { nullable } from "convex-helpers/validators";
import { vv } from "@/convex/lib/validators/vv";

/**
 * Validator for UserData (subset of user doc used in attachUsers).
 * Matches the UserData interface in lib/userHelpers.ts
 */
const userDataValidator = v.object({
  _id: vv.id("users"),
  name: v.string(),
  email: v.string(),
  image: v.optional(v.union(v.string(), v.null())),
});

const commentWithUserValidator = v.object({
  ...vv.doc("comments").fields,
  user: nullable(userDataValidator),
  replyToUser: nullable(userDataValidator),
});

export const getCommentsBySlug = query({
  args: {
    slug: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(commentWithUserValidator),
  handler: async (ctx, args) => {
    const comments = await ctx.db
      .query("comments")
      .withIndex("slug", (q) => q.eq("slug", cleanSlug(args.slug)))
      .order("desc")
      .paginate(args.paginationOpts);

    const [userMap, replyToUserMap] = await Promise.all([
      attachUsers(ctx, comments.page),
      attachReplyToUsers(ctx, comments.page),
    ]);

    return {
      ...comments,
      page: comments.page.map((comment) => ({
        ...comment,
        user: userMap.get(comment.userId) ?? null,
        replyToUser: comment.replyToUserId
          ? (replyToUserMap.get(comment.replyToUserId) ?? null)
          : null,
      })),
    };
  },
});

export const getCommentsByUserId = query({
  args: {
    userId: vv.id("users"),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(vv.doc("comments")),
  handler: async (ctx, args) =>
    ctx.db
      .query("comments")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .paginate(args.paginationOpts),
});
