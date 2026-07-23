import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  ensureState,
  loadRelease,
} from "@repo/backend/convex/contentRelease/model";
import { decodeReleaseJson } from "@repo/backend/convex/contentRelease/parse";
import { ROLLBACK_RETENTION_MS } from "@repo/backend/convex/contentRelease/spec";
import { Effect } from "effect";

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
  readonly phase: NonNullable<Doc<"contentState">["compactPhase"]>;
  readonly startedAt: number;
  readonly state: Doc<"contentState">;
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
  return { manifestHash, releaseId, sequence } satisfies SlotIdentity;
});

/** Loads the exact slot and direct base sequences that must remain reachable. */
const protectedSlot = Effect.fn("contentRelease.protectedSlot")(function* (
  ctx: MutationCtx,
  slot: null | SlotIdentity
) {
  if (!slot) {
    return [];
  }
  const release = yield* loadRelease(ctx, slot.releaseId);
  const signed = yield* decodeReleaseJson(release.releaseJson);
  if (
    release.sequence !== slot.sequence ||
    !isSequence(release.sequence) ||
    signed.manifestHash !== slot.manifestHash
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Content slot ${slot.releaseId} lost its exact release identity.`
    );
  }
  const baseId = signed.manifest.baseReleaseId;
  const baseHash = signed.manifest.baseManifestHash;
  if (baseId === null || baseHash === null) {
    if (baseId !== null || baseHash !== null) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Content slot ${slot.releaseId} has an incomplete base identity.`
      );
    }
    return [slot.sequence];
  }
  const base = yield* loadRelease(ctx, baseId);
  const baseSigned = yield* decodeReleaseJson(base.releaseJson);
  if (!isSequence(base.sequence) || baseSigned.manifestHash !== baseHash) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Content slot ${slot.releaseId} lost its exact base release.`
    );
  }
  return [slot.sequence, base.sequence];
});

/** Computes the earliest sequence protected by slots and known-good history. */
const protectedFloor = Effect.fn("contentRelease.protectedFloor")(function* (
  ctx: MutationCtx,
  state: Doc<"contentState">
) {
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
  const slotSequences = yield* Effect.forEach(slots, (slot) =>
    protectedSlot(ctx, slot)
  );
  const completed = yield* Effect.promise(() =>
    ctx.db
      .query("contentReleases")
      .withIndex("by_status_and_sequence", (query) =>
        query.eq("status", "completed")
      )
      .order("desc")
      .take(2)
  );
  const sequences = [
    ...slotSequences.flat(),
    ...completed.map((release) => release.sequence),
  ];
  if (sequences.some((sequence) => !isSequence(sequence))) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Content compaction found an invalid protected sequence."
    );
  }
  return sequences.length === 0 ? state.nextSequence : Math.min(...sequences);
});

/** Advances through only a bounded old release window before a protected floor. */
const retainedFloor = Effect.fn("contentRelease.retainedFloor")(function* (
  ctx: MutationCtx,
  from: number,
  ceiling: number
) {
  const releases = yield* Effect.promise(() =>
    ctx.db
      .query("contentReleases")
      .withIndex("by_sequence", (query) =>
        query.gte("sequence", from).lt("sequence", ceiling)
      )
      .take(RELEASE_SCAN_COUNT + 1)
  );
  for (let index = 1; index < releases.length; index += 1) {
    if (releases[index]?.sequence === releases[index - 1]?.sequence) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Content releases share compaction sequence ${releases[index]?.sequence}.`
      );
    }
  }
  const cutoff = Date.now() - ROLLBACK_RETENTION_MS;
  const window = releases.slice(0, RELEASE_SCAN_COUNT);
  const retained = window.find((release) => release.createdAt >= cutoff);
  if (retained) {
    return retained.sequence;
  }
  if (releases.length <= RELEASE_SCAN_COUNT) {
    return ceiling;
  }
  const last = window.at(-1);
  return last ? Math.min(last.sequence + 1, ceiling) : from;
});

/** Validates and returns a previously persisted compaction cycle. */
const activeCycle = Effect.fn("contentRelease.activeCompaction")(function* (
  state: Doc<"contentState">,
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
  function* (ctx: MutationCtx) {
    const state = yield* ensureState(ctx);
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
      return existing;
    }
    const ceiling = yield* protectedFloor(ctx, state);
    const floor = yield* retainedFloor(ctx, compactedFloor, ceiling);
    if (floor <= compactedFloor) {
      return null;
    }
    const now = Date.now();
    yield* Effect.promise(() =>
      ctx.db.patch("contentState", state._id, {
        compactCursor: undefined,
        compactFloor: floor,
        compactFrom: compactedFloor,
        compactPhase: "heads",
        compactStartedAt: now,
        updatedAt: now,
      })
    );
    return {
      cursor: null,
      floor,
      from: compactedFloor,
      phase: "heads",
      startedAt: now,
      state: { ...state, compactFloor: floor },
    } satisfies CompactionCycle;
  }
);
