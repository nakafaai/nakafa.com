import {
  tryoutCatalogIdentity,
  tryoutPlacementIdentity,
} from "@nakafa/aksara-contracts/tryout/identity";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { responseSpecFromLegacyChoices } from "@repo/backend/convex/tryouts/response/legacy";
import { isAttemptPlacementWithinBudget } from "@repo/backend/convex/tryouts/runtime/budget";
import {
  TryoutRuntimeError,
  tryRuntimePromise,
} from "@repo/backend/convex/tryouts/runtime/error";
import type { TryoutSnapshotSource } from "@repo/backend/convex/tryouts/start/source";
import {
  TryoutStartError,
  toTryoutStartError,
  tryoutStartErrorCode,
} from "@repo/backend/convex/tryouts/start/spec";
import { Effect } from "effect";

type TryoutAttempt = Doc<"tryoutAttempts">;
type TryoutSectionSnapshot = TryoutAttempt["sectionSnapshots"][number];
type TryoutReadContext = Pick<QueryCtx, "db">;

/** Loads the immutable section snapshot for one attempt section key. */
export const requireSectionSnapshot = Effect.fn(
  "tryouts.runtime.requireSectionSnapshot"
)(function* (attempt: TryoutAttempt, sectionKey: string) {
  const snapshot = attempt.sectionSnapshots.find(
    (section) => section.sectionKey === sectionKey
  );

  if (!snapshot) {
    return yield* new TryoutRuntimeError({
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
)(function* (ctx: TryoutReadContext, attempt: TryoutAttempt) {
  return yield* tryRuntimePromise(() =>
    ctx.db
      .query("tryoutAttemptPlacements")
      .withIndex("by_tryoutAttemptId_and_questionOrder", (query) =>
        query.eq("tryoutAttemptId", attempt._id)
      )
      .take(attempt.totalQuestions + 1)
  );
});

/** Loads one bounded section placement inventory for finalization. */
export const loadSectionPlacements = Effect.fn(
  "tryouts.runtime.loadSectionPlacements"
)(function* (
  ctx: TryoutReadContext,
  attempt: TryoutAttempt,
  snapshot: TryoutSectionSnapshot
) {
  return yield* tryRuntimePromise(() =>
    ctx.db
      .query("tryoutAttemptPlacements")
      .withIndex(
        "by_tryoutAttemptId_and_sectionKey_and_questionOrder",
        (query) =>
          query
            .eq("tryoutAttemptId", attempt._id)
            .eq("sectionKey", snapshot.sectionKey)
      )
      .take(snapshot.questionCount + 1)
  );
});

/** Freezes the authenticated signed placement snapshot. */
export const createAttemptPlacements = Effect.fn(
  "tryouts.runtime.createAttemptPlacements"
)(function* (
  ctx: MutationCtx,
  args: {
    readonly attempt: TryoutAttempt;
    readonly source: TryoutSnapshotSource;
  }
) {
  for (const source of args.source.snapshot.sections) {
    const sectionIdentity = tryoutCatalogIdentity(source.section.row);
    const snapshot = args.attempt.sectionSnapshots.find(
      (candidate) => candidate.sectionIdentity === sectionIdentity
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
      const responseSpec = yield* responseSpecFromLegacyChoices(
        placement.row.choices
      ).pipe(Effect.mapError((cause) => startMismatch(cause.message)));
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
        responseSpec,
        sectionIdentity,
        sectionKey: placement.row.sectionKey,
        sourcePath: placement.row.questionSourcePath,
        sourceRevision: placement.row.sourceRevision,
        tryoutAttemptId: args.attempt._id,
      };
      if (!isAttemptPlacementWithinBudget(frozenPlacement)) {
        return yield* startMismatch(
          "Try-out placement exceeds the runtime read ceiling."
        );
      }
      yield* tryStartPromise(() =>
        ctx.db.insert("tryoutAttemptPlacements", frozenPlacement)
      );
    }
  }
});

/** Creates one typed fail-closed snapshot mismatch. */
function startMismatch(message: string) {
  return new TryoutStartError({
    code: tryoutStartErrorCode.sectionSnapshotMismatch,
    message,
  });
}

/** Lifts one Convex promise into the typed start failure channel. */
function tryStartPromise<A>(operation: () => Promise<A>) {
  return Effect.tryPromise({ catch: toTryoutStartError, try: operation });
}
