import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  type CompactionCycle,
  ensureCompactionRow,
  isCompactionIdle,
  isSequence,
  readCycle,
} from "@repo/backend/confect/contentRelease/compact/cycle";
import { protectedFloor } from "@repo/backend/confect/contentRelease/compact/protected";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import {
  ensureState,
  loadHistoryFloor,
} from "@repo/backend/confect/contentRelease/model";
import {
  COMPACTION_PAGE_BYTES,
  ROLLBACK_RETENTION_MS,
} from "@repo/backend/confect/contentRelease/spec";
import { Array as Arr, Clock, Effect, Option } from "effect";

const RELEASE_SCAN_COUNT = 32;

/** Advances through only a bounded old release window before a protected floor. */
const retainedFloor = Effect.fn("contentRelease.retainedFloor")(function* (
  from: number,
  ceiling: number
) {
  const database = yield* DatabaseReader;
  const page = yield* database
    .table("contentReleases")
    .index("by_sequence", (query) =>
      query.gte("sequence", from).lt("sequence", ceiling)
    )
    .paginate({
      cursor: null,
      maximumBytesRead: COMPACTION_PAGE_BYTES,
      maximumRowsRead: RELEASE_SCAN_COUNT + 1,
      numItems: RELEASE_SCAN_COUNT + 1,
    })
    .pipe(Effect.orDie);
  const releases = page.page;
  for (let index = 1; index < releases.length; index += 1) {
    if (releases[index]?.sequence === releases[index - 1]?.sequence) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Content releases share compaction sequence ${releases[index]?.sequence}.`
      );
    }
  }
  const cutoff = (yield* Clock.currentTimeMillis) - ROLLBACK_RETENTION_MS;
  const retained = Option.getOrUndefined(
    Arr.findFirst(releases, (release) => release.createdAt >= cutoff)
  );
  if (retained) {
    return retained.sequence;
  }
  if (page.isDone) {
    return ceiling;
  }
  const boundary = Arr.last(releases);
  return Option.match(boundary, {
    onNone: () => from,
    onSome: (release) => Math.min(release.sequence, ceiling),
  });
});

/** Resumes an active cycle or starts one conservative bounded history range. */
export const ensureCompaction = Effect.fn("contentRelease.ensureCompaction")(
  function* () {
    const writer = yield* DatabaseWriter;
    const compaction = yield* ensureCompactionRow();
    const { compactedFloor } = compaction;
    const historyFloor = yield* loadHistoryFloor();
    if (yield* isCompactionIdle(compaction, historyFloor)) {
      return {
        complete: true,
        floor: compactedFloor,
      } as const;
    }
    const state = yield* ensureState();
    if (
      !(
        isSequence(state.nextSequence) && Number.isSafeInteger(compactedFloor)
      ) ||
      compactedFloor < 0 ||
      compactedFloor > state.nextSequence
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Content compaction has an invalid completed floor."
      );
    }
    const existing = yield* readCycle(compaction, state.nextSequence);
    if (existing) {
      return {
        complete: false,
        cycle: existing,
      } as const;
    }
    const ceiling = yield* protectedFloor(state, historyFloor);
    // The retention window never keeps a release below the history floor.
    const floor = yield* retainedFloor(
      Math.max(compactedFloor, historyFloor),
      ceiling
    );
    if (floor <= compactedFloor) {
      return {
        complete: true,
        floor: compactedFloor,
      } as const;
    }
    const now = yield* Clock.currentTimeMillis;
    yield* writer
      .table("contentCompaction")
      .patch(compaction._id, {
        compactCursor: undefined,
        compactFloor: floor,
        compactFrom: compactedFloor,
        compactPhase: "heads",
        compactStartedAt: now,
      })
      .pipe(Effect.orDie);
    return {
      complete: false,
      cycle: {
        compaction: {
          ...compaction,
          compactFloor: floor,
        },
        cursor: null,
        floor,
        from: compactedFloor,
        phase: "heads",
        startedAt: now,
      } satisfies CompactionCycle,
    } as const;
  }
);
