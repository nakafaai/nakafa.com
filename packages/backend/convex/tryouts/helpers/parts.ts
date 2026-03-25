import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { ConvexError } from "convex/values";

type TryoutDbReader = QueryCtx["db"] | MutationCtx["db"];

/**
 * Load validated part-set rows for one tryout, enforcing count and ordered
 * `partIndex` invariants in one place.
 */
export async function loadValidatedTryoutPartSets(
  db: TryoutDbReader,
  {
    partCount,
    tryoutId,
  }: {
    partCount: Doc<"tryouts">["partCount"];
    tryoutId: Doc<"tryouts">["_id"];
  }
) {
  const tryoutPartSets = await db
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

  return tryoutPartSets;
}
