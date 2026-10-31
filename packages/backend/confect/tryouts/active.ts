import { findActiveAssessmentSnapshot } from "@repo/backend/confect/contentRelease/assessment/active";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { Effect, Option } from "effect";

/**
 * Finds the active release's assessment snapshot, which a start freezes and the catalog pages read,
 * with the app locales it is written in; none before any release activates one. It is the engine's
 * one read of the active release, and ingress owns the reader it calls.
 */
export const findActiveAssessment = Effect.fn("tryouts.findActiveAssessment")(
  function* () {
    return Option.map(
      yield* findActiveAssessmentSnapshot(),
      ({ activeAppLocales, releaseId, snapshotId }) => ({
        activeAppLocales,
        releaseId,
        snapshotId,
      })
    );
  }
);

/** Loads the active release's assessment snapshot, failing when no release has activated one. */
export const loadActiveAssessment = Effect.fn("tryouts.loadActiveAssessment")(
  function* () {
    const active = yield* findActiveAssessment();
    if (Option.isNone(active)) {
      return yield* releaseFail(
        "CONTENT_RELEASE_MISSING",
        "No release has activated an assessment snapshot."
      );
    }
    return active.value;
  }
);
