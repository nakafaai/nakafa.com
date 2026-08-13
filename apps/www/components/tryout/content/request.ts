import { ContentRuntimeVerificationError } from "@repo/backend/client/content/errors";
import { Effect } from "effect";
import type {
  CurrentTryoutAnswerSelector,
  CurrentTryoutQuestionSelector,
  HistoryTryoutAnswerSelector,
  HistoryTryoutQuestionSelector,
} from "@/components/tryout/content/model";

type CurrentSelector =
  | CurrentTryoutAnswerSelector
  | CurrentTryoutQuestionSelector;
type HistorySelector =
  | HistoryTryoutAnswerSelector
  | HistoryTryoutQuestionSelector;

/** Requires one current batch to share locale, snapshot, and release identity. */
const requireCoherentCurrentSelectors = Effect.fn(
  "NakafaContent.requireCoherentCurrentTryoutSelectors"
)(function* (selectors: readonly CurrentSelector[]) {
  const first = selectors[0];
  if (!first) {
    return yield* runtimeIntegrity("Protected content batch is empty.");
  }
  const coherent = selectors.every(
    (selector) =>
      selector.locale === first.locale &&
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

/** Requires one historical batch to share app, snapshot, and release identity. */
const requireCoherentHistorySelectors = Effect.fn(
  "NakafaContent.requireCoherentHistoryTryoutSelectors"
)(function* (selectors: readonly HistorySelector[]) {
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

/** Builds one coherent request for the canonical Aksara 0.11 endpoint. */
export const makeCurrentTryoutRuntimeRequest = Effect.fn(
  "NakafaContent.makeCurrentTryoutRequest"
)(function* (selectors: readonly CurrentSelector[]) {
  const first = yield* requireCoherentCurrentSelectors(selectors);
  return {
    locale: first.locale,
    selectors: selectors.map(({ artifactHash, contentKey, delivery }) => ({
      artifactHash,
      contentKey,
      delivery,
    })),
    snapshotId: first.snapshotId,
    snapshotReleaseId: first.snapshotReleaseId,
  };
});

/** Builds one exact attempt-bound request for the isolated history endpoint. */
export const makeHistoryTryoutRuntimeRequest = Effect.fn(
  "NakafaContent.makeHistoryTryoutRequest"
)(function* (attemptId: string, selectors: readonly HistorySelector[]) {
  const first = yield* requireCoherentHistorySelectors(selectors);
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
