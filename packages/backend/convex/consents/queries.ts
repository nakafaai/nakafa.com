import { ANALYTICS_CONSENT_NOTICE_VERSION } from "@repo/analytics/consent";
import { query } from "@repo/backend/convex/_generated/server";
import { readCurrentConsent } from "@repo/backend/convex/consents/impl";
import {
  consentCategoryValidator,
  currentConsentStateValidator,
} from "@repo/backend/convex/consents/schema";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";

/** Returns one authenticated account's current consent decision. */
export const getCurrent = query({
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
