import { ModelIdSchema } from "@repo/ai/config/model";
import {
  internalMutation,
  mutation,
} from "@repo/backend/convex/_generated/server";
import { modelIdValueValidator } from "@repo/backend/convex/chats/schema";
import {
  readChatTurn,
  refundChatTurn,
  reserveChatTurn,
} from "@repo/backend/convex/chats/turns/impl";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { v } from "convex/values";
import { Effect } from "effect";

/** Admits one authenticated turn before the HTTP adapter starts provider work. */
export const reserve = mutation({
  args: { modelId: modelIdValueValidator },
  returns: v.id("chatTurns"),
  handler: async (ctx, args) => {
    const { appUser } = await requireAuth(ctx);
    return runConvexProgram(
      reserveChatTurn(ctx, appUser, ModelIdSchema.make(args.modelId))
    );
  },
});

/** Releases a hold when request preparation fails before the stream starts. */
export const release = mutation({
  args: { turnId: v.id("chatTurns") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { appUser } = await requireAuth(ctx);
    return runConvexProgram(
      Effect.gen(function* () {
        const turn = yield* readChatTurn(
          ctx,
          args.turnId,
          appUser._id,
          undefined
        );
        if (turn) {
          yield* refundChatTurn(ctx, turn);
        }
        return null;
      })
    );
  },
});

/** Recovers abandoned requests after the route's hard execution window. */
export const expire = internalMutation({
  args: { turnId: v.id("chatTurns") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const turn = await ctx.db.get("chatTurns", args.turnId);
    if (turn) {
      await runConvexProgram(refundChatTurn(ctx, turn));
    }
    return null;
  },
});
