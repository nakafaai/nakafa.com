import { query } from "@repo/backend/convex/_generated/server";
import { exerciseAttemptStatusValidator } from "@repo/backend/convex/exercises/schema";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { getFirstIncompleteTryoutPartIndex } from "@repo/backend/convex/tryouts/helpers";
import { tryoutProductValidator } from "@repo/backend/convex/tryouts/products";
import { tryoutPartKeyValidator } from "@repo/backend/convex/tryouts/schema";
import { ConvexError, type Infer, v } from "convex/values";
import { getAll, getManyFrom } from "convex-helpers/server/relationships";
import { nullable } from "convex-helpers/validators";

const MAX_IN_PROGRESS_TRYOUTS_PER_USER = 100;
const inProgressTryoutValidator = v.object({
  expiresAtMs: v.number(),
  slug: v.string(),
});

const orderedTryoutPartValidator = v.object({
  partIndex: v.number(),
  partKey: tryoutPartKeyValidator,
});

const tryoutPartAttemptSummarySetAttemptValidator = v.object({
  lastActivityAt: v.number(),
  startedAt: v.number(),
  status: exerciseAttemptStatusValidator,
  timeLimit: v.number(),
});

const tryoutPartAttemptSummaryValidator = v.object({
  partIndex: v.number(),
  partKey: tryoutPartKeyValidator,
  setAttempt: tryoutPartAttemptSummarySetAttemptValidator,
});

const tryoutPartAttemptRuntimeValidator = v.object({
  partIndex: v.number(),
  partKey: tryoutPartKeyValidator,
  setAttempt: vv.doc("exerciseAttempts"),
  answers: v.array(vv.doc("exerciseAnswers")),
});

type TryoutPartAttemptSummary = Infer<typeof tryoutPartAttemptSummaryValidator>;

function pickSuggestedPartKey(partAttempts: TryoutPartAttemptSummary[]) {
  const inProgressParts = partAttempts.filter(
    (partAttempt) => partAttempt.setAttempt.status === "in-progress"
  );

  if (inProgressParts.length === 0) {
    return undefined;
  }

  inProgressParts.sort(
    (left, right) =>
      right.setAttempt.lastActivityAt - left.setAttempt.lastActivityAt
  );

  return inProgressParts[0]?.partKey;
}

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
      orderedParts: v.array(orderedTryoutPartValidator),
      partAttempts: v.array(tryoutPartAttemptSummaryValidator),
      resumePartKey: v.optional(tryoutPartKeyValidator),
      expiresAtMs: v.number(),
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

    const tryoutPartSets = await ctx.db
      .query("tryoutPartSets")
      .withIndex("tryoutId_partIndex", (q) => q.eq("tryoutId", tryout._id))
      .take(tryout.partCount + 1);

    if (tryoutPartSets.length !== tryout.partCount) {
      throw new ConvexError({
        code: "INVALID_TRYOUT_STATE",
        message: "Tryout is missing one or more parts.",
      });
    }

    for (const [partIndex, tryoutPartSet] of tryoutPartSets.entries()) {
      if (tryoutPartSet.partIndex === partIndex) {
        continue;
      }

      throw new ConvexError({
        code: "INVALID_TRYOUT_STATE",
        message: "Tryout parts are out of order.",
      });
    }

    const orderedParts = tryoutPartSets.map((tryoutPartSet) => ({
      partIndex: tryoutPartSet.partIndex,
      partKey: tryoutPartSet.partKey,
    }));

    const partAttempts = await ctx.db
      .query("tryoutPartAttempts")
      .withIndex("tryoutAttemptId_partIndex", (q) =>
        q.eq("tryoutAttemptId", attempt._id)
      )
      .take(tryout.partCount + 1);

    if (partAttempts.length > tryout.partCount) {
      throw new ConvexError({
        code: "INVALID_ATTEMPT_STATE",
        message: "Tryout attempt has more part attempts than expected.",
      });
    }
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
        setAttempt: {
          lastActivityAt: setAttempt.lastActivityAt,
          startedAt: setAttempt.startedAt,
          status: setAttempt.status,
          timeLimit: setAttempt.timeLimit,
        },
      };
    });
    const suggestedPartKey = pickSuggestedPartKey(validPartAttempts);

    if (attempt.status !== "in-progress") {
      return {
        attempt,
        orderedParts,
        partAttempts: validPartAttempts,
        expiresAtMs: attempt.expiresAt,
      };
    }

    const nextPartIndex = getFirstIncompleteTryoutPartIndex({
      completedPartIndices: attempt.completedPartIndices,
      partCount: tryout.partCount,
    });
    let resumePartKey:
      | (typeof validPartAttempts)[number]["partKey"]
      | undefined;

    if (suggestedPartKey) {
      resumePartKey = suggestedPartKey;
    } else if (nextPartIndex !== undefined) {
      const nextPartSet = orderedParts.find(
        (part) => part.partIndex === nextPartIndex
      );

      if (!nextPartSet) {
        throw new ConvexError({
          code: "INVALID_TRYOUT_STATE",
          message: "Tryout is missing its next part.",
        });
      }

      resumePartKey = nextPartSet.partKey;
    }

    return {
      attempt,
      orderedParts,
      partAttempts: validPartAttempts,
      resumePartKey,
      expiresAtMs: attempt.expiresAt,
    };
  },
});

