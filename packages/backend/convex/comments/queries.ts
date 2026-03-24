import { query } from "@repo/backend/convex/_generated/server";
import {
  attachReplyToUsers,
  attachUsers,
} from "@repo/backend/convex/comments/utils";
import { userDataValidator } from "@repo/backend/convex/lib/validators/user";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { cleanSlug } from "@repo/backend/convex/utils/helper";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";
import { nullable } from "convex-helpers/validators";

const publicCommentUserValidator = v.object({
  _id: userDataValidator.fields._id,
  image: userDataValidator.fields.image,
  name: userDataValidator.fields.name,
});

const commentWithUserValidator = v.object({
  ...vv.doc("comments").fields,
  user: nullable(publicCommentUserValidator),
  replyToUser: nullable(publicCommentUserValidator),
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
      .withIndex("by_slug", (q) => q.eq("slug", cleanSlug(args.slug)))
      .order("desc")
      .paginate(args.paginationOpts);

    const [userMap, replyToUserMap] = await Promise.all([
      attachUsers(ctx, comments.page),
      attachReplyToUsers(ctx, comments.page),
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
  returns: paginationResultValidator(vv.doc("comments")),
  handler: async (ctx, args) =>
    ctx.db
      .query("comments")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .paginate(args.paginationOpts),
});
