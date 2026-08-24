import { ANALYTICS_CONSENT_NOTICE_VERSION } from "@repo/analytics/consent";
import { query } from "@repo/backend/convex/_generated/server";
import {
  readCurrentConsent,
  saveCurrentConsent,
} from "@repo/backend/convex/consents/impl";
import {
  consentCategoryValidator,
  consentDecisionValidator,
  consentWriteValidator,
  currentConsentStateValidator,
} from "@repo/backend/convex/consents/schema";
import { mutation } from "@repo/backend/convex/functions";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { ConvexError, v } from "convex/values";

/** Returns one authenticated account's current consent decision. */
export const get = query({
  args: {
    category: consentCategoryValidator,
  },
  returns: currentConsentStateValidator,
  handler: async (ctx, args) => {
    const { appUser } = await requireAuth(ctx);
    const decision = await runConvexProgram(
      readCurrentConsent(ctx, appUser._id, args.category)
    );

    return {
      currentNoticeVersion: ANALYTICS_CONSENT_NOTICE_VERSION,
      decision,
    };
  },
});

/** Records a decision only when the initiating account is still active. */
export const set = mutation({
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
