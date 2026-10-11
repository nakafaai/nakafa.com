import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import contentCompactionTable from "@repo/backend/confect/_generated/tables/contentCompaction";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { ensureState } from "@repo/backend/confect/contentRelease/model";
import {
  compactionPhaseValidator,
  ROLLBACK_RETENTION_MS,
} from "@repo/backend/confect/contentRelease/spec";
import { Array as Arr, Clock, Effect, Option, Schema, Struct } from "effect";

/** Checks one monotonic release-sequence value before index traversal. */
export function isSequence(value: number) {
  return Number.isSafeInteger(value) && value >= 1;
}

const CompactionCycleSchema = Schema.Struct({
  compaction: contentCompactionTable.Doc,
  cursor: Schema.NullOr(Schema.String),
  floor: Schema.Finite,
  from: Schema.Finite,
  phase: compactionPhaseValidator,
  startedAt: Schema.Finite,
});
/** One durable compaction range whose phase cursor may resume after a crash. */
export type CompactionCycle = typeof CompactionCycleSchema.Type;

/** Whether the compaction row stores any field of a cycle, valid or not. */
function hasCycleFields(compaction: Docs["contentCompaction"]) {
  return (
    compaction.compactCursor !== undefined ||
    compaction.compactFloor !== undefined ||
    compaction.compactFrom !== undefined ||
    compaction.compactPhase !== undefined ||
    compaction.compactStartedAt !== undefined
  );
}

/** Validates and returns a previously persisted compaction cycle. */
export const readCycle = Effect.fn("contentRelease.readCompactionCycle")(
  function* (compaction: Docs["contentCompaction"], nextSequence: number) {
    if (!hasCycleFields(compaction)) {
      return null;
    }
    const { compactedFloor } = compaction;
    const required = [
      compaction.compactFloor,
      compaction.compactFrom,
      compaction.compactPhase,
      compaction.compactStartedAt,
    ];
    const present = Arr.filter(required, (value) => value !== undefined).length;
    if (
      present !== required.length ||
      compaction.compactFloor === undefined ||
      compaction.compactFrom === undefined ||
      compaction.compactPhase === undefined ||
      compaction.compactStartedAt === undefined ||
      !Number.isSafeInteger(compaction.compactFloor) ||
      !Number.isSafeInteger(compaction.compactFrom) ||
      compaction.compactFrom !== compactedFloor ||
      compaction.compactFrom < 0 ||
      compaction.compactFloor <= compaction.compactFrom ||
      compaction.compactFloor > nextSequence ||
      !Number.isFinite(compaction.compactStartedAt) ||
      compaction.compactStartedAt < 0 ||
      (compaction.compactCursor !== undefined &&
        compaction.compactCursor.length === 0)
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Content compaction lost its durable cycle identity."
      );
    }
    return {
      compaction,
      cursor: compaction.compactCursor ?? null,
      floor: compaction.compactFloor,
      from: compaction.compactFrom,
      phase: compaction.compactPhase,
      startedAt: compaction.compactStartedAt,
    } satisfies CompactionCycle;
  }
);

/** Reads the singleton compaction row through its exact index. */
const loadCompaction = Effect.fn("contentRelease.loadCompaction")(function* () {
  const database = yield* DatabaseReader;
  return yield* database
    .table("contentCompaction")
    .get("by_key", "primary")
    .pipe(
      Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
});

/** The compaction fields `contentState` held before the compaction row existed. */
const stateCompactionFields = [
  "compactCursor",
  "compactFloor",
  "compactFrom",
  "compactPhase",
  "compactStartedAt",
  "compactedFloor",
] as const;

/**
 * Creates the compaction row exactly once. A deployment that compacted before
 * this row existed keeps its completed floor and its cycle in flight: they move
 * here, and leave `contentState` in the same transaction.
 */
export const ensureCompactionRow = Effect.fn(
  "contentRelease.ensureCompactionRow"
)(function* () {
  const existing = yield* loadCompaction();
  if (existing) {
    return existing;
  }
  const database = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const state = yield* ensureState();
  const id = yield* writer
    .table("contentCompaction")
    .insert({
      ...Struct.pick(state, stateCompactionFields),
      compactedFloor: state.compactedFloor ?? 0,
      key: "primary",
    })
    .pipe(Effect.orDie);
  if (Arr.some(stateCompactionFields, (field) => state[field] !== undefined)) {
    yield* writer
      .table("contentState")
      .patch(state._id, {
        compactCursor: undefined,
        compactFloor: undefined,
        compactFrom: undefined,
        compactPhase: undefined,
        compactStartedAt: undefined,
        compactedFloor: undefined,
      })
      .pipe(Effect.orDie);
  }
  return yield* database.table("contentCompaction").get(id).pipe(Effect.orDie);
});

/**
 * Proves from one release row that nothing is due: the release at the
 * completed floor is still inside the retention window, so the oldest retained
 * release does not move and compaction needs neither the protected slots nor a
 * scan of old releases.
 */
export const isCompactionIdle = Effect.fn("contentRelease.isCompactionIdle")(
  function* (compaction: Docs["contentCompaction"]) {
    const { compactedFloor } = compaction;
    if (hasCycleFields(compaction) || !isSequence(compactedFloor)) {
      return false;
    }
    const database = yield* DatabaseReader;
    const oldest = yield* database
      .table("contentReleases")
      .index("by_sequence", (query) => query.gte("sequence", compactedFloor))
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie);
    const cutoff = (yield* Clock.currentTimeMillis) - ROLLBACK_RETENTION_MS;
    return oldest?.sequence === compactedFloor && oldest.createdAt >= cutoff;
  }
);
