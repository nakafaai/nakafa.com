import {
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import { contentSnapshotError } from "@repo/backend/content/snapshot/error";
import {
  hashCanonicalJson,
  type JsonObject,
  stripConvexSystemFields,
} from "@repo/backend/content/snapshot/json";
import type { RuntimeSelectionIdentity } from "@repo/backend/content/snapshot/spec";
import { modelSlotValidator } from "@repo/backend/convex/contentRelease/models/slot";
import { COMPACTION_PHASES } from "@repo/backend/convex/contentRelease/spec";
import { Effect, Schema } from "effect";

const SequenceSchema = Schema.Finite.pipe(
  Schema.check(Schema.isInt()),
  Schema.check(Schema.isGreaterThan(0))
);
const TimestampSchema = Schema.Finite.pipe(
  Schema.check(Schema.isInt()),
  Schema.check(Schema.isGreaterThan(0))
);
const OptionalManifestHashSchema = Schema.optional(Sha256HashSchema);
const OptionalReleaseIdSchema = Schema.optional(ReleaseIdSchema);
const OptionalSequenceSchema = Schema.optional(SequenceSchema);
const CompactionPhaseSchema = Schema.Literals(COMPACTION_PHASES);
const ModelSlotSchema = Schema.Literals(
  modelSlotValidator.members.map((member) => member.value)
);
const PublishedContentStateSchema = Schema.Struct({
  activeManifestHash: Sha256HashSchema,
  activeReleaseId: ReleaseIdSchema,
  activeSequence: SequenceSchema,
  articleManifestHash: Sha256HashSchema,
  articleReleaseId: ReleaseIdSchema,
  articleSequence: SequenceSchema,
  articleSlot: ModelSlotSchema,
  candidateManifestHash: OptionalManifestHashSchema,
  candidateReleaseId: OptionalReleaseIdSchema,
  candidateSequence: OptionalSequenceSchema,
  compactCursor: Schema.optional(Schema.String),
  compactFloor: Schema.optional(
    Schema.Finite.check(Schema.isInt()).check(Schema.isGreaterThanOrEqualTo(0))
  ),
  compactFrom: Schema.optional(
    Schema.Finite.check(Schema.isInt()).check(Schema.isGreaterThanOrEqualTo(0))
  ),
  compactPhase: Schema.optional(CompactionPhaseSchema),
  compactStartedAt: Schema.optional(
    Schema.Finite.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0)))
  ),
  compactedFloor: Schema.optional(
    Schema.Finite.check(Schema.isInt()).check(Schema.isGreaterThanOrEqualTo(0))
  ),
  key: Schema.Literal("primary"),
  materialManifestHash: Sha256HashSchema,
  materialReleaseId: ReleaseIdSchema,
  materialSequence: SequenceSchema,
  materialSlot: ModelSlotSchema,
  nextSequence: SequenceSchema,
  recoveryManifestHash: OptionalManifestHashSchema,
  recoveryReleaseId: OptionalReleaseIdSchema,
  recoverySequence: OptionalSequenceSchema,
  searchManifestHash: Sha256HashSchema,
  searchReleaseId: ReleaseIdSchema,
  searchSequence: SequenceSchema,
  searchSlot: ModelSlotSchema,
  updatedAt: TimestampSchema,
});
type PublishedContentState = Schema.Schema.Type<
  typeof PublishedContentStateSchema
