import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { getFirstIncompleteTryoutPartIndex } from "@repo/backend/convex/tryouts/helpers/scoring";
import {
  getBoundedExerciseAnswers,
  loadBoundedTryoutPartAttempts,
  pickSuggestedPartKey,
} from "@repo/backend/convex/tryouts/helpers/shared";
import type {
  orderedTryoutPartValidator,
  tryoutPartAttemptSummaryValidator,
  UserTryoutLookup,
} from "@repo/backend/convex/tryouts/queries/me/validators";
import { ConvexError, type Infer } from "convex/values";
import { getAll } from "convex-helpers/server/relationships";

type OrderedTryoutPart = Infer<typeof orderedTryoutPartValidator>;
type TryoutPartAttemptSummary = Infer<typeof tryoutPartAttemptSummaryValidator>;

/** Load one tryout together with the current user's latest attempt for that slug. */
export async function loadLatestUserTryoutContext(
  ctx: QueryCtx,
  {
    locale,
    product,
    tryoutSlug,
    userId,
  }: UserTryoutLookup & {
    userId: Id<"users">;
  }
) {
  const tryout = await ctx.db
    .query("tryouts")
    .withIndex("by_product_and_locale_and_slug", (q) =>
      q.eq("product", product).eq("locale", locale).eq("slug", tryoutSlug)
    )
    .unique();

  if (!tryout) {
    return null;
  }

  const attempt = await ctx.db
    .query("tryoutAttempts")
    .withIndex("by_userId_and_tryoutId_and_startedAt", (q) =>
      q.eq("userId", userId).eq("tryoutId", tryout._id)
    )
    .order("desc")
    .first();

  if (!attempt) {
    return null;
  }

  return { attempt, tryout };
}

/** Load ordered part definitions for one tryout and validate the sequence. */
export async function loadOrderedTryoutParts(
  ctx: QueryCtx,
  {
    partCount,
    tryoutId,
  }: {
    partCount: number;
    tryoutId: Id<"tryouts">;
  }
) {
  const tryoutPartSets = await ctx.db
    .query("tryoutPartSets")
    .withIndex("by_tryoutId_and_partIndex", (q) => q.eq("tryoutId", tryoutId))
    .take(partCount + 1);

  if (tryoutPartSets.length !== partCount) {
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

  return tryoutPartSets.map((tryoutPartSet) => ({
    partIndex: tryoutPartSet.partIndex,
    partKey: tryoutPartSet.partKey,
  })) satisfies OrderedTryoutPart[];
}

/** Load summarized part attempts for a tryout attempt. */
export async function loadTryoutPartAttemptSummaries(
  ctx: QueryCtx,
  {
    partCount,
    tryoutAttemptId,
  }: {
    partCount: number;
    tryoutAttemptId: Id<"tryoutAttempts">;
  }
) {
  const partAttempts = await loadBoundedTryoutPartAttempts(ctx.db, {
    partCount,
    tryoutAttemptId,
  });
  const setAttempts = await getAll(
    ctx.db,
    "exerciseAttempts",
    partAttempts.map((partAttempt) => partAttempt.setAttemptId)
  );

  return partAttempts.map((partAttempt, index) => {
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
    } satisfies TryoutPartAttemptSummary;
  });
}

/** Load one part runtime together with its bounded stored answers. */
export async function loadTryoutPartRuntime(
  ctx: QueryCtx,
  {
    partKey,
    tryoutAttemptId,
  }: {
    partKey: string;
    tryoutAttemptId: Id<"tryoutAttempts">;
  }
) {
  const currentPartAttempt = await ctx.db
    .query("tryoutPartAttempts")
    .withIndex("by_tryoutAttemptId_and_partKey", (q) =>
      q.eq("tryoutAttemptId", tryoutAttemptId).eq("partKey", partKey)
    )
    .unique();

  if (!currentPartAttempt) {
    return null;
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

  const answers = await getBoundedExerciseAnswers(ctx.db, {
    attemptId: currentPartAttempt.setAttemptId,
    totalExercises: setAttempt.totalExercises,
  });

  return {
    answers,
    partIndex: currentPartAttempt.partIndex,
    partKey: currentPartAttempt.partKey,
    setAttempt,
  };
}

/** Derive the next resume target for an active tryout attempt. */
export function resolveResumePartKey({
  completedPartIndices,
  orderedParts,
  partAttempts,
}: {
  completedPartIndices: number[];
  orderedParts: OrderedTryoutPart[];
  partAttempts: Array<{
    partKey: string;
    setAttempt: {
      lastActivityAt: number;
      status: Doc<"exerciseAttempts">["status"];
    };
  }>;
}) {
  const suggestedPartKey = pickSuggestedPartKey(partAttempts);
  const nextPartIndex = getFirstIncompleteTryoutPartIndex({
    completedPartIndices,
    partCount: orderedParts.length,
  });
  const nextPart =
    nextPartIndex === undefined ? undefined : orderedParts[nextPartIndex];

  return suggestedPartKey ?? nextPart?.partKey;
}
