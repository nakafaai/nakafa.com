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

function matchTryoutPartRouteKey({
  currentPartKeyBySnapshotIndex,
  currentPartSet,
  snapshot,
  snapshotByCurrentRouteKey,
}: {
  currentPartKeyBySnapshotIndex: Map<number, string>;
  currentPartSet: CurrentTryoutPartSet;
  snapshot: TryoutPartSnapshot;
  snapshotByCurrentRouteKey: Map<string, TryoutPartSnapshot>;
}) {
  currentPartKeyBySnapshotIndex.set(snapshot.partIndex, currentPartSet.partKey);
  snapshotByCurrentRouteKey.set(currentPartSet.partKey, snapshot);
}

/**
 * Build a one-to-one translation between current route keys and historical part
 * snapshots.
 */
export function buildTryoutPartRouteMappings({
  currentPartSets,
  partSetSnapshots,
}: {
  currentPartSets: CurrentTryoutPartSet[];
  partSetSnapshots: TryoutPartSnapshot[];
}) {
  const currentPartKeyBySnapshotIndex = new Map<number, string>();
  const snapshotByCurrentRouteKey = new Map<string, TryoutPartSnapshot>();
  const matchedSnapshotIndices = new Set<number>();
  const unmatchedCurrentPartSets: CurrentTryoutPartSet[] = [];

  for (const currentPartSet of currentPartSets) {
    const snapshot =
      partSetSnapshots.find(
        (partSnapshot) =>
          !matchedSnapshotIndices.has(partSnapshot.partIndex) &&
          partSnapshot.partKey === currentPartSet.partKey
      ) ?? null;

    if (!snapshot) {
      unmatchedCurrentPartSets.push(currentPartSet);
      continue;
    }

    matchedSnapshotIndices.add(snapshot.partIndex);
    matchTryoutPartRouteKey({
      currentPartKeyBySnapshotIndex,
      currentPartSet,
      snapshot,
      snapshotByCurrentRouteKey,
    });
  }

  const unmatchedSnapshots = partSetSnapshots.filter(
    (partSnapshot) => !matchedSnapshotIndices.has(partSnapshot.partIndex)
  );

  for (const [index, currentPartSet] of unmatchedCurrentPartSets.entries()) {
    const snapshot = unmatchedSnapshots[index];

    if (!snapshot) {
      break;
    }

    matchedSnapshotIndices.add(snapshot.partIndex);
    matchTryoutPartRouteKey({
      currentPartKeyBySnapshotIndex,
      currentPartSet,
      snapshot,
      snapshotByCurrentRouteKey,
    });
  }

  return {
    currentPartKeyBySnapshotIndex,
    snapshotByCurrentRouteKey,
  };
}

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
  const { currentPartKeyBySnapshotIndex, snapshotByCurrentRouteKey } =
    buildTryoutPartRouteMappings({
      currentPartSets,
      partSetSnapshots,
    });
  const currentPartSet =
    currentPartSets.find((partSet) => partSet.partKey === requestedPartKey) ??
    null;
  const snapshot = snapshotByCurrentRouteKey.get(requestedPartKey) ?? null;

  if (snapshot) {
    return {
      currentPartKey:
        currentPartKeyBySnapshotIndex.get(snapshot.partIndex) ??
        snapshot.partKey,
      currentPartSet,
      snapshot,
    };
  }

  const unmatchedSnapshot =
    partSetSnapshots.find(
      (partSnapshot) =>
        !currentPartKeyBySnapshotIndex.has(partSnapshot.partIndex) &&
        partSnapshot.partKey === requestedPartKey
    ) ?? null;

  if (!unmatchedSnapshot) {
    return null;
  }

  return {
    currentPartKey: unmatchedSnapshot.partKey,
    currentPartSet: null,
    snapshot: unmatchedSnapshot,
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
