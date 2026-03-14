import { query } from "@repo/backend/convex/_generated/server";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { v } from "convex/values";
import { getAll } from "convex-helpers/server/relationships";

export const getActiveTryouts = query({
  args: {
    locale: localeValidator,
  },
  returns: v.array(
    v.object({
      _id: vv.id("snbtTryouts"),
      _creationTime: v.number(),
      locale: localeValidator,
      year: v.number(),
      slug: v.string(),
      setName: v.string(),
      subjectCount: v.number(),
      questionCountPerSubject: v.number(),
      totalQuestionCount: v.number(),
      isActive: v.boolean(),
      detectedAt: v.number(),
      syncedAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const tryouts = await ctx.db
      .query("snbtTryouts")
      .withIndex("locale_isActive", (q) =>
        q.eq("locale", args.locale).eq("isActive", true)
      )
      .collect();

    return tryouts;
  },
});

export const getTryoutDetails = query({
  args: {
    locale: localeValidator,
    slug: v.string(),
  },
  returns: vv.nullable(
    v.object({
      tryout: vv.doc("snbtTryouts"),
      subjects: v.array(
        v.object({
          subjectIndex: v.number(),
          setId: vv.id("exerciseSets"),
          material: v.string(),
          title: v.string(),
          questionCount: v.number(),
        })
      ),
    })
  ),
  handler: async (ctx, args) => {
    const tryout = await ctx.db
      .query("snbtTryouts")
      .withIndex("locale_slug", (q) =>
        q.eq("locale", args.locale).eq("slug", args.slug)
      )
      .first();

    if (!tryout) {
      return null;
    }

    const tryoutSets = await ctx.db
      .query("snbtTryoutSets")
      .withIndex("tryoutId", (q) => q.eq("tryoutId", tryout._id))
      .collect();

    const sets = await getAll(
      ctx.db,
      "exerciseSets",
      tryoutSets.map((ts) => ts.setId)
    );

    const subjects = tryoutSets
      .map((ts, i) => {
        const set = sets[i];
        return {
          subjectIndex: ts.subjectIndex,
          setId: ts.setId,
          material: set?.material ?? "",
          title: set?.title ?? "",
          questionCount: set?.questionCount ?? 0,
        };
      })
      .sort((a, b) => a.subjectIndex - b.subjectIndex);

    return { tryout, subjects };
  },
});
