import { query } from "@repo/backend/convex/_generated/server";
import { getOptionalAppUser } from "@repo/backend/convex/lib/helpers/auth";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { getActiveTryoutSet } from "@repo/backend/convex/tryouts/read";
import { tryoutRouteKeyValidator } from "@repo/backend/convex/tryouts/schema";
import { v } from "convex/values";

/** Authorizes answer content only after both the attempt and section terminate. */
export const canReadSection = query({
  args: {
    countryKey: tryoutRouteKeyValidator,
    examKey: tryoutRouteKeyValidator,
    locale: localeValidator,
    sectionKey: tryoutRouteKeyValidator,
    setKey: tryoutRouteKeyValidator,
    trackKey: tryoutRouteKeyValidator,
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const auth = await getOptionalAppUser(ctx);

    if (!auth) {
      return false;
    }

    const set = await getActiveTryoutSet(ctx, args);

    if (!set) {
      return false;
    }

    const attempt = await ctx.db
      .query("tryoutAttempts")
      .withIndex("by_userId_and_tryoutSetId_and_startedAt", (q) =>
        q.eq("userId", auth.appUser._id).eq("tryoutSetId", set._id)
      )
      .order("desc")
      .first();

    if (!attempt || attempt.status === "in-progress") {
      return false;
    }

    const section = await ctx.db
      .query("tryoutSectionAttempts")
      .withIndex("by_tryoutAttemptId_and_sectionKey", (q) =>
        q.eq("tryoutAttemptId", attempt._id).eq("sectionKey", args.sectionKey)
      )
      .unique();

    if (!section) {
      return false;
    }

    return section.status !== "in-progress";
  },
});
