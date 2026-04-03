import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import type { TryoutPartSnapshot } from "@repo/backend/convex/tryouts/schema";
import { ConvexError } from "convex/values";
import { getAll } from "convex-helpers/server/relationships";

type TryoutDbReader = QueryCtx["db"] | MutationCtx["db"];
type CurrentTryoutPartSet = Pick<
  Doc<"tryoutPartSets">,
  "partIndex" | "partKey"
>;

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
 * Resolve one requested route part key against the current tryout mapping first,
 * then fall back to the historical snapshot key if needed.
 */
export function resolveRequestedTryoutPart({
  currentPartSets,
  partSetSnapshots,
  requestedPartKey,
}: {
  currentPartSets: CurrentTryoutPartSet[];
  partSetSnapshots: TryoutPartSnapshot[];
  requestedPartKey: TryoutPartSnapshot["partKey"];
}) {
  const snapshot =
    partSetSnapshots.find(
      (partSnapshot) => partSnapshot.partKey === requestedPartKey
    ) ?? null;
  const currentPartSet =
    currentPartSets.find((partSet) => partSet.partKey === requestedPartKey) ??
    null;

  if (snapshot) {
    return {
      currentPartKey: currentPartSet?.partKey ?? snapshot.partKey,
      currentPartSet,
      snapshot,
    };
  }

  if (!currentPartSet) {
    return null;
  }

  const snapshotByIndex =
    partSetSnapshots.find(
      (partSnapshot) => partSnapshot.partIndex === currentPartSet.partIndex
    ) ?? null;

  if (!snapshotByIndex) {
    return null;
  }

  return {
    currentPartKey: currentPartSet.partKey,
    currentPartSet,
    snapshot: snapshotByIndex,
  };
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
