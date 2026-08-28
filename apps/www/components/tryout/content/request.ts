import { ContentRuntimeVerificationError } from "@repo/backend/client/content/errors";
import { Effect } from "effect";
import type {
  CurrentTryoutAnswerSelector,
  CurrentTryoutQuestionSelector,
  HistoryTryoutAnswerSelector,
  HistoryTryoutQuestionSelector,
  PredecessorTryoutAnswerSelector,
  PredecessorTryoutQuestionSelector,
  TryoutQuestionSelector,
} from "@/components/tryout/content/model";

type CurrentSelector =
  | CurrentTryoutAnswerSelector
  | CurrentTryoutQuestionSelector;
type HistorySelector =
  | HistoryTryoutAnswerSelector
  | HistoryTryoutQuestionSelector;
type PredecessorSelector =
  | PredecessorTryoutAnswerSelector
  | PredecessorTryoutQuestionSelector;
type RuntimeIdentity = Pick<
  CurrentTryoutQuestionSelector,
  "appLocale" | "snapshotId" | "snapshotReleaseId"
>;

/** Rejects historical selectors at the public featured-question boundary. */
export const requireLiveTryoutQuestion = Effect.fn(
  "NakafaContent.requireLiveTryoutQuestion"
)(function* (question: TryoutQuestionSelector) {
  if ("artifactLocale" in question) {
    return yield* runtimeIntegrity(
      "The featured try-out question is not current content."
    );
  }
  return question;
});

/** Requires one batch to share app, snapshot, and release identity. */
const requireCoherentSelectors = Effect.fn(
  "NakafaContent.requireCoherentTryoutSelectors"
)(function* <Selector extends RuntimeIdentity>(selectors: readonly Selector[]) {
  const first = selectors[0];
  if (!first) {
    return yield* runtimeIntegrity("Protected content batch is empty.");
  }
  const coherent = selectors.every(
    (selector) =>
      selector.appLocale === first.appLocale &&
      selector.snapshotId === first.snapshotId &&
      selector.snapshotReleaseId === first.snapshotReleaseId
  );
  if (!coherent) {
    return yield* runtimeIntegrity(
      "Protected content batch spans multiple snapshots."
    );
  }
  return first;
});

/** Builds one coherent request for the unversioned current endpoint. */
export const makeCurrentTryoutRuntimeRequest = Effect.fn(
  "NakafaContent.makeCurrentTryoutRequest"
)(function* (selectors: readonly CurrentSelector[]) {
  const first = yield* requireCoherentSelectors(selectors);
  if (selectors.some(({ bundleHash }) => bundleHash !== first.bundleHash)) {
    return yield* runtimeIntegrity(
      "Protected content batch spans multiple permanent bundles."
    );
  }
  return {
    bundleHash: first.bundleHash,
    selectors: selectors.map(({ artifactHash, contentKey, delivery }) => ({
      artifactHash,
      contentKey,
      delivery,
    })),
    snapshotId: first.snapshotId,
  };
});

/** Builds one coherent request for the deployed predecessor endpoint. */
export const makePredecessorTryoutRuntimeRequest = Effect.fn(
  "NakafaContent.makePredecessorTryoutRequest"
)(function* (selectors: readonly PredecessorSelector[]) {
  const first = yield* requireCoherentSelectors(selectors);
  return {
    appLocale: first.appLocale,
    selectors: selectors.map(({ artifactHash, contentKey, delivery }) => ({
      artifactHash,
      contentKey,
      delivery,
    })),
    snapshotId: first.snapshotId,
    snapshotReleaseId: first.snapshotReleaseId,
  };
});

/** Builds one exact attempt-bound request for the history endpoint. */
export const makeHistoryTryoutRuntimeRequest = Effect.fn(
  "NakafaContent.makeHistoryTryoutRequest"
)(function* (attemptId: string, selectors: readonly HistorySelector[]) {
  const first = yield* requireCoherentSelectors(selectors);
  return {
    appLocale: first.appLocale,
    attemptId,
    selectors: selectors.map(
      ({ artifactHash, artifactLocale, contentKey, delivery }) => ({
        artifactHash,
        artifactLocale,
        contentKey,
        delivery,
      })
    ),
    snapshotId: first.snapshotId,
    snapshotReleaseId: first.snapshotReleaseId,
  };
});

/** Creates one consistent signed runtime verification failure. */
function runtimeIntegrity(cause: string) {
  return new ContentRuntimeVerificationError({ cause });
}
