import { mutation } from "@repo/backend/convex/functions";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { redeemEventAccessCode } from "@repo/backend/convex/tryoutAccess/redeem/impl";
import {
  redeemEventAccessArgs,
  redeemEventAccessResultValidator,
} from "@repo/backend/convex/tryoutAccess/redeem/spec";

/** Redeems one event access code for the authenticated user. */
export const redeemEventAccess = mutation({
  args: redeemEventAccessArgs,
  returns: redeemEventAccessResultValidator,
  handler: async (ctx, args) => {
    const { appUser } = await requireAuth(ctx);
    return await runConvexProgram(
      redeemEventAccessCode(ctx, {
        code: args.code,
        now: Date.now(),
        userId: appUser._id,
      })
    );
  },
});
