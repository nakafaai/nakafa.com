import type {
  StoredProtectedRuntimeRequest,
  StoredProtectedRuntimeSelector,
} from "@nakafa/aksara-history/history/decode";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { ReleaseError } from "@repo/backend/convex/contentRelease/error";
import {
  type VerifiedStoredTryoutPlacement,
  verifyStoredTryoutPlacement,
} from "@repo/backend/convex/tryouts/history/placement";
import { loadStoredTryoutPlacement } from "@repo/backend/convex/tryouts/history/rows";
import { Effect } from "effect";

type AttemptPlacement = Doc<"tryoutAttemptPlacements">;
/** Exact historical placement and selector resolved for one old body. */
interface RetainedSelection {
  readonly placement: VerifiedStoredTryoutPlacement;
  readonly selector: StoredProtectedRuntimeSelector;
}

/** Creates one stable fail-closed retained-item error. */
function itemIntegrity(message: string) {
  return new ReleaseError({
    code: "CONTENT_RELEASE_INTEGRITY",
    message,
  });
}

/** Loads all frozen placements once, bounded by the attempt question count. */
const loadAttemptPlacements = Effect.fn(
  "contentRelease.loadRetainedAttemptPlacements"
)(function* (ctx: QueryCtx, attempt: Doc<"tryoutAttempts">) {
  const placements = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutAttemptPlacements")
      .withIndex("by_tryoutAttemptId_and_questionOrder", (index) =>
        index.eq("tryoutAttemptId", attempt._id)
      )
      .take(attempt.totalQuestions + 1)
  );
  if (placements.length !== attempt.totalQuestions) {
    return yield* itemIntegrity(
      "Retained try-out attempt lost its frozen placements."
    );
  }
  return placements;
});

/** Checks one selector owns exactly one body on one historical placement. */
function matchesSelector(
  placement: VerifiedStoredTryoutPlacement,
  selector: StoredProtectedRuntimeSelector
) {
  if (placement.artifactLocale !== selector.artifactLocale) {
    return false;
  }
  if (selector.delivery === "authenticated") {
    return (
      placement.questionArtifactHash === selector.artifactHash &&
      placement.questionContentKey === selector.contentKey
    );
  }
  return (
    placement.answerArtifactHash === selector.artifactHash &&
    placement.answerContentKey === selector.contentKey
  );
}

/** Authenticates one selector against one attempt-owned historical row. */
const resolveSelection = Effect.fn("contentRelease.resolveRetainedSelection")(
  function* (
    ctx: QueryCtx,
    request: StoredProtectedRuntimeRequest,
    selector: StoredProtectedRuntimeSelector,
    placements: readonly AttemptPlacement[]
  ) {
    const candidates = placements.filter((placement) =>
      selector.delivery === "authenticated"
        ? placement.questionArtifactHash === selector.artifactHash
        : placement.answerArtifactHash === selector.artifactHash
    );
    if (candidates.length === 0) {
      return null;
    }
    if (candidates.length !== 1) {
      return yield* itemIntegrity(
        "Retained selector matches multiple frozen placements."
      );
    }
    const placement = candidates[0];
    if (!placement) {
      return null;
    }
    const historical = yield* loadStoredTryoutPlacement(
      ctx,
      request.snapshotId,
      placement.placementRowHash
    );
    if (!historical) {
      return yield* itemIntegrity(
        "Retained selector lost its authenticated historical placement."
      );
    }
    const verified = yield* verifyStoredTryoutPlacement(
      historical,
      placement
    ).pipe(
      Effect.mapError(() =>
        itemIntegrity(
          "Retained selector differs from its attempt-owned placement."
        )
      )
    );
    if (!matchesSelector(verified, selector)) {
      return yield* itemIntegrity(
        "Retained selector differs from its attempt-owned placement."
      );
    }
    return { placement: verified, selector } satisfies RetainedSelection;
  }
);

/** Loads one exact old artifact only after placement membership is proven. */
const resolveItem = Effect.fn("contentRelease.resolveRetainedRuntimeItem")(
  function* (ctx: QueryCtx, selection: RetainedSelection) {
    const artifact = yield* Effect.promise(() =>
      ctx.db
        .query("contentArtifacts")
        .withIndex("by_artifactHash", (index) =>
          index.eq("artifactHash", selection.selector.artifactHash)
        )
        .unique()
    );
    if (!artifact) {
      return yield* itemIntegrity(
        "Retained try-out body lost its immutable artifact bytes."
      );
    }
    const body =
      selection.selector.delivery === "authenticated" ? "question" : "answer";
    return {
      artifactJson: artifact.artifactJson,
      delivery: selection.selector.delivery,
      sourcePath: `${selection.placement.questionSourcePath}/${body}.${selection.selector.artifactLocale}.mdx`,
    };
  }
);

/** Resolves ordered attempt-owned bodies through authenticated old rows. */
export const loadRetainedRuntimeItems = Effect.fn(
  "contentRelease.loadRetainedRuntimeItems"
)(function* (
  ctx: QueryCtx,
  request: StoredProtectedRuntimeRequest,
  attempt: Doc<"tryoutAttempts">
) {
  const placements = yield* loadAttemptPlacements(ctx, attempt);
  const selections = yield* Effect.forEach(
    request.selectors,
    (selector) => resolveSelection(ctx, request, selector, placements),
    { concurrency: 16 }
  );
  if (selections.some((selection) => selection === null)) {
    return null;
  }
  const found = selections.filter(
    (selection): selection is RetainedSelection => selection !== null
  );
  return yield* Effect.forEach(found, (selection) =>
    resolveItem(ctx, selection)
  );
});
