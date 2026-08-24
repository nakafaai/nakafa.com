import { saveCurrentConsent } from "@repo/backend/convex/consents/impl";
import {
  consentDecisionValidator,
  consentWriteValidator,
} from "@repo/backend/convex/consents/schema";
import { mutation } from "@repo/backend/convex/functions";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { ConvexError, v } from "convex/values";

/** Records one current-version account decision with its exact mechanism. */
export const setCurrent = mutation({
  args: {
    decision: consentWriteValidator,
    expectedUserId: v.id("users"),
  },
  returns: consentDecisionValidator,
  handler: async (ctx, { decision, expectedUserId }) => {
    const { appUser } = await requireAuth(ctx);
    if (appUser._id !== expectedUserId) {
      throw new ConvexError({
        code: "CONSENT_ACCOUNT_CHANGED",
        message: "The active account changed before consent could be saved.",
      });
    }

    return await runConvexProgram(
      saveCurrentConsent(ctx, {
        ...decision,
        userId: appUser._id,
      })
    );
  },
});
