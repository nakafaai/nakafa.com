import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { loadActiveAssessment } from "@repo/backend/confect/tryouts/active";
import { readPaper } from "@repo/backend/confect/tryouts/rows";
import { isTryoutReviewPreviewQuestion } from "@repo/backend/confect/tryouts/runtime/content";
import { placeVersion } from "@repo/backend/confect/tryouts/runtime/version";
import { readKeyedQuestion } from "@repo/backend/content/tryout/question";
import { readTryoutSetSelection } from "@repo/backend/content/tryout/selection";
import { Array as Arr, Effect, Option } from "effect";

/**
 * The worked samples of one set page, in question order: the leading questions of the set's first section
 * that every learner reads with their keys and explanations once a section ends (its free preview),
 * each in the page's language where one is written, or else in its first, and explained in the page's
 * language. The page shows them to every visitor, so readers and search engines
 * meet the set's real questions before they start it. A path that names no set, a section's included, has
 * none.
 */
export const readTryoutSetSamples = Effect.fn("tryouts.readSetSamples")(
  function* (input: {
    readonly appLocale: AppLocaleCode;
    readonly publicPath: string;
  }) {
    const { snapshotId } = yield* loadActiveAssessment();
    const selection = yield* readTryoutSetSelection({ ...input, snapshotId });
    if (selection?.row.kind !== "set") {
      return null;
    }
    const { paper } = yield* readPaper(snapshotId, selection.set.paper);
    const { placements } = Arr.headNonEmpty(paper.sections);
    return yield* Effect.forEach(
      Arr.filter(placements, (_, index) =>
        isTryoutReviewPreviewQuestion(index + 1)
      ),
      (placement) =>
        Effect.gen(function* () {
          const { language } = Option.getOrElse(
            Arr.findFirst(
              placement.versions,
              (version) => version.language === input.appLocale
            ),
            () => Arr.headNonEmpty(placement.versions)
          );
          const version = yield* placeVersion(placement, language).pipe(
            // The language was read from the place's own versions.
            Effect.catchTag("TryoutRuntimeError", Effect.die)
          );
          return yield* readKeyedQuestion(
            version,
            Option.some(input.appLocale)
          );
        })
    );
  }
);
