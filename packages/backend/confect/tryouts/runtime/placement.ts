import {
  tryoutCatalogIdentity,
  tryoutPlacementIdentity,
} from "@nakafa/aksara-contracts/tryout/identity";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { TRYOUT_ATTEMPT_PLACEMENT_DOCUMENT_LIMIT } from "@repo/backend/confect/contentRelease/tryout/limits";
import { freeze } from "@repo/backend/confect/response/projection";
import { TryoutAttemptStateError } from "@repo/backend/confect/tryouts/attempt";
import {
  TryoutRuntimeError,
  toTryoutRuntimeError,
} from "@repo/backend/confect/tryouts/runtime/error";
import type { TryoutSnapshotSource } from "@repo/backend/confect/tryouts/start/source";
import { toTryoutStartError } from "@repo/backend/confect/tryouts/start/spec";
import { getDocumentSize } from "convex/values";
import { Array as Arr, Effect, Option } from "effect";

type TryoutAttempt = Docs["tryoutAttempts"];
type TryoutSectionSnapshot = TryoutAttempt["sectionSnapshots"][number];

/** Loads the immutable section snapshot for one attempt section key. */
export const requireSectionSnapshot = Effect.fn(
  "tryouts.runtime.requireSectionSnapshot"
)(function* (attempt: TryoutAttempt, sectionKey: string) {
  const snapshot = Option.getOrUndefined(
    Arr.findFirst(
      attempt.sectionSnapshots,
      (section) => section.sectionKey === sectionKey
    )
  );
  if (!snapshot) {
    return yield* new TryoutAttemptStateError({
      code: "TRYOUT_SECTION_NOT_FOUND",
      message: "Try-out section is not part of this attempt.",
    });
  }
  return snapshot;
});

/**
 * Loads one bounded attempt placement inventory for finalization.
 * @see https://docs.convex.dev/production/state/limits#transactions
 */
export const loadAttemptPlacements = Effect.fn(
  "tryouts.runtime.loadAttemptPlacements"
)(function* (attempt: TryoutAttempt) {
  const database = yield* DatabaseReader;
  return yield* database
    .table("tryoutAttemptPlacements")
    .index("by_tryoutAttemptId_and_questionOrder", (query) =>
      query.eq("tryoutAttemptId", attempt._id)
    )
    .take(attempt.totalQuestions + 1)
    .pipe(Effect.mapError(toTryoutRuntimeError));
});

/** Loads one bounded section placement inventory for finalization. */
export const loadSectionPlacements = Effect.fn(
  "tryouts.runtime.loadSectionPlacements"
)(function* (attempt: TryoutAttempt, snapshot: TryoutSectionSnapshot) {
  const database = yield* DatabaseReader;
  return yield* database
    .table("tryoutAttemptPlacements")
    .index("by_tryoutAttemptId_and_sectionKey_and_questionOrder", (query) =>
      query
        .eq("tryoutAttemptId", attempt._id)
        .eq("sectionKey", snapshot.sectionKey)
    )
    .take(snapshot.questionCount + 1)
    .pipe(Effect.mapError(toTryoutRuntimeError));
});

/** Freezes the authenticated signed placement snapshot. */
export const createAttemptPlacements = Effect.fn(
  "tryouts.runtime.createAttemptPlacements"
)(function* (args: {
  readonly attempt: TryoutAttempt;
  readonly source: TryoutSnapshotSource;
}) {
  const writer = yield* DatabaseWriter;
  for (const source of args.source.snapshot.sections) {
    const sectionIdentity = tryoutCatalogIdentity(source.section.row);
    const snapshot = Option.getOrUndefined(
      Arr.findFirst(
        args.attempt.sectionSnapshots,
        (candidate) => candidate.sectionIdentity === sectionIdentity
      )
    );
    if (
      !snapshot ||
      snapshot.sectionRowHash !== source.section.rowHash ||
      snapshot.questionCount !== source.placements.length
    ) {
      return yield* startMismatch(
        "Try-out section changed before its attempt was frozen."
      );
    }
    for (const placement of source.placements) {
      const frozenPlacement = {
        answerArtifactHash: placement.row.answerArtifactHash,
        answerContentKey: placement.row.answerContentKey,
        contentHash: placement.row.contentHash,
        placementIdentity: tryoutPlacementIdentity(placement.row),
        placementRowHash: placement.rowHash,
        questionArtifactHash: placement.row.questionArtifactHash,
        questionContentKey: placement.row.questionContentKey,
        questionOrder: placement.row.questionOrder,
        rendererDomain: placement.row.rendererDomain,
        responseSpec: freeze(
          placement.row.response,
          placement.row.deliveryLanguage
        ),
        ...(placement.row.points === undefined
          ? {}
          : { points: placement.row.points }),
        sectionIdentity,
        sectionKey: placement.row.sectionKey,
        sourcePath: placement.row.questionSourcePath,
        sourceRevision: placement.row.sourceRevision,
        tryoutAttemptId: args.attempt._id,
      };
      if (
        getDocumentSize(frozenPlacement) >=
        TRYOUT_ATTEMPT_PLACEMENT_DOCUMENT_LIMIT
      ) {
        return yield* startMismatch(
          "Try-out placement exceeds the runtime read ceiling."
        );
      }
      yield* writer
        .table("tryoutAttemptPlacements")
        .insert(frozenPlacement)
        .pipe(Effect.mapError(toTryoutStartError));
    }
  }
});

/** Creates one typed fail-closed snapshot mismatch. */
function startMismatch(message: string) {
  return new TryoutRuntimeError({
    code: "TRYOUT_SECTION_SNAPSHOT_MISMATCH",
    message,
  });
}
