import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import contentCompactionTable from "@repo/backend/confect/_generated/tables/contentCompaction";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import {
  compactionPhaseValidator,
  ROLLBACK_RETENTION_MS,
} from "@repo/backend/confect/contentRelease/spec";
import { Array as Arr, Clock, Effect, Option, Schema } from "effect";

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

/** Creates the compaction row the first time compaction runs on a deployment. */
export const ensureCompactionRow = Effect.fn(
  "contentRelease.ensureCompactionRow"
)(function* () {
  const existing = yield* loadCompaction();
  if (existing) {
    return existing;
  }
  const database = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const id = yield* writer
    .table("contentCompaction")
    .insert({ compactedFloor: 0, key: "primary" })
    .pipe(Effect.orDie);
  return yield* database.table("contentCompaction").get(id).pipe(Effect.orDie);
});

/**
 * Proves from the compaction row and one release row that nothing is due: the
 * release at the completed floor is still inside the retention window, so the
 * oldest retained release does not move and compaction needs neither the
 * protected slots nor a scan of old releases. A history floor above the
 * completed floor leaves retired releases due, so the tick is not idle.
 */
export const isCompactionIdle = Effect.fn("contentRelease.isCompactionIdle")(
  function* (compaction: Docs["contentCompaction"], historyFloor: number) {
    const { compactedFloor } = compaction;
    if (
      hasCycleFields(compaction) ||
      !isSequence(compactedFloor) ||
      historyFloor > compactedFloor
    ) {
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
