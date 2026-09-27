import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  type ReleaseError,
  releaseFail,
} from "@repo/backend/confect/contentRelease/error";
import {
  ensureState,
  loadRelease,
} from "@repo/backend/confect/contentRelease/model";
import {
  COMPACTION_PAGE_BYTES,
  ROLLBACK_RETENTION_MS,
} from "@repo/backend/confect/contentRelease/spec";
import { Clock, Effect, Option } from "effect";

const RELEASE_SCAN_COUNT = 32;
interface SlotIdentity {
  readonly manifestHash: string;
  readonly releaseId: string;
  readonly sequence: number;
}

/** Checks one monotonic release-sequence value before index traversal. */
function isSequence(value: number) {
  return Number.isSafeInteger(value) && value >= 1;
}

/** One durable compaction range whose phase cursor may resume after a crash. */
export interface CompactionCycle {
  readonly cursor: null | string;
  readonly floor: number;
  readonly from: number;
  readonly phase: NonNullable<Docs["contentState"]["compactPhase"]>;
  readonly startedAt: number;
  readonly state: Docs["contentState"];
}

/** Decodes one optional singleton slot without accepting partial identity. */
const slotIdentity = Effect.fn("contentRelease.compactionSlot")(function* (
  label: string,
  manifestHash: string | undefined,
  releaseId: string | undefined,
  sequence: number | undefined
) {
  if (
    manifestHash === undefined &&
    releaseId === undefined &&
    sequence === undefined
  ) {
    return null;
  }
  if (
    manifestHash === undefined ||
    releaseId === undefined ||
    sequence === undefined ||
    !Number.isSafeInteger(sequence) ||
    sequence < 1
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Content ${label} slot has an incomplete compaction identity.`
    );
  }
  return {
    manifestHash,
    releaseId,
    sequence,
  } satisfies SlotIdentity;
});

/** Loads the exact release and direct base sequences that must remain reachable. */
const protectedRelease = Effect.fn("contentRelease.protectedRelease")(
  function* (release: Docs["contentReleases"], identity?: SlotIdentity) {
    const { sequence } = release;
    if (
      !isSequence(sequence) ||
      (identity !== undefined && sequence !== identity.sequence)
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Content release ${release.releaseId} lost its exact protected identity.`
      );
    }
    if (
      identity !== undefined &&
      release.manifestHash !== identity.manifestHash
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Content release ${release.releaseId} lost its exact protected identity.`
      );
    }
    const baseId = release.baseReleaseId;
    const baseHash = release.baseManifestHash;
    if ((baseId === null) !== (baseHash === null)) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Content release ${release.releaseId} lost its exact protected base.`
      );
    }
    if (baseId === null || baseHash === null) {
      return [sequence];
    }
    const base = yield* loadRelease(baseId);
    if (!isSequence(base.sequence)) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Content release ${release.releaseId} lost its exact protected base.`
      );
    }
    if (base.manifestHash !== baseHash) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Content release ${release.releaseId} lost its exact protected base.`
      );
    }
    return [sequence, base.sequence];
  }
);

/** Protects all stored history when one reachability fact is unprovable. */
const earliestStoredSequence = Effect.fn(
  "contentRelease.earliestStoredSequence"
)(function* (state: Docs["contentState"]) {
  const database = yield* DatabaseReader;
  const earliest = yield* database
    .table("contentReleases")
    .index("by_sequence", "asc")
    .first()
    .pipe(Effect.map(Option.getOrNull), Effect.orDie);
  return earliest?.sequence ?? state.nextSequence;
});