>;
export interface RuntimeGenerations {
  readonly runtimeSelectionHash: string;
}
/** Proves the public signed selection did not change during the CI run. */
export const verifyRuntimeSelection = (
  expected: RuntimeSelectionIdentity,
  actual: RuntimeGenerations
) => {
  if (expected.runtimeSelectionHash === actual.runtimeSelectionHash) {
    return Effect.void;
  }
  return Effect.fail(
    contentSnapshotError(
      "Production signed content pointer changed during runtime verification."
    )
  );
};
/** Returns whether one optional release slot is either absent or complete. */
function hasCompleteOptionalIdentity(
  manifestHash: string | undefined,
  releaseId: string | undefined,
  sequence: number | undefined
) {
  const fields = [manifestHash, releaseId, sequence];
  const present = fields.filter((field) => field !== undefined).length;
  return present === 0 || present === fields.length;
}
/** Mirrors the backend invariant for one resumable compaction cycle. */
function hasValidCompactionIdentity(state: PublishedContentState) {
  const compactedFloor = state.compactedFloor ?? 0;
  if (compactedFloor > state.nextSequence) {
    return false;
  }
  const required = [
    state.compactFloor,
    state.compactFrom,
    state.compactPhase,
    state.compactStartedAt,
  ];
  const present = required.filter((field) => field !== undefined).length;
  if (present === 0 && state.compactCursor === undefined) {
    return true;
  }
  return (
    present === required.length &&
    state.compactFloor !== undefined &&
    state.compactFrom !== undefined &&
    state.compactPhase !== undefined &&
    state.compactStartedAt !== undefined &&
    state.compactFrom === compactedFloor &&
    state.compactFloor > state.compactFrom &&
    state.compactFloor <= state.nextSequence &&
    (state.compactCursor === undefined || state.compactCursor.length > 0)
  );
}
/** Returns whether one read model is pinned to the active signed release. */
function hasActiveIdentity(
  state: PublishedContentState,
  manifestHash: string,
  releaseId: string,
  sequence: number
) {
  return (
    manifestHash === state.activeManifestHash &&
    releaseId === state.activeReleaseId &&
    sequence === state.activeSequence
  );
}
/** Decodes the full stored row before classifying generation-neutral fields. */
const decodePublishedContentState = (row: JsonObject) =>
  Schema.decodeUnknownEffect(PublishedContentStateSchema)(row, {
    onExcessProperty: "error",
  }).pipe(
    Effect.mapError(() =>
      contentSnapshotError(
        "Production contentState is not a complete published pointer."
      )
    )
  );
/** Projects only signed identities that can change rendered runtime output. */
const runtimePointer = (state: PublishedContentState) => ({
  active: {
    manifestHash: state.activeManifestHash,
    releaseId: state.activeReleaseId,
    sequence: state.activeSequence,
  },
  article: {
    manifestHash: state.articleManifestHash,
    releaseId: state.articleReleaseId,
    sequence: state.articleSequence,
    slot: state.articleSlot,
  },
  material: {
    manifestHash: state.materialManifestHash,
    releaseId: state.materialReleaseId,
    sequence: state.materialSequence,
    slot: state.materialSlot,
  },
  search: {
    manifestHash: state.searchManifestHash,
    releaseId: state.searchReleaseId,
    sequence: state.searchSequence,
    slot: state.searchSlot,
  },
});
/** Builds the stable signed generation identity from one complete pointer. */
export const readPublishedContentState = Effect.fn(
  "contentRuntime.readPublishedContentState"
)(function* (contentState: readonly JsonObject[]) {
  if (contentState.length !== 1) {
    return yield* contentSnapshotError(
      "Production contentState must contain exactly one row."
    );
  }
  const activePointer = contentState[0];
  if (!activePointer) {
    return yield* contentSnapshotError(
      "Production contentState must contain exactly one row."
    );
  }
  const state = yield* decodePublishedContentState(
    stripConvexSystemFields(activePointer)
  );
  if (!hasValidCompactionIdentity(state)) {
    return yield* contentSnapshotError(
      "Production contentState has an invalid compaction identity."
    );
  }
  const slotsAreComplete =
    hasCompleteOptionalIdentity(
      state.candidateManifestHash,
      state.candidateReleaseId,
      state.candidateSequence
    ) &&
    hasCompleteOptionalIdentity(
      state.recoveryManifestHash,
      state.recoveryReleaseId,
      state.recoverySequence
    );
  const readModelsAreActive =
    hasActiveIdentity(
      state,
      state.articleManifestHash,
      state.articleReleaseId,
      state.articleSequence
    ) &&
    hasActiveIdentity(
      state,
      state.materialManifestHash,
      state.materialReleaseId,
      state.materialSequence
    ) &&
    hasActiveIdentity(
      state,
      state.searchManifestHash,
      state.searchReleaseId,
      state.searchSequence
    );
  if (!(slotsAreComplete && readModelsAreActive)) {
    return yield* contentSnapshotError(
      "Production contentState is not synchronized to one signed generation."
    );
  }
  return state;
});
/** Builds the stable signed generation identity from one complete pointer. */
export const buildRuntimeGenerations = Effect.fn(
  "contentRuntime.buildGenerations"
)(function* (contentState: readonly JsonObject[]) {
  const state = yield* readPublishedContentState(contentState);
  return {
    runtimeSelectionHash: yield* hashCanonicalJson(runtimePointer(state)),
  } satisfies RuntimeGenerations;
});
