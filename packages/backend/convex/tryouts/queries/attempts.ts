import { query } from "@repo/backend/convex/_generated/server";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { getFirstCompletedSimulationAttempt } from "@repo/backend/convex/tryouts/helpers";
import {
  computeTryoutExpiresAtMs,
  tryoutProductValidator,
} from "@repo/backend/convex/tryouts/products";
import { tryoutPartKeyValidator } from "@repo/backend/convex/tryouts/schema";
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
          partKey: tryoutPartKeyValidator,
          setAttempt: vv.doc("exerciseAttempts"),
          setId: vv.id("exerciseSets"),
        })
      ),
      completedPartIndices: v.array(v.number()),
      nextPartKey: v.optional(tryoutPartKeyValidator),
      expiresAtMs: v.number(),
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

    const tryoutPartSets = await getManyFrom(
      ctx.db,
      "tryoutPartSets",
      "tryoutId_partIndex",
      tryout._id,
      "tryoutId"
    );
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
        partKey: partAttempt.partKey,
        setAttempt,
        setId: partAttempt.setId,
      };
    });
    const allPartIndices = tryoutPartSets.map((partSet) => partSet.partIndex);
    const completedPartIndices = attempt.completedPartIndices;
    const activePartAttempt = validPartAttempts.find(
      (partAttempt) =>
        partAttempt.setAttempt.status === "in-progress" &&
        !completedPartIndices.includes(partAttempt.partIndex)
    );
    const nextPartIndex = allPartIndices.find(
      (partIndex) => !completedPartIndices.includes(partIndex)
    );
    const nextPartKey =
      activePartAttempt?.partKey ??
      tryoutPartSets.find((partSet) => partSet.partIndex === nextPartIndex)
        ?.partKey;

    const firstCompletedAttempt = await getFirstCompletedSimulationAttempt(
      ctx.db,
      {
        userId: appUser._id,
        tryoutId: tryout._id,
      }
    );
    const expiresAtMs = computeTryoutExpiresAtMs({
      product: tryout.product,
      startedAtMs: attempt.startedAt,
    });

    return {
      attempt,
      partAttempts: validPartAttempts,
      completedPartIndices,
      nextPartKey,
      expiresAtMs,
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
      partKey: tryoutPartKeyValidator,
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
      partKey: partAttempt.partKey,
    };
  },
});

/** Returns the authenticated user's runtime state for one tryout part. */
export const getUserTryoutPartAttempt = query({
  args: {
    product: tryoutProductValidator,
    locale: localeValidator,
    tryoutSlug: v.string(),
    partKey: tryoutPartKeyValidator,
  },
  returns: nullable(
    v.object({
      tryoutAttempt: vv.doc("tryoutAttempts"),
      expiresAtMs: v.number(),
      nextPartKey: v.optional(tryoutPartKeyValidator),
      completedPartIndices: v.array(v.number()),
      partAttempt: nullable(
        v.object({
          partIndex: v.number(),
          partKey: tryoutPartKeyValidator,
          setAttempt: vv.doc("exerciseAttempts"),
          answers: v.array(vv.doc("exerciseAnswers")),
        })
      ),
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

    const tryoutAttempt = await ctx.db
      .query("tryoutAttempts")
      .withIndex("userId_tryoutId_startedAt", (q) =>
        q.eq("userId", appUser._id).eq("tryoutId", tryout._id)
      )
      .order("desc")
      .first();

    if (!tryoutAttempt) {
      return null;
    }

    const tryoutPartSets = await getManyFrom(
      ctx.db,
      "tryoutPartSets",
      "tryoutId_partIndex",
      tryout._id,
      "tryoutId"
    );
    const activePartAttempts = await getManyFrom(
      ctx.db,
      "tryoutPartAttempts",
      "tryoutAttemptId_partIndex",
      tryoutAttempt._id,
      "tryoutAttemptId"
    );
    const activeSetAttempts = await getAll(
      ctx.db,
      "exerciseAttempts",
      activePartAttempts.map((partAttempt) => partAttempt.setAttemptId)
    );
    const activePartKey = activePartAttempts.find((partAttempt, index) => {
      const setAttempt = activeSetAttempts[index];

      return (
        setAttempt?.status === "in-progress" &&
        !tryoutAttempt.completedPartIndices.includes(partAttempt.partIndex)
      );
    })?.partKey;
    const nextPartIndex = tryoutPartSets
      .map((partSet) => partSet.partIndex)
      .find(
        (partIndex) => !tryoutAttempt.completedPartIndices.includes(partIndex)
      );
    const nextPartKey =
      activePartKey ??
      tryoutPartSets.find((partSet) => partSet.partIndex === nextPartIndex)
        ?.partKey;

    const partAttempt = await ctx.db
      .query("tryoutPartAttempts")
      .withIndex("tryoutAttemptId_partKey", (q) =>
        q.eq("tryoutAttemptId", tryoutAttempt._id).eq("partKey", args.partKey)
      )
      .unique();

    if (!partAttempt) {
      return {
        tryoutAttempt,
        expiresAtMs: computeTryoutExpiresAtMs({
          product: tryout.product,
          startedAtMs: tryoutAttempt.startedAt,
        }),
        nextPartKey,
        completedPartIndices: tryoutAttempt.completedPartIndices,
        partAttempt: null,
      };
    }

    const setAttempt = await ctx.db.get(
      "exerciseAttempts",
      partAttempt.setAttemptId
    );

    if (!setAttempt) {
      throw new ConvexError({
        code: "INVALID_ATTEMPT_STATE",
        message: "Tryout part is missing its exercise attempt.",
      });
    }

    const answers = await getManyFrom(
      ctx.db,
      "exerciseAnswers",
      "attemptId_exerciseNumber",
      partAttempt.setAttemptId,
      "attemptId"
    );

    return {
      tryoutAttempt,
      expiresAtMs: computeTryoutExpiresAtMs({
        product: tryout.product,
        startedAtMs: tryoutAttempt.startedAt,
      }),
      nextPartKey,
      completedPartIndices: tryoutAttempt.completedPartIndices,
      partAttempt: {
        partIndex: partAttempt.partIndex,
        partKey: partAttempt.partKey,
        setAttempt,
        answers,
      },
    };
  },
});