/** Computes the earliest sequence protected by slots and known-good history. */
const protectedFloor = Effect.fn("contentRelease.protectedFloor")(function* (
  state: Docs["contentState"]
) {
  const database = yield* DatabaseReader;
  const slots = yield* Effect.all([
    slotIdentity(
      "active",
      state.activeManifestHash,
      state.activeReleaseId,
      state.activeSequence
    ),
    slotIdentity(
      "candidate",
      state.candidateManifestHash,
      state.candidateReleaseId,
      state.candidateSequence
    ),
    slotIdentity(
      "recovery",
      state.recoveryManifestHash,
      state.recoveryReleaseId,
      state.recoverySequence
    ),
  ]);
  const slotSequences = yield* Effect.forEach(slots, (slot) => {
    if (slot === null) {
      return Effect.succeed<null | readonly number[]>([]);
    }
    return loadRelease(slot.releaseId).pipe(
      Effect.flatMap((release) => protectedRelease(release, slot)),
      // A missing slot release is an unprovable reachability fact: never
      // break compaction, protect the stored history instead.
      Effect.catchTag("ReleaseError", (error: ReleaseError) =>
        error.code === "CONTENT_RELEASE_MISSING"
          ? Effect.succeed(null)
          : Effect.fail(error)
      )
    );
  });
  const completed = yield* database
    .table("contentReleases")
    .index(
      "by_status_and_sequence",
      (query) => query.eq("status", "completed"),
      "desc"
    )
    .take(2)
    .pipe(Effect.orDie);
  const completedSequences = yield* Effect.forEach(completed, (release) =>
    protectedRelease(release)
  );
  const sequences: number[] = [];
  for (const entry of [...slotSequences, ...completedSequences]) {
    if (entry === null) {
      return yield* earliestStoredSequence(state);
    }
    sequences.push(...entry);
  }
  return sequences.length === 0 ? state.nextSequence : Math.min(...sequences);
});

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
  const retained = releases.find((release) => release.createdAt >= cutoff);
  if (retained) {
    return retained.sequence;
  }
  if (page.isDone) {
    return ceiling;
  }
  const boundary = releases.at(-1);
  return boundary ? Math.min(boundary.sequence, ceiling) : from;
});

/** Validates and returns a previously persisted compaction cycle. */
const activeCycle = Effect.fn("contentRelease.activeCompaction")(function* (
  state: Docs["contentState"],
  compactedFloor: number
) {
  const required = [
    state.compactFloor,
    state.compactFrom,
    state.compactPhase,
    state.compactStartedAt,
  ];
  const present = required.filter((value) => value !== undefined).length;
  if (present === 0 && state.compactCursor === undefined) {
    return null;
  }
  if (
    present !== required.length ||
    state.compactFloor === undefined ||
    state.compactFrom === undefined ||
    state.compactPhase === undefined ||
    state.compactStartedAt === undefined ||
    !Number.isSafeInteger(state.compactFloor) ||
    !Number.isSafeInteger(state.compactFrom) ||
    state.compactFrom !== compactedFloor ||
    state.compactFrom < 0 ||
    state.compactFloor <= state.compactFrom ||
    state.compactFloor > state.nextSequence ||
    !Number.isFinite(state.compactStartedAt) ||
    state.compactStartedAt < 0 ||
    (state.compactCursor !== undefined && state.compactCursor.length === 0)
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Content compaction lost its durable cycle identity."
    );
  }
  return {
    cursor: state.compactCursor ?? null,
    floor: state.compactFloor,
    from: state.compactFrom,
    phase: state.compactPhase,
    startedAt: state.compactStartedAt,
    state,
  } satisfies CompactionCycle;
});

/** Resumes an active cycle or starts one conservative bounded history range. */
export const ensureCompaction = Effect.fn("contentRelease.ensureCompaction")(
  function* () {
    const writer = yield* DatabaseWriter;
    const state = yield* ensureState();
    const compactedFloor = state.compactedFloor ?? 0;
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
    const existing = yield* activeCycle(state, compactedFloor);
    if (existing) {
      return {
        complete: false,
        cycle: existing,
      } as const;
    }
    const ceiling = yield* protectedFloor(state);
    const floor = yield* retainedFloor(compactedFloor, ceiling);
    if (floor <= compactedFloor) {
      return {
        complete: true,
        floor: compactedFloor,
      } as const;
    }
    const now = yield* Clock.currentTimeMillis;
    yield* writer
      .table("contentState")
      .patch(state._id, {
        compactCursor: undefined,
        compactFloor: floor,
        compactFrom: compactedFloor,
        compactPhase: "heads",
        compactStartedAt: now,
        updatedAt: now,
      })
      .pipe(Effect.orDie);
    return {
      complete: false,
      cycle: {
        cursor: null,
        floor,
        from: compactedFloor,
        phase: "heads",
        startedAt: now,
        state: {
          ...state,
          compactFloor: floor,
        },
      } satisfies CompactionCycle,
    } as const;
  }
);
