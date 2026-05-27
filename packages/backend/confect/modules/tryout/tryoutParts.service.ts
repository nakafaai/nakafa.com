import type { Doc, Id } from "@repo/backend/confect/_generated/dataModel";
import type {
  MutationCtx as ConvexMutationCtx,
  QueryCtx as ConvexQueryCtx,
} from "@repo/backend/confect/_generated/services";
import { IrtError } from "@repo/backend/confect/modules/tryout/irt.errors";
import { getAll } from "convex-helpers/server/relationships";
import { Effect } from "effect";

interface TryoutPartSnapshot {
  readonly partIndex: number;
  readonly partKey: string;
  readonly questionCount: number;
  readonly setId: Id<"exerciseSets">;
}

interface PartRouteMappingInput {
  readonly currentPartSets: readonly Doc<"tryoutPartSets">[];
  readonly partSetSnapshots: readonly TryoutPartSnapshot[];
}

/** Matches one current part set to a stable snapshot route key. */
function matchTryoutPartRouteKey(args: {
  readonly currentPartKeyBySnapshotIndex: Map<number, string>;
  readonly currentPartSet: Doc<"tryoutPartSets">;
  readonly snapshot: TryoutPartSnapshot;
  readonly snapshotByCurrentRouteKey: Map<string, TryoutPartSnapshot>;
}) {
  args.currentPartKeyBySnapshotIndex.set(
    args.snapshot.partIndex,
    args.currentPartSet.partKey
  );
  args.snapshotByCurrentRouteKey.set(
    args.currentPartSet.partKey,
    args.snapshot
  );
}

