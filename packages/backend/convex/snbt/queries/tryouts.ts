import { query } from "@repo/backend/convex/_generated/server";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { ConvexError, v } from "convex/values";
import { getAll, getManyFrom } from "convex-helpers/server/relationships";

/**
 * List active SNBT try-outs for a locale.
 */
export const getActiveTryouts = query({
  args: {
    locale: localeValidator,
  },
  returns: v.array(vv.doc("snbtTryouts")),
  handler: async (ctx, args) => {
    const tryouts = await ctx.db
      .query("snbtTryouts")
      .withIndex("locale_isActive", (q) =>
        q.eq("locale", args.locale).eq("isActive", true)
      )
      .collect();

    return [...tryouts].sort(
      (left, right) =>
        right.year - left.year || left.setName.localeCompare(right.setName)
    );
  },
});

/**
 * Load one try-out and its ordered subject set metadata.
 */
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

    const tryoutSets = await getManyFrom(
      ctx.db,
      "snbtTryoutSets",
      "tryoutId_subjectIndex",
      tryout._id,
      "tryoutId"
    );

    const sets = await getAll(
      ctx.db,
      "exerciseSets",
      tryoutSets.map((ts) => ts.setId)
    );

    const subjects = tryoutSets.map((ts, i) => {
      const set = sets[i];

      if (!set) {
        throw new ConvexError({
          code: "INVALID_TRYOUT_STATE",
          message: "Tryout is missing one of its subject sets.",
        });
      }

      return {
        subjectIndex: ts.subjectIndex,
        setId: ts.setId,
        material: set.material,
        title: set.title,
        questionCount: set.questionCount,
      };
    });

    return { tryout, subjects };
  },
});
