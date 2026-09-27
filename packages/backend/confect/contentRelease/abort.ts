import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  abortRowCount,
  deleteAbortRows,
  hasAbortResidue,
} from "@repo/backend/confect/contentRelease/abort/rows";
import {
  deleteAbortRuntime,
  hasAbortRuntime,
} from "@repo/backend/confect/contentRelease/abort/runtime";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import {
  loadRelease,
  loadState,
  ownsRole,
} from "@repo/backend/confect/contentRelease/model";
import {
  deleteModelBuild,
  loadModelBuild,
} from "@repo/backend/confect/contentRelease/models/build";
import { stopProofWorkflow } from "@repo/backend/confect/contentRelease/proof/coordinator";
import { Clock, Effect, Option } from "effect";

/** Validates durable progress for one still-invisible abort operation. */
export const abortEvidence = Effect.fn("contentRelease.abortEvidence")(
  function* (release: {
    readonly abortedRows?: number;
    readonly abortingAt?: number;
    readonly checkedItems: number;
    readonly stagedItems: number;
    readonly stagedRoutes: number;
    readonly stagedSnapshotBatches: number;
  }) {
    const processed = release.abortedRows;
    const total = abortRowCount(release);
    if (
      release.abortingAt === undefined ||
      processed === undefined ||
      !Number.isSafeInteger(processed) ||
      processed < 0 ||
      processed >= total
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Aborting content release lost durable progress evidence."
      );
    }
    return processed;
  }
);

/** Proves one aborted release is terminal and detached from state. */
export const validateAbortedRelease = Effect.fn(
  "contentRelease.validateAbortedRelease"
)(function* (releaseId: string) {
  const database = yield* DatabaseReader;
  const release = yield* loadRelease(releaseId);
  const state = yield* loadState();
  const [build, rows, residue, runtime] = yield* Effect.all([
    loadModelBuild(),
    Effect.all([
      database
        .table("contentHeads")
        .index("by_releaseId_and_index", (query) =>
          query.eq("releaseId", releaseId)
        )
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie),
      database
        .table("snapshotBatches")
        .index("by_releaseId_and_family_and_batchIndex", (query) =>
          query.eq("releaseId", releaseId)
        )
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie),
      database
        .table("contentBindings")
        .index("by_releaseId_and_index", (query) =>
          query.eq("releaseId", releaseId)
        )
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie),
      database
        .table("contentItems")
        .index("by_releaseId_and_index", (query) =>
          query.eq("releaseId", releaseId)
        )
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie),
    ]),
    hasAbortResidue(release.sequence),
    hasAbortRuntime(releaseId),
  ]);
  if (
    release.status !== "aborted" ||
    release.abortedAt === undefined ||
    release.abortingAt === undefined ||
    release.abortedRows !== abortRowCount(release) ||
    release.proofFailure !== undefined ||
    release.proofWorkflowId !== undefined ||
    state?.activeReleaseId === releaseId ||
    state?.candidateReleaseId === releaseId ||
    state?.recoveryReleaseId === releaseId ||
    build?.releaseId === releaseId ||
    residue ||
    runtime ||
    rows.some((row) => row !== null)
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Aborted release ${releaseId} retained publication state.`
    );
  }
  return release;
});

/** Abandons only an invisible candidate or retained recovery slot. */
export const abortProgram = Effect.fn("contentRelease.abort")(function* (
  releaseId: string
) {
  const writer = yield* DatabaseWriter;
  const release = yield* loadRelease(releaseId);
  if (release.status === "completed") {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      `Active release ${releaseId} cannot be aborted.`
    );
  }
  if (release.status === "aborted") {
    yield* validateAbortedRelease(releaseId);
    const total = abortRowCount(release);
    return {
      complete: true,
      processedItems: total,
      releaseId,
      totalItems: total,
    };
  }
  const state = yield* loadState();
  if (!(state && ownsRole(state, release.role, release))) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      `Release ${releaseId} does not own an invisible slot.`
    );
  }
  if (release.role === "candidate" && state.recoveryReleaseId) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      `Recovery ${state.recoveryReleaseId} must be aborted before candidate ${releaseId}.`
    );
  }
  const before =
    release.status === "aborting" ? yield* abortEvidence(release) : 0;
  if (release.proofWorkflowId) {
    yield* stopProofWorkflow(release.proofWorkflowId);
  }
  const total = abortRowCount(release);
  yield* deleteAbortRuntime(releaseId);
  const deleted = yield* deleteAbortRows(releaseId, release.sequence);
  if (deleted === 0 && before < total) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Release ${releaseId} lost abort-owned rows before completion.`
    );
  }
  const processed = before + deleted;
  if (processed > total) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Release ${releaseId} abort exceeded its durable row count.`
    );
  }
  const complete = processed === total;
  if (complete && (yield* hasAbortResidue(release.sequence))) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Release ${releaseId} retained staged publication ownership.`
    );
  }
  const now = yield* Clock.currentTimeMillis;
  yield* writer
    .table("contentReleases")
    .patch(release._id, {
      abortedAt: complete ? now : undefined,
      abortedRows: processed,
      abortingAt: release.abortingAt ?? now,
      proofFailure: undefined,
      proofWorkflowId: undefined,
      status: complete ? "aborted" : "aborting",
      updatedAt: now,
    })
    .pipe(Effect.orDie);
  if (!complete) {
    return {
      complete: false,
      processedItems: processed,
      releaseId,
      totalItems: total,
    };
  }
  yield* deleteModelBuild(releaseId);
  const slot =
    release.role === "candidate"
      ? {
          candidateManifestHash: undefined,
          candidateReleaseId: undefined,
          candidateSequence: undefined,
        }
      : {
          recoveryManifestHash: undefined,
          recoveryReleaseId: undefined,
          recoverySequence: undefined,
        };
  yield* writer
    .table("contentState")
    .patch(state._id, {
      ...slot,
      updatedAt: now,
    })
    .pipe(Effect.orDie);
  return {
    complete,
    processedItems: processed,
    releaseId,
    totalItems: total,
  };
});