/** Builds route-key mappings that keep in-flight tryout URLs stable. */
export function buildTryoutPartRouteMappings(args: PartRouteMappingInput) {
  const currentPartKeyBySnapshotIndex = new Map<number, string>();
  const snapshotByCurrentRouteKey = new Map<string, TryoutPartSnapshot>();
  const matchedSnapshotIndices = new Set<number>();
  const unmatchedCurrentPartSets = args.currentPartSets.filter(
    (currentPartSet) => {
      const snapshot =
        args.partSetSnapshots.find(
          (partSnapshot) =>
            !matchedSnapshotIndices.has(partSnapshot.partIndex) &&
            partSnapshot.partKey === currentPartSet.partKey
        ) ?? null;

      if (!snapshot) {
        return true;
      }

      matchedSnapshotIndices.add(snapshot.partIndex);
      matchTryoutPartRouteKey({
        currentPartKeyBySnapshotIndex,
        currentPartSet,
        snapshot,
        snapshotByCurrentRouteKey,
      });
      return false;
    }
  );

  const unmatchedSnapshots = args.partSetSnapshots.filter(
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

/** Loads the ordered tryout part mappings and validates their shape. */
export const loadValidatedTryoutPartSets = Effect.fn(
  "tryouts.parts.loadValidatedTryoutPartSets"
)(function* (
  db: ConvexQueryCtx["db"],
  args: { readonly partCount: number; readonly tryoutId: Id<"tryouts"> }
) {
  const tryoutPartSets = yield* Effect.promise(() =>
    db
      .query("tryoutPartSets")
      .withIndex("by_tryoutId_and_partIndex", (query) =>
        query.eq("tryoutId", args.tryoutId)
      )
      .take(args.partCount + 1)
  );

  if (tryoutPartSets.length !== args.partCount) {
    return yield* Effect.fail(
      new IrtError({
        code: "INVALID_TRYOUT_STATE",
        message: "Tryout is missing one or more parts.",
      })
    );
  }

  for (const [partIndex, tryoutPartSet] of tryoutPartSets.entries()) {
    if (tryoutPartSet.partIndex === partIndex) {
      continue;
    }

    return yield* Effect.fail(
      new IrtError({
        code: "INVALID_TRYOUT_STATE",
        message: "Tryout parts are out of order.",
      })
    );
  }

  return tryoutPartSets;
});

/** Resolves a requested part route key against current and snapshotted mappings. */
export function resolveRequestedTryoutPart(
  args: PartRouteMappingInput & {
    readonly requestedPartKey: string;
  }
) {
  const { currentPartKeyBySnapshotIndex, snapshotByCurrentRouteKey } =
    buildTryoutPartRouteMappings(args);
  const currentPartSet =
    args.currentPartSets.find(
      (partSet) => partSet.partKey === args.requestedPartKey
    ) ?? null;
  const snapshot = snapshotByCurrentRouteKey.get(args.requestedPartKey) ?? null;

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
    args.partSetSnapshots.find(
      (partSnapshot) =>
        !currentPartKeyBySnapshotIndex.has(partSnapshot.partIndex) &&
        partSnapshot.partKey === args.requestedPartKey
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

/** Loads stable tryout part snapshots from current part-set mappings. */
export const loadTryoutPartSnapshots = Effect.fn(
  "tryouts.parts.loadTryoutPartSnapshots"
)(function* (
  db: ConvexQueryCtx["db"],
  args: { readonly partCount: number; readonly tryoutId: Id<"tryouts"> }
) {
  const tryoutPartSets = yield* loadValidatedTryoutPartSets(db, args);
  const sets = yield* Effect.promise(() =>
    getAll(
      db,
      "exerciseSets",
      tryoutPartSets.map((partSet) => partSet.setId)
    )
  );

  return yield* Effect.all(
    tryoutPartSets.map((tryoutPartSet, index) => {
      const set = sets[index];

      if (!set) {
        return Effect.fail(
          new IrtError({
            code: "INVALID_TRYOUT_STATE",
            message: "Tryout is missing one of its exercise sets.",
          })
        );
      }

      return Effect.succeed({
        partIndex: tryoutPartSet.partIndex,
        partKey: tryoutPartSet.partKey,
        questionCount: set.questionCount,
        setId: tryoutPartSet.setId,
      });
    })
  );
});

/** Synchronizes tryout-to-set mappings after content sync detects a tryout. */
export const syncTryoutPartSetMappings = Effect.fn(
  "tryouts.parts.syncTryoutPartSetMappings"
)(function* (
  ctx: ConvexMutationCtx,
  args: {
    readonly parts: readonly {
      readonly partKey: string;
      readonly setId: Id<"exerciseSets">;
    }[];
    readonly tryoutId: Id<"tryouts">;
  }
) {
  const tryout = yield* Effect.promise(() => ctx.db.get(args.tryoutId));
  const expectedPartCount = Math.max(args.parts.length, tryout?.partCount ?? 0);
  const existingMappings = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutPartSets")
      .withIndex("by_tryoutId_and_partIndex", (query) =>
        query.eq("tryoutId", args.tryoutId)
      )
      .take(expectedPartCount + 1)
  );

  if (existingMappings.length > expectedPartCount) {
    return yield* Effect.fail(
      new IrtError({
        code: "TRYOUT_PART_SET_COUNT_EXCEEDED",
        message: "Tryout part set mapping count exceeds detected tryout parts.",
      })
    );
  }

  const mappingsByPartIndex = new Map<number, Doc<"tryoutPartSets">>();

  for (const mapping of existingMappings) {
    if (!args.parts[mapping.partIndex]) {
      continue;
    }

    if (mappingsByPartIndex.has(mapping.partIndex)) {
      return yield* Effect.fail(
        new IrtError({
          code: "TRYOUT_PART_SET_DUPLICATE_INDEX",
          message: "Tryout part set mappings contain duplicate part indexes.",
        })
      );
    }

    mappingsByPartIndex.set(mapping.partIndex, mapping);
  }

  const hasChanges =
    existingMappings.length !== args.parts.length ||
    existingMappings.some(
      (mapping) =>
        args.parts[mapping.partIndex]?.setId !== mapping.setId ||
        args.parts[mapping.partIndex]?.partKey !== mapping.partKey
    );

  if (!hasChanges) {
    return false;
  }

  for (const [partIndex, part] of args.parts.entries()) {
    const existingMapping = mappingsByPartIndex.get(partIndex);

    if (!existingMapping) {
      yield* Effect.promise(() =>
        ctx.db.insert("tryoutPartSets", {
          partIndex,
          partKey: part.partKey,
          setId: part.setId,
          tryoutId: args.tryoutId,
        })
      );
      continue;
    }

    if (
      existingMapping.partKey === part.partKey &&
      existingMapping.setId === part.setId
    ) {
      continue;
    }

    yield* Effect.promise(() =>
      ctx.db.patch(existingMapping._id, {
        partKey: part.partKey,
        setId: part.setId,
      })
    );
  }

  const validPartIndexes = new Set(args.parts.map((_, partIndex) => partIndex));

  for (const existingMapping of existingMappings) {
    if (validPartIndexes.has(existingMapping.partIndex)) {
      continue;
    }

    yield* Effect.promise(() => ctx.db.delete(existingMapping._id));
  }

  return true;
});
