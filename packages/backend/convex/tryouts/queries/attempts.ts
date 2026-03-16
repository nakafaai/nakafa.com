import { query } from "@repo/backend/convex/_generated/server";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { getFirstCompletedSimulationAttempt } from "@repo/backend/convex/tryouts/helpers";
import { tryoutProductValidator } from "@repo/backend/convex/tryouts/products";
import { ConvexError, v } from "convex/values";
import {
  getAll,
  getManyFrom,
  getOneFrom,
} from "convex-helpers/server/relationships";
import { nullable } from "convex-helpers/validators";

/** Returns the authenticated user's latest tryout attempt for one tryout slug. */
export const getUserTryoutAttempt = query({
  args: {
    product: tryoutProductValidator,
    locale: localeValidator,
    tryoutSlug: v.string(),
  },
  returns: nullable(
    v.object({
      attempt: vv.doc("tryoutAttempts"),
      partAttempts: v.array(
        v.object({
          partIndex: v.number(),
          setAttempt: vv.doc("exerciseAttempts"),
          setId: vv.id("exerciseSets"),
        })
      ),
      completedPartIndices: v.array(v.number()),
      nextPartIndex: v.optional(v.number()),
      practiceUnlocked: v.boolean(),
      isOfficialAttempt: v.boolean(),
    })
  ),
  handler: async (ctx, args) => {
    const { appUser } = await requireAuth(ctx);

    const tryout = await ctx.db
      .query("tryouts")
      .withIndex("product_locale_slug", (q) =>
        q
          .eq("product", args.product)
          .eq("locale", args.locale)
          .eq("slug", args.tryoutSlug)
      )
      .unique();

    if (!tryout) {
      return null;
    }

    const attempt = await ctx.db
      .query("tryoutAttempts")
      .withIndex("userId_tryoutId_startedAt", (q) =>
        q.eq("userId", appUser._id).eq("tryoutId", tryout._id)
      )
      .order("desc")
      .first();

    if (!attempt) {
      return null;
    }

    const partAttempts = await getManyFrom(
      ctx.db,
      "tryoutPartAttempts",
      "tryoutAttemptId_partIndex",
      attempt._id,
      "tryoutAttemptId"
    );
    const setAttemptIds = partAttempts.map(
      (partAttempt) => partAttempt.setAttemptId
    );
    const setAttempts = await getAll(ctx.db, "exerciseAttempts", setAttemptIds);

    const validPartAttempts = partAttempts.map((partAttempt, index) => {
      const setAttempt = setAttempts[index];

      if (!setAttempt) {
        throw new ConvexError({
          code: "INVALID_ATTEMPT_STATE",
          message: "Part attempt is missing its exercise attempt.",
        });
      }

      return {
        partIndex: partAttempt.partIndex,
        setAttempt,
        setId: partAttempt.setId,
      };
    });

    const tryoutPartSets = await getManyFrom(
      ctx.db,
      "tryoutPartSets",
      "tryoutId_partIndex",
      tryout._id,
      "tryoutId"
    );
    const allPartIndices = tryoutPartSets.map((partSet) => partSet.partIndex);
    const completedPartIndices = attempt.completedPartIndices;
    const nextPartIndex = allPartIndices.find(
      (partIndex) => !completedPartIndices.includes(partIndex)
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
      partAttempts: validPartAttempts,
      completedPartIndices,
      nextPartIndex,
      practiceUnlocked: firstCompletedAttempt !== null,
      isOfficialAttempt: firstCompletedAttempt?._id === attempt._id,
    };
  },
});

/** Resolves tryout context from a shared set-attempt id. */
export const getTryoutContextForAttempt = query({
  args: {
    setAttemptId: vv.id("exerciseAttempts"),
  },
  returns: nullable(
    v.object({
      tryoutAttemptId: vv.id("tryoutAttempts"),
      tryoutId: vv.id("tryouts"),
      tryoutSlug: v.string(),
      product: tryoutProductValidator,
      partIndex: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const { appUser } = await requireAuth(ctx);

    const partAttempt = await getOneFrom(
      ctx.db,
      "tryoutPartAttempts",
      "setAttemptId",
      args.setAttemptId
    );

    if (!partAttempt) {
      return null;
    }

    const tryoutAttempt = await ctx.db.get(
      "tryoutAttempts",
      partAttempt.tryoutAttemptId
    );

    if (!tryoutAttempt || tryoutAttempt.status !== "in-progress") {
      return null;
    }

    if (tryoutAttempt.userId !== appUser._id) {
      return null;
    }

    const tryout = await ctx.db.get("tryouts", tryoutAttempt.tryoutId);

    if (!tryout) {
      throw new ConvexError({
        code: "INVALID_ATTEMPT_STATE",
        message: "Part attempt is missing its parent tryout.",
      });
    }

    return {
      tryoutAttemptId: tryoutAttempt._id,
      tryoutId: tryoutAttempt.tryoutId,
      tryoutSlug: tryout.slug,
      product: tryout.product,
      partIndex: partAttempt.partIndex,
    };
  },
});
