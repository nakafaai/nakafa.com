import { FileSystem } from "@effect/platform";
import {
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import { COMPACTION_PHASES } from "@repo/backend/convex/contentRelease/spec";
import { Effect, Redacted, Schema } from "effect";
import { runConvexData } from "./command";
import type {
  CacheIdentity,
  ProductionConfig,
  RuntimeSelectionIdentity,
} from "./config";
import { contentRuntimeCiError } from "./error";
import {
  decodeJsonRows,
  hashCanonicalJson,
  type JsonObject,
  stripConvexSystemFields,
} from "./json";

const SequenceSchema = Schema.Number.pipe(Schema.int(), Schema.positive());
const TimestampSchema = Schema.Number.pipe(Schema.int(), Schema.positive());
const OptionalManifestHashSchema = Schema.optional(Sha256HashSchema);
const OptionalReleaseIdSchema = Schema.optional(ReleaseIdSchema);
const OptionalSequenceSchema = Schema.optional(SequenceSchema);
const CompactionPhaseSchema = Schema.Literal(...COMPACTION_PHASES);

const PublishedContentStateSchema = Schema.Struct({
  activeManifestHash: Sha256HashSchema,
  activeReleaseId: ReleaseIdSchema,
  activeSequence: SequenceSchema,
  articleManifestHash: Sha256HashSchema,
  articleReleaseId: ReleaseIdSchema,
  articleSequence: SequenceSchema,
  candidateManifestHash: OptionalManifestHashSchema,
  candidateReleaseId: OptionalReleaseIdSchema,
  candidateSequence: OptionalSequenceSchema,
  compactCursor: Schema.optional(Schema.String),
  compactFloor: Schema.optional(Schema.NonNegativeInt),
  compactFrom: Schema.optional(Schema.NonNegativeInt),
  compactPhase: Schema.optional(CompactionPhaseSchema),
  compactStartedAt: Schema.optional(
    Schema.JsonNumber.pipe(Schema.nonNegative())
  ),
  compactedFloor: Schema.optional(Schema.NonNegativeInt),
  key: Schema.Literal("primary"),
  materialManifestHash: Sha256HashSchema,
  materialReleaseId: ReleaseIdSchema,
  materialSequence: SequenceSchema,
  nextSequence: SequenceSchema,
  recoveryManifestHash: OptionalManifestHashSchema,
  recoveryReleaseId: OptionalReleaseIdSchema,
  recoverySequence: OptionalSequenceSchema,
  searchManifestHash: Sha256HashSchema,
  searchReleaseId: ReleaseIdSchema,
  searchSequence: SequenceSchema,
  updatedAt: TimestampSchema,
});

type PublishedContentState = Schema.Schema.Type<
  typeof PublishedContentStateSchema
>;

export interface RuntimeGenerations {
  readonly contentStateHash: string;
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
    contentRuntimeCiError(
      "Production signed content pointer changed during runtime verification."
    )
  );
};

/** Proves no publication or compaction state changed during one export. */
export const verifyStableRuntimeExport = (
  expected: CacheIdentity,
  actual: RuntimeGenerations
) => {
  if (expected.contentStateHash === actual.contentStateHash) {
    return Effect.void;
  }

  return Effect.fail(
    contentRuntimeCiError(
      "Production content state changed during signed runtime export."
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
  if (
    !Number.isSafeInteger(compactedFloor) ||
    compactedFloor > state.nextSequence
  ) {
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
    Number.isSafeInteger(state.compactFloor) &&
    Number.isSafeInteger(state.compactFrom) &&
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
  Schema.decodeUnknown(PublishedContentStateSchema)(row, {
    onExcessProperty: "error",
  }).pipe(
    Effect.mapError(() =>
      contentRuntimeCiError(
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
  },
  material: {
    manifestHash: state.materialManifestHash,
    releaseId: state.materialReleaseId,
    sequence: state.materialSequence,
  },
  search: {
    manifestHash: state.searchManifestHash,
    releaseId: state.searchReleaseId,
    sequence: state.searchSequence,
  },
});

/** Builds the stable signed generation identity from one complete pointer. */
export const buildRuntimeGenerations = Effect.fn(
  "contentRuntime.buildGenerations"
)(function* (contentState: readonly JsonObject[]) {
  if (contentState.length !== 1) {
    return yield* contentRuntimeCiError(
      "Production contentState must contain exactly one row."
    );
  }

  const activePointer = contentState[0];
  if (!activePointer) {
    return yield* contentRuntimeCiError(
      "Production contentState must contain exactly one row."
    );
  }

  const storedState = stripConvexSystemFields(activePointer);
  const state = yield* decodePublishedContentState(storedState);
  if (!hasValidCompactionIdentity(state)) {
    return yield* contentRuntimeCiError(
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
    return yield* contentRuntimeCiError(
      "Production contentState is not synchronized to one signed generation."
    );
  }

  return {
    contentStateHash: yield* hashCanonicalJson(storedState),
    runtimeSelectionHash: yield* hashCanonicalJson(runtimePointer(state)),
  } satisfies RuntimeGenerations;
});

/** Reads the exact current signed pointer from production. */
export const readProductionGenerations = Effect.fn(
  "contentRuntime.readProductionGenerations"
)(function* (config: ProductionConfig) {
  const fileSystem = yield* FileSystem.FileSystem;
  const tempRoot = yield* fileSystem.makeTempDirectoryScoped({
    directory: config.runnerTemp,
    prefix: "agent-docs-generations-",
  });
  yield* fileSystem.chmod(tempRoot, 0o700);

  const deployKey = Redacted.value(config.deployKey);
  const contentStatePath = `${tempRoot}/content-state.json`;
  yield* runConvexData({
    deployKey,
    limit: 2,
    logPath: `${tempRoot}/content-state.log`,
    outputPath: contentStatePath,
    table: "contentState",
  });

  const contentState = yield* fileSystem
    .readFileString(contentStatePath)
    .pipe(Effect.flatMap(decodeJsonRows));
  return yield* buildRuntimeGenerations(contentState);
});

export const formatGenerationEnvironment = (generations: RuntimeGenerations) =>
  [
    `AGENT_DOCS_CONTENT_STATE_HASH=${generations.contentStateHash}`,
    `AGENT_DOCS_RUNTIME_SELECTION_HASH=${generations.runtimeSelectionHash}`,
  ].join("\n");
