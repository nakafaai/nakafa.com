import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { query } from "@repo/backend/convex/_generated/server";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { v } from "convex/values";
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
    const identity = await ctx.auth.getUserIdentity();
    const email = identity?.email;
    if (!email) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first();

    if (!user) {
      return null;
    }

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
        q.eq("userId", user._id).eq("tryoutId", tryout._id)
      )
      .order("desc")
      .first();

    if (!attempt) {
      return null;
    }

    const subjectAttempts = await ctx.db
      .query("snbtTryoutSubjectAttempts")
      .withIndex("tryoutAttemptId", (q) => q.eq("tryoutAttemptId", attempt._id))
      .collect();

    const subjectAttemptDetails = await Promise.all(
      subjectAttempts.map(async (sa) => {
        const setAttempt = await ctx.db.get(sa.setAttemptId);
        return {
          subjectIndex: sa.subjectIndex,
          setAttempt: setAttempt ?? null,
          setId: sa.setId,
        };
      })
    );

    const validSubjectAttempts = subjectAttemptDetails.filter(
      (
        sa
      ): sa is {
        subjectIndex: number;
        setAttempt: NonNullable<
          (typeof subjectAttemptDetails)[number]["setAttempt"]
        >;
        setId: Id<"exerciseSets">;
      } => sa.setAttempt !== null
    );

    const completedSubjectIndices = attempt.completedSubjectIndices;

    const tryoutSets = await ctx.db
      .query("snbtTryoutSets")
      .withIndex("tryoutId", (q) => q.eq("tryoutId", tryout._id))
      .collect();

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
