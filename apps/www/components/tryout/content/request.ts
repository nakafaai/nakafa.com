import { ContentRuntimeVerificationError } from "@repo/backend/client/content/errors";
import { Effect } from "effect";
import type { TryoutSelector } from "@/components/tryout/content/model";

type RuntimeIdentity = Pick<
  TryoutSelector,
  "appLocale" | "snapshotId" | "snapshotReleaseId"
>;

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

/** Builds one coherent request for the permanent protected endpoint. */
export const makeTryoutRuntimeRequest = Effect.fn(
  "NakafaContent.makeTryoutRequest"
)(function* (selectors: readonly TryoutSelector[]) {
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

/** Creates one consistent signed runtime verification failure. */
function runtimeIntegrity(cause: string) {
  return new ContentRuntimeVerificationError({ cause });
}
