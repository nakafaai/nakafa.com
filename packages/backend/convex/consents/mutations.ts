import { saveCurrentConsent } from "@repo/backend/convex/consents/impl";
import {
  consentDecisionValidator,
  consentWriteValidator,
} from "@repo/backend/convex/consents/schema";
import { mutation } from "@repo/backend/convex/functions";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";

/** Records one current-version account decision with its exact mechanism. */
export const setCurrent = mutation({
  args: consentWriteValidator,
  returns: consentDecisionValidator,
  handler: async (ctx, args) => {
    const { appUser } = await requireAuth(ctx);
    return await runConvexProgram(
      saveCurrentConsent(ctx, {
        ...args,
        userId: appUser._id,
      })
    );
  },
});
