import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { pickSuggestedPartKey } from "@repo/backend/convex/tryouts/helpers/resume";
import { getFirstIncompleteTryoutPartIndex } from "@repo/backend/convex/tryouts/helpers/scoring";
import type { UserTryoutLookup } from "@repo/backend/convex/tryouts/queries/me/types";
import type { orderedTryoutPartValidator } from "@repo/backend/convex/tryouts/queries/me/validators";
import type { Infer } from "convex/values";

type OrderedTryoutPart = Infer<typeof orderedTryoutPartValidator>;

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