/**
 * Returns active tryout slugs whose latest attempt is still in progress.
 */
export const getUserInProgressTryouts = query({
  args: {
    product: tryoutProductValidator,
    locale: localeValidator,
  },
  returns: v.array(inProgressTryoutValidator),
  handler: async (ctx, args) => {
    const { appUser } = await requireAuth(ctx);
    const inProgressAttempts = await ctx.db
      .query("tryoutAttempts")
      .withIndex("userId_status_expiresAt", (q) =>
        q.eq("userId", appUser._id).eq("status", "in-progress")
      )
      .take(MAX_IN_PROGRESS_TRYOUTS_PER_USER + 1);

    if (inProgressAttempts.length > MAX_IN_PROGRESS_TRYOUTS_PER_USER) {
      throw new ConvexError({
        code: "TOO_MANY_IN_PROGRESS_TRYOUTS",
        message: "In-progress tryout list exceeded the supported query limit.",
      });
    }

    if (inProgressAttempts.length === 0) {
      return [];
    }

    const tryouts = await getAll(
      ctx.db,
      "tryouts",
      inProgressAttempts.map((tryoutAttempt) => tryoutAttempt.tryoutId)
    );
    const activeTryoutsBySlug = new Map<
      string,
      Infer<typeof inProgressTryoutValidator>
    >();

    for (const [index, tryout] of tryouts.entries()) {
      if (!tryout) {
        continue;
      }

      const tryoutAttempt = inProgressAttempts[index];

      if (!tryoutAttempt) {
        continue;
      }

      if (!tryout.isActive) {
        continue;
      }

      if (tryout.product !== args.product || tryout.locale !== args.locale) {
        continue;
      }

      activeTryoutsBySlug.set(tryout.slug, {
        expiresAtMs: tryoutAttempt.expiresAt,
        slug: tryout.slug,
      });
    }

    return Array.from(activeTryoutsBySlug.values());
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
      expiresAtMs: v.number(),
      partAttempt: nullable(tryoutPartAttemptRuntimeValidator),
      tryoutAttempt: vv.doc("tryoutAttempts"),
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

    const currentPartAttempt = await ctx.db
      .query("tryoutPartAttempts")
      .withIndex("tryoutAttemptId_partKey", (q) =>
        q.eq("tryoutAttemptId", tryoutAttempt._id).eq("partKey", args.partKey)
      )
      .unique();

    if (!currentPartAttempt) {
      return {
        expiresAtMs: tryoutAttempt.expiresAt,
        partAttempt: null,
        tryoutAttempt,
      };
    }

    const setAttempt = await ctx.db.get(
      "exerciseAttempts",
      currentPartAttempt.setAttemptId
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
      currentPartAttempt.setAttemptId,
      "attemptId"
    );

    return {
      expiresAtMs: tryoutAttempt.expiresAt,
      partAttempt: {
        partIndex: currentPartAttempt.partIndex,
        partKey: currentPartAttempt.partKey,
        answers,
        setAttempt,
      },
      tryoutAttempt,
    };
  },
});
