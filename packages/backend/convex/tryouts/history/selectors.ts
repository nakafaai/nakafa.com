import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { verifyStoredTryoutPlacement } from "@repo/backend/convex/tryouts/history/placement";
import { loadStoredTryoutPlacement } from "@repo/backend/convex/tryouts/history/rows";
import type { TryoutSectionContentAccess } from "@repo/backend/convex/tryouts/runtime/content";
import { TryoutRuntimeError } from "@repo/backend/convex/tryouts/runtime/error";
import { Effect } from "effect";

type TryoutAttempt = Doc<"tryoutAttempts">;
type TryoutPlacement = Doc<"tryoutAttemptPlacements">;
type HistoryContent = Extract<
  TryoutSectionContentAccess,
  { readonly runtime: "history" }
>;
/** Projects one retained attempt through authenticated historical placements. */
export const projectStoredTryoutContent = Effect.fn(
  "tryouts.history.projectStoredContent"
)(function* (input: {
  readonly answers: boolean;
  readonly appLocale: AppLocaleCode;
  readonly attempt: TryoutAttempt;
  readonly ctx: QueryCtx;
  readonly placements: readonly TryoutPlacement[];
}) {
  const selections = yield* Effect.forEach(
    input.placements,
    (placement) =>
      loadHistorySelection(
        input.ctx,
        input.appLocale,
        input.attempt,
        placement
      ),
    { concurrency: 16 }
  );
  const content: HistoryContent = {
    answers: input.answers ? selections.map(({ answer }) => answer) : [],
    attemptId: input.attempt._id,
    kind: "signed",
    questions: selections.map(({ question }) => question),
    runtime: "history",
  };
  return content;
});

/** Authenticates one frozen placement before exposing its old body selectors. */
const loadHistorySelection = Effect.fn("tryouts.history.loadStoredSelector")(
  function* (
    ctx: QueryCtx,
    appLocale: AppLocaleCode,
    attempt: TryoutAttempt,
    placement: TryoutPlacement
  ) {
    const historical = yield* loadStoredTryoutPlacement(
      ctx,
      attempt.tryoutSnapshotId,
      placement.placementRowHash
    );
    if (!historical) {
      return yield* historySelectorIntegrity(
        "Retained try-out selector differs from its frozen placement."
      );
    }
    const verified = yield* verifyStoredTryoutPlacement(
      historical,
      placement
    ).pipe(
      Effect.mapError(() =>
        historySelectorIntegrity(
          "Retained try-out selector differs from its frozen placement."
        )
      )
    );
    const common = {
      appLocale,
      contentHash: verified.contentHash,
      questionOrder: verified.questionOrder,
      snapshotId: attempt.tryoutSnapshotId,
      snapshotReleaseId: attempt.snapshotReleaseId,
      sourcePath: verified.questionSourcePath,
      sourceRevision: verified.sourceRevision,
    };
    return {
      answer: {
        ...common,
        artifactHash: verified.answerArtifactHash,
        artifactLocale: verified.artifactLocale,
        contentKey: verified.answerContentKey,
        delivery: "entitled" as const,
      },
      question: {
        ...common,
        artifactHash: verified.questionArtifactHash,
        artifactLocale: verified.artifactLocale,
        contentKey: verified.questionContentKey,
        delivery: "authenticated" as const,
      },
    };
  }
);

/** Creates one stable retained-selector integrity failure. */
function historySelectorIntegrity(message: string) {
  return new TryoutRuntimeError({
    code: "TRYOUT_HISTORY_SELECTOR_INTEGRITY",
    message,
  });
}
