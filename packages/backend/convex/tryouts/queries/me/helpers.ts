import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { getFirstIncompleteTryoutPartIndex } from "@repo/backend/convex/tryouts/helpers/scoring";
import { pickSuggestedPartKey } from "@repo/backend/convex/tryouts/helpers/shared";
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
  const partAttempts = await ctx.db
    .query("tryoutPartAttempts")
    .withIndex("by_tryoutAttemptId_and_partIndex", (q) =>
      q.eq("tryoutAttemptId", tryoutAttemptId)
    )
    .take(partCount + 1);

  if (partAttempts.length > partCount) {
    throw new ConvexError({
      code: "INVALID_ATTEMPT_STATE",
      message: "Tryout attempt has more part attempts than expected.",
    });
  }

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

/** Derive the next resume target for an active tryout attempt. */
export function resolveResumePartKey({
  completedPartIndices,
  orderedParts,
  partAttempts,
}: {
  completedPartIndices: number[];
  orderedParts: OrderedTryoutPart[];
  partAttempts: TryoutPartAttemptSummary[];
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
