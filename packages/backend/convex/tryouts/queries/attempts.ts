import { query } from "@repo/backend/convex/_generated/server";
import { attemptEndReasonValidator } from "@repo/backend/convex/lib/attempts";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import {
  getEffectiveCompletedTryoutPartIndices,
  getFirstCompletedSimulationAttempt,
  getFirstIncompleteTryoutPartIndex,
} from "@repo/backend/convex/tryouts/helpers";
import {
  computeTryoutExpiresAtMs,
  tryoutProductValidator,
} from "@repo/backend/convex/tryouts/products";
import { tryoutPartKeyValidator } from "@repo/backend/convex/tryouts/schema";
import { ConvexError, v } from "convex/values";
import { getAll, getManyFrom } from "convex-helpers/server/relationships";
import { nullable } from "convex-helpers/validators";

const tryoutPartAttemptSummaryValidator = v.object({
  partIndex: v.number(),
  partKey: tryoutPartKeyValidator,
  setAttempt: vv.doc("exerciseAttempts"),
  setId: vv.id("exerciseSets"),
  endReason: nullable(attemptEndReasonValidator),
  isFinalized: v.boolean(),
});

const tryoutPartAttemptRuntimeValidator = v.object({
  partIndex: v.number(),
  partKey: tryoutPartKeyValidator,
  setAttempt: vv.doc("exerciseAttempts"),
  answers: v.array(vv.doc("exerciseAnswers")),
  endReason: nullable(attemptEndReasonValidator),
  isFinalized: v.boolean(),
});

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
      partAttempts: v.array(tryoutPartAttemptSummaryValidator),
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
        endReason: setAttempt.endReason,
        isFinalized: false,
        setAttempt,
        setId: partAttempt.setId,
      };
    });
    const completedPartIndices = getEffectiveCompletedTryoutPartIndices({
      completedPartIndices: attempt.completedPartIndices,
      partAttempts: validPartAttempts,
    });
    const summarizedPartAttempts = validPartAttempts.map((partAttempt) => ({
      ...partAttempt,
      isFinalized: completedPartIndices.includes(partAttempt.partIndex),
    }));
    const nextPartIndex = getFirstIncompleteTryoutPartIndex({
      completedPartIndices,
      partCount: tryout.partCount,
    });
    let nextPartKey: (typeof validPartAttempts)[number]["partKey"] | undefined;

    if (nextPartIndex !== undefined) {
      const nextPartSet = await ctx.db
        .query("tryoutPartSets")
        .withIndex("tryoutId_partIndex", (q) =>
          q.eq("tryoutId", tryout._id).eq("partIndex", nextPartIndex)
        )
        .unique();

      if (!nextPartSet) {
        throw new ConvexError({
          code: "INVALID_TRYOUT_STATE",
          message: "Tryout is missing its next part.",
        });
      }

      nextPartKey = nextPartSet.partKey;
    }

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
      partAttempts: summarizedPartAttempts,
      completedPartIndices,
      nextPartKey,
      expiresAtMs,
      practiceUnlocked: firstCompletedAttempt !== null,
      isOfficialAttempt: firstCompletedAttempt?._id === attempt._id,
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
      partAttempt: nullable(tryoutPartAttemptRuntimeValidator),
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

    const partAttempts = await getManyFrom(
      ctx.db,
      "tryoutPartAttempts",
      "tryoutAttemptId_partIndex",
      tryoutAttempt._id,
      "tryoutAttemptId"
    );
    const setAttempts = await getAll(
      ctx.db,
      "exerciseAttempts",
      partAttempts.map((partAttempt) => partAttempt.setAttemptId)
    );
    const validPartAttempts = partAttempts.map((partAttempt, index) => {
      const setAttempt = setAttempts[index];

      if (!setAttempt) {
        throw new ConvexError({
          code: "INVALID_ATTEMPT_STATE",
          message: "Tryout part is missing its exercise attempt.",
        });
      }

      return {
        partIndex: partAttempt.partIndex,
        partKey: partAttempt.partKey,
        endReason: setAttempt.endReason,
        isFinalized: false,
        setAttempt,
        setAttemptId: partAttempt.setAttemptId,
      };
    });
    const completedPartIndices = getEffectiveCompletedTryoutPartIndices({
      completedPartIndices: tryoutAttempt.completedPartIndices,
      partAttempts: validPartAttempts,
    });
    const currentPartAttempt = validPartAttempts.find(
      (partAttempt) => partAttempt.partKey === args.partKey
    );
    const nextPartIndex = getFirstIncompleteTryoutPartIndex({
      completedPartIndices,
      partCount: tryout.partCount,
    });
    let nextPartKey: typeof args.partKey | undefined;

    if (nextPartIndex !== undefined) {
      const nextPartSet = await ctx.db
        .query("tryoutPartSets")
        .withIndex("tryoutId_partIndex", (q) =>
          q.eq("tryoutId", tryout._id).eq("partIndex", nextPartIndex)
        )
        .unique();

      if (!nextPartSet) {
        throw new ConvexError({
          code: "INVALID_TRYOUT_STATE",
          message: "Tryout is missing its next part.",
        });
      }

      nextPartKey = nextPartSet.partKey;
    }

    if (!currentPartAttempt) {
      return {
        tryoutAttempt,
        expiresAtMs: computeTryoutExpiresAtMs({
          product: tryout.product,
          startedAtMs: tryoutAttempt.startedAt,
        }),
        nextPartKey,
        completedPartIndices,
        partAttempt: null,
      };
    }

    const answers = await getManyFrom(
      ctx.db,
      "exerciseAnswers",
      "attemptId_exerciseNumber",
      currentPartAttempt.setAttemptId,
      "attemptId"
    );

    return {
      tryoutAttempt,
      expiresAtMs: computeTryoutExpiresAtMs({
        product: tryout.product,
        startedAtMs: tryoutAttempt.startedAt,
      }),
      nextPartKey,
      completedPartIndices,
      partAttempt: {
        partIndex: currentPartAttempt.partIndex,
        partKey: currentPartAttempt.partKey,
        answers,
        endReason: currentPartAttempt.endReason,
        isFinalized: completedPartIndices.includes(
          currentPartAttempt.partIndex
        ),
        setAttempt: currentPartAttempt.setAttempt,
      },
    };
  },
});
