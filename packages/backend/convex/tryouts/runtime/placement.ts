import {
  tryoutCatalogIdentity,
  tryoutPlacementIdentity,
} from "@nakafa/aksara-contracts/tryout/identity";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type { TryoutStartSource } from "@repo/backend/convex/tryouts/start/source";
import {
  TryoutStartError,
  toTryoutStartError,
  tryoutStartErrorCode,
} from "@repo/backend/convex/tryouts/start/spec";
import { ConvexError } from "convex/values";
import { Effect } from "effect";

type TryoutAttempt = Doc<"tryoutAttempts">;
type TryoutSectionSnapshot = TryoutAttempt["sectionSnapshots"][number];

/** Loads the immutable section snapshot for one attempt section key. */
export function requireSectionSnapshot(
  attempt: TryoutAttempt,
  sectionKey: string
): TryoutSectionSnapshot {
  const snapshot = attempt.sectionSnapshots.find(
    (section) => section.sectionKey === sectionKey
  );

  if (!snapshot) {
    throw new ConvexError({
      code: "TRYOUT_SECTION_NOT_FOUND",
      message: "Try-out section is not part of this attempt.",
    });
  }

  return snapshot;
}

/** Freezes the authenticated signed placement snapshot. */
export const createAttemptPlacements = Effect.fn(
  "tryouts.runtime.createAttemptPlacements"
)(function* (
  ctx: MutationCtx,
  args: {
    readonly attempt: TryoutAttempt;
    readonly source: TryoutStartSource;
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
      yield* tryStartPromise(() =>
        ctx.db.insert("tryoutAttemptPlacements", {
          answerArtifactHash: placement.row.answerArtifactHash,
          answerContentKey: placement.row.answerContentKey,
          choiceSnapshots: [...placement.row.choices],
          contentHash: placement.row.contentHash,
          placementIdentity: tryoutPlacementIdentity(placement.row),
          placementRowHash: placement.rowHash,
          questionArtifactHash: placement.row.questionArtifactHash,
          questionContentKey: placement.row.questionContentKey,
          questionOrder: placement.row.questionOrder,
          rendererDomain: placement.row.rendererDomain,
          sectionIdentity,
          sectionKey: placement.row.sectionKey,
          sourcePath: placement.row.questionSourcePath,
          sourceRevision: placement.row.sourceRevision,
          title: placement.row.title,
          tryoutAttemptId: args.attempt._id,
        })
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
