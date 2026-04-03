import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import type { TryoutPartSnapshot } from "@repo/backend/convex/tryouts/schema";
import { ConvexError } from "convex/values";
import { getAll } from "convex-helpers/server/relationships";

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

/**
 * Build a stable per-part snapshot from the current tryout mappings.
 *
 * New attempts persist this so later content-sync changes do not rewrite the
 * part-to-set mapping or question counts for that historical attempt.
 */
export async function loadTryoutPartSnapshots(
  db: TryoutDbReader,
  {
    partCount,
    tryoutId,
  }: {
    partCount: Doc<"tryouts">["partCount"];
    tryoutId: Doc<"tryouts">["_id"];
  }
): Promise<TryoutPartSnapshot[]> {
  const tryoutPartSets = await loadValidatedTryoutPartSets(db, {
    partCount,
    tryoutId,
  });
  const sets = await getAll(
    db,
    "exerciseSets",
    tryoutPartSets.map((partSet) => partSet.setId)
  );

  return tryoutPartSets.map((tryoutPartSet, index) => {
    const set = sets[index];

    if (!set) {
      throw new ConvexError({
        code: "INVALID_TRYOUT_STATE",
        message: "Tryout is missing one of its exercise sets.",
      });
    }

    return {
      partIndex: tryoutPartSet.partIndex,
      partKey: tryoutPartSet.partKey,
      questionCount: set.questionCount,
      setId: tryoutPartSet.setId,
    };
  });
}
