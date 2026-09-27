import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { verifyTryoutPlacement } from "@repo/backend/confect/contentRelease/tryout/verify";
import { selectorIntegrity } from "@repo/backend/confect/tryouts/runtime/ownership";
import { Effect } from "effect";

/** Resolves an explanation from the same immutable exam snapshot in the UI language. */
export const readAttemptAnswer = Effect.fn("tryouts.runtime.readAttemptAnswer")(
  function* (
    attempt: Docs["tryoutAttempts"],
    placement: Docs["tryoutAttemptPlacements"],
    appLocale: AppLocaleCode
  ) {
    if (appLocale === attempt.appLocale) {
      return {
        artifactHash: placement.answerArtifactHash,
        artifactLocale: appLocale,
        contentKey: placement.answerContentKey,
      };
    }
    const database = yield* DatabaseReader;
    const stored = yield* database
      .table("tryoutPlacements")
      .get(
        "by_snapshotId_and_appLocale_and_section_and_questionOrder",
        attempt.tryoutSnapshotId,
        appLocale,
        attempt.countryKey,
        attempt.examKey,
        attempt.trackKey,
        attempt.setKey,
        placement.sectionKey,
        placement.questionOrder
      )
      .pipe(
        Effect.mapError(() =>
          selectorIntegrity(
            "The exam snapshot has no explanation in this language."
          )
        )
      );
    const sibling = yield* verifyTryoutPlacement(
      stored,
      attempt.tryoutSnapshotId
    ).pipe(
      Effect.mapError(() =>
        selectorIntegrity(
          "The localized explanation lost its signed snapshot identity."
        )
      )
    );
    if (
      sibling.questionSourcePath !== placement.sourcePath ||
      sibling.sourceRevision !== placement.sourceRevision ||
      sibling.questionContentKey !== placement.questionContentKey ||
      sibling.answerContentKey !== placement.answerContentKey
    ) {
      return yield* selectorIntegrity(
        "The localized explanation belongs to a different exam question."
      );
    }
    return {
      artifactHash: sibling.answerArtifactHash,
      artifactLocale: sibling.answerArtifactLocale,
      contentKey: sibling.answerContentKey,
    };
  }
);
