import { query } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { getOptionalAppUser } from "@repo/backend/convex/lib/helpers/auth";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { getTryoutStartAccess } from "@repo/backend/convex/tryouts/access/impl";
import { getActiveTryoutSet } from "@repo/backend/convex/tryouts/read";
import {
  getTryoutSectionContentAccess,
  tryoutSectionContentAccessValidator,
} from "@repo/backend/convex/tryouts/runtime/content";
import { tryoutRouteKeyValidator } from "@repo/backend/convex/tryouts/schema";
import {
  startAccessArgsValidator,
  toTryoutStartError,
  tryoutStartAccessValidator,
} from "@repo/backend/convex/tryouts/start/spec";
import { Effect } from "effect";

const noContentAccess = { answers: false, questions: false };

/** Returns the advisory access state for the try-out start dialog. */
export const getStartAccess = query({
  args: startAccessArgsValidator,
  returns: tryoutStartAccessValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      Effect.gen(function* () {
        const auth = yield* Effect.tryPromise({
          catch: toTryoutStartError,
          try: () => getOptionalAppUser(ctx),
        });

        if (!auth) {
          return { kind: "free-attempt" } as const;
        }

        return yield* getTryoutStartAccess(ctx, {
          ...args,
          userId: auth.appUser._id,
        });
      })
    ),
});

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
