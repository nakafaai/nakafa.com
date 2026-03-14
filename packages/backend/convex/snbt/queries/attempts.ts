import { query } from "@repo/backend/convex/_generated/server";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { getFirstCompletedSimulationAttempt } from "@repo/backend/convex/snbt/helpers";
import { v } from "convex/values";
import {
  getAll,
  getManyFrom,
  getOneFrom,
} from "convex-helpers/server/relationships";
import { nullable } from "convex-helpers/validators";

/**
 * Load the current user's latest attempt for a try-out, including subject-level
 * simulation progress and whether standalone practice is unlocked.
 */
export const getUserTryoutAttempt = query({
  args: {
    locale: localeValidator,
    tryoutSlug: v.string(),
  },
  returns: nullable(
    v.object({
      attempt: vv.doc("snbtTryoutAttempts"),
      subjectAttempts: v.array(
        v.object({
          subjectIndex: v.number(),
          setAttempt: vv.doc("exerciseAttempts"),
          setId: vv.id("exerciseSets"),
        })
      ),
      completedSubjectIndices: v.array(v.number()),
      nextSubjectIndex: v.optional(v.number()),
      practiceUnlocked: v.boolean(),
      isOfficialAttempt: v.boolean(),
    })
  ),
  handler: async (ctx, args) => {
    const { appUser } = await requireAuth(ctx);

    const tryout = await ctx.db
      .query("snbtTryouts")
      .withIndex("locale_slug", (q) =>
        q.eq("locale", args.locale).eq("slug", args.tryoutSlug)
      )
      .first();

    if (!tryout) {
      return null;
    }

    const attempt = await ctx.db
      .query("snbtTryoutAttempts")
      .withIndex("userId_tryoutId", (q) =>
        q.eq("userId", appUser._id).eq("tryoutId", tryout._id)
      )
      .order("desc")
      .first();

    if (!attempt) {
      return null;
    }

    const subjectAttempts = await getManyFrom(
      ctx.db,
      "snbtTryoutSubjectAttempts",
      "tryoutAttemptId_subjectIndex",
      attempt._id,
      "tryoutAttemptId"
    );

    const setAttemptIds = subjectAttempts.map((sa) => sa.setAttemptId);
    const setAttempts = await getAll(ctx.db, "exerciseAttempts", setAttemptIds);

    const validSubjectAttempts = subjectAttempts
      .map((sa, i) => {
        const setAttempt = setAttempts[i];
        if (!setAttempt) {
          return null;
        }
        return {
          subjectIndex: sa.subjectIndex,
          setAttempt,
          setId: sa.setId,
        };
      })
      .filter((x) => x !== null);

    const completedSubjectIndices = attempt.completedSubjectIndices;

    const tryoutSets = await getManyFrom(
      ctx.db,
      "snbtTryoutSets",
      "tryoutId_subjectIndex",
      tryout._id,
      "tryoutId"
    );

    const allSubjectIndices = tryoutSets.map((ts) => ts.subjectIndex);
    const nextSubjectIndex = allSubjectIndices.find(
      (idx) => !completedSubjectIndices.includes(idx)
    );

    const firstCompletedAttempt = await getFirstCompletedSimulationAttempt(
      ctx.db,
      {
        userId: appUser._id,
        tryoutId: tryout._id,
      }
    );

    return {
      attempt,
      subjectAttempts: validSubjectAttempts,
      completedSubjectIndices,
      nextSubjectIndex,
      practiceUnlocked: firstCompletedAttempt !== null,
      isOfficialAttempt: firstCompletedAttempt?._id === attempt._id,
    };
  },
});

/**
 * Resolve SNBT try-out context for a shared `exerciseAttempt`.
 */
export const getTryoutContextForAttempt = query({
  args: {
    setAttemptId: vv.id("exerciseAttempts"),
  },
  returns: nullable(
    v.object({
      tryoutAttemptId: vv.id("snbtTryoutAttempts"),
      tryoutId: vv.id("snbtTryouts"),
      tryoutSlug: v.string(),
      subjectIndex: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const subjectAttempt = await getOneFrom(
      ctx.db,
      "snbtTryoutSubjectAttempts",
      "setAttemptId",
      args.setAttemptId
    );

    if (!subjectAttempt) {
      return null;
    }

    const tryoutAttempt = await ctx.db.get(
      "snbtTryoutAttempts",
      subjectAttempt.tryoutAttemptId
    );

    if (!tryoutAttempt || tryoutAttempt.status !== "in-progress") {
      return null;
    }

    const tryout = await ctx.db.get("snbtTryouts", tryoutAttempt.tryoutId);

    return {
      tryoutAttemptId: tryoutAttempt._id,
      tryoutId: tryoutAttempt.tryoutId,
      tryoutSlug: tryout?.slug ?? "",
      subjectIndex: subjectAttempt.subjectIndex,
    };
  },
});
