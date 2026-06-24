import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { query } from "@repo/backend/convex/_generated/server";
import { verifyChatOwnership } from "@repo/backend/convex/chats/helpers";
import { getOptionalAppUser } from "@repo/backend/convex/lib/helpers/auth";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { paginatedMathWorkStepsValidator } from "@repo/backend/convex/math/schema";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";

const MAX_MATH_WORK_READ_ROWS = 100;

/** Reads one normalized MathWork root with compact child summaries. */
export const get = query({
  args: {
    chatId: vv.id("chats"),
    workId: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      artifacts: v.array(vv.doc("mathWorkArtifacts")),
      computations: v.array(vv.doc("mathComputations")),
      work: vv.doc("mathWorks"),
    })
  ),
  handler: async (ctx, args) => {
    const viewer = await requireMathViewer(ctx, args.chatId);
    const work = await ctx.db
      .query("mathWorks")
      .withIndex("by_chatId_and_workId", (q) =>
        q.eq("chatId", args.chatId).eq("workId", args.workId)
      )
      .unique();

    if (!work) {
      return null;
    }

    if (work.userId !== viewer.appUser._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "You do not have permission to read this MathWork.",
      });
    }

    const computations = await ctx.db
      .query("mathComputations")
      .withIndex("by_chatId_and_workId_and_order", (q) =>
        q.eq("chatId", args.chatId).eq("workId", args.workId)
      )
      .take(MAX_MATH_WORK_READ_ROWS);
    const artifacts = await ctx.db
      .query("mathWorkArtifacts")
      .withIndex("by_chatId_and_workId_and_kind", (q) =>
        q.eq("chatId", args.chatId).eq("workId", args.workId)
      )
      .take(MAX_MATH_WORK_READ_ROWS);

    return { artifacts, computations, work };
  },
});

/** Lists MathWork derivation steps with Convex pagination. */
export const listSteps = query({
  args: {
    chatId: vv.id("chats"),
    paginationOpts: paginationOptsValidator,
    workId: v.string(),
  },
  returns: paginatedMathWorkStepsValidator,
  handler: async (ctx, args) => {
    const viewer = await requireMathViewer(ctx, args.chatId);
    const work = await ctx.db
      .query("mathWorks")
      .withIndex("by_chatId_and_workId", (q) =>
        q.eq("chatId", args.chatId).eq("workId", args.workId)
      )
      .unique();

    if (!work || work.userId !== viewer.appUser._id) {
      throw new ConvexError({
        code: "MATH_WORK_NOT_FOUND",
        message: "MathWork was not found for this chat.",
      });
    }

    return await ctx.db
      .query("mathWorkSteps")
      .withIndex("by_chatId_and_workId_and_order", (q) =>
        q.eq("chatId", args.chatId).eq("workId", args.workId)
      )
      .paginate(args.paginationOpts);
  },
});

/** Resolves the signed-in user and verifies ownership of the chat. */
async function requireMathViewer(ctx: QueryCtx, chatId: Id<"chats">) {
  const viewer = await getOptionalAppUser(ctx);

  if (!viewer) {
    throw new ConvexError({
      code: "UNAUTHORIZED",
      message: "Sign in is required to read MathWork.",
    });
  }

  await verifyChatOwnership(ctx, chatId, viewer.appUser._id);

  return viewer;
}
