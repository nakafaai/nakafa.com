import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { hashText } from "@repo/backend/convex/contentRelease/digest";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  FINALIZATION_PLACEMENT_SET_DOMAIN,
  type FinalizationAttemptSpec,
} from "@repo/backend/convex/contentRelease/finalize/spec";
import { Effect } from "effect";

type AttemptPlacement = Doc<"tryoutAttemptPlacements">;

/** Projects every immutable domain field from one attempt-owned placement. */
function placementFacts(placement: AttemptPlacement) {
  return {
    answerArtifactHash: placement.answerArtifactHash,
    answerContentKey: placement.answerContentKey,
    choiceSnapshots: placement.choiceSnapshots,
    contentHash: placement.contentHash,
    placementIdentity: placement.placementIdentity,
    placementRowHash: placement.placementRowHash,
    questionArtifactHash: placement.questionArtifactHash,
    questionContentKey: placement.questionContentKey,
    questionOrder: placement.questionOrder,
    rendererDomain: placement.rendererDomain,
    sectionIdentity: placement.sectionIdentity,
    sectionKey: placement.sectionKey,
    sourcePath: placement.sourcePath,
    sourceRevision: placement.sourceRevision,
  };
}

/** Orders a placement set by its complete section-local position. */
function comparePlacement(left: AttemptPlacement, right: AttemptPlacement) {
  return (
    left.sectionKey.localeCompare(right.sectionKey) ||
    left.questionOrder - right.questionOrder
  );
}

/** Hashes the complete ordered placement facts under the terminal domain. */
export const hashFinalizationPlacements = Effect.fn(
  "contentRelease.finalize.hashPlacements"
)(function* (placements: readonly AttemptPlacement[]) {
  const facts = [...placements].sort(comparePlacement).map(placementFacts);
  return yield* hashText(
    "terminal try-out placement set",
    `${FINALIZATION_PLACEMENT_SET_DOMAIN}\n${JSON.stringify(facts)}`
  );
});

/** Proves exact placement membership and rejects duplicate local positions. */
export const verifyFinalizationPlacements = Effect.fn(
  "contentRelease.finalize.verifyPlacements"
)(function* (
  placements: readonly AttemptPlacement[],
  spec: FinalizationAttemptSpec
) {
  if (placements.length !== spec.totalQuestions) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Terminal try-out expansion found a changed placement count."
    );
  }
  const positions = new Set<string>();
  const identities = new Set<string>();
  for (const placement of placements) {
    const position = `${placement.sectionKey}\u0000${placement.questionOrder}`;
    if (
      positions.has(position) ||
      identities.has(placement.placementIdentity)
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Terminal try-out expansion found a duplicate placement identity."
      );
    }
    positions.add(position);
    identities.add(placement.placementIdentity);
  }
  const digest = yield* hashFinalizationPlacements(placements);
  if (digest !== spec.placementDigest) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Terminal try-out expansion found changed placement bytes."
    );
  }
  return placements.length;
});
