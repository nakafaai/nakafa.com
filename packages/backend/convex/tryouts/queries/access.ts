import { query } from "@repo/backend/convex/_generated/server";
import { getOptionalAppUser } from "@repo/backend/convex/lib/helpers/auth";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { getActiveTryoutSet } from "@repo/backend/convex/tryouts/read";
import {
  getTryoutSectionContentAccess,
  tryoutSectionContentAccessValidator,
} from "@repo/backend/convex/tryouts/runtime/content";
import { tryoutRouteKeyValidator } from "@repo/backend/convex/tryouts/schema";

const noContentAccess = { answers: false, questions: false };

/** Authorizes server-rendered content for the current user's owned runtime. */
export const getSectionContent = query({
  args: {
    countryKey: tryoutRouteKeyValidator,
    examKey: tryoutRouteKeyValidator,
    locale: localeValidator,
    sectionKey: tryoutRouteKeyValidator,
    setKey: tryoutRouteKeyValidator,
    trackKey: tryoutRouteKeyValidator,
  },
  returns: tryoutSectionContentAccessValidator,
  handler: async (ctx, args) => {
    const auth = await getOptionalAppUser(ctx);

    if (!auth) {
      return noContentAccess;
    }

    const set = await getActiveTryoutSet(ctx, args);

    if (!set) {
      return noContentAccess;
    }

    const attempt = await ctx.db
      .query("tryoutAttempts")
      .withIndex("by_userId_and_tryoutSetId_and_startedAt", (q) =>
        q.eq("userId", auth.appUser._id).eq("tryoutSetId", set._id)
      )
      .order("desc")
      .first();

    if (!attempt) {
      return noContentAccess;
    }

    const section = await ctx.db
      .query("tryoutSectionAttempts")
      .withIndex("by_tryoutAttemptId_and_sectionKey", (q) =>
        q.eq("tryoutAttemptId", attempt._id).eq("sectionKey", args.sectionKey)
      )
      .unique();

    if (!section) {
      return noContentAccess;
    }

    return getTryoutSectionContentAccess(attempt.status, section.status);
  },
});
