import { query } from "@repo/backend/convex/_generated/server";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { v } from "convex/values";
import { getAll, getManyFrom } from "convex-helpers/server/relationships";
import { nullable } from "convex-helpers/validators";

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
      "tryoutAttemptId",
      attempt._id
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
      "tryoutId",
      tryout._id
    );

    const allSubjectIndices = tryoutSets.map((ts) => ts.subjectIndex);
    const nextSubjectIndex = allSubjectIndices.find(
      (idx) => !completedSubjectIndices.includes(idx)
    );

    return {
      attempt,
      subjectAttempts: validSubjectAttempts,
      completedSubjectIndices,
      nextSubjectIndex,
    };
  },
});

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
      mode: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const subjectAttempt = await ctx.db
      .query("snbtTryoutSubjectAttempts")
      .withIndex("setAttemptId", (q) => q.eq("setAttemptId", args.setAttemptId))
      .first();

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
      mode: tryoutAttempt.mode,
    };
  },
});
