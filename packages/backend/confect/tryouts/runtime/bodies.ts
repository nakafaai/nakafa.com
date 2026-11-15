import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import { readExplanation } from "@repo/backend/confect/tryouts/rows";
import {
  isTryoutReviewPreviewQuestion,
  type readTryoutSectionContentAccess,
} from "@repo/backend/confect/tryouts/runtime/content";
import { readPlacedQuestion } from "@repo/backend/confect/tryouts/runtime/question";
import {
  type TryoutQuestionBody,
  TryoutQuestionBodyText,
} from "@repo/backend/confect/tryouts/runtime/spec";
import { placeVersion } from "@repo/backend/confect/tryouts/runtime/version";
import { Array as Arr, Effect, Option, Schema } from "effect";

/** What a section's review opens: every answer, or the leading questions' only. */
type ReviewAccess = Pick<
  Effect.Success<ReturnType<typeof readTryoutSectionContentAccess>>,
  "answers" | "preview"
>;

/**
 * Reads the bodies of a section's questions in their order, each in every language of its section
 * (`placeVersion`): its prompt, its interaction with that language's labels, and the shared reading
 * the version was written against. In a review, a learner entitled to every answer (`answers`) receives
 * each key's answer and each version's explanation in `appLocale`, and anyone else (`preview`) only
 * those of the section's leading questions.
 */
export const readSectionBodies = Effect.fn("tryouts.runtime.readSectionBodies")(
  function* (input: {
    readonly access: ReviewAccess;
    readonly appLocale: AppLocaleCode;
    readonly placements: readonly Docs["tryoutAttemptPlacements"][];
  }) {
    return yield* Effect.forEach(input.placements, (placement) =>
      Effect.gen(function* () {
        const question = yield* readPlacedQuestion(placement);
        const reviewed =
          input.access.answers ||
          (input.access.preview &&
            isTryoutReviewPreviewQuestion(placement.questionOrder));
        const [first, ...rest] = placement.versions;
        const readBody = Effect.fn("tryouts.runtime.readSectionBody")(
          function* (language: typeof first.language) {
            const version = yield* placeVersion(placement, language).pipe(
              // Each language read here is one of the placement's own.
              Effect.catchTag("TryoutRuntimeError", Effect.die)
            );
            const explanation = reviewed
              ? yield* readExplanation(version.hash, input.appLocale)
              : Option.none();
            const body = yield* Schema.encodeEffect(TryoutQuestionBodyText)({
              ...(Option.isSome(explanation)
                ? { explanation: explanation.value }
                : {}),
              interaction: version.interaction,
              ...(reviewed ? { key: question.key } : {}),
              prompt: version.prompt,
              ...(Option.isSome(version.stimulus)
                ? { stimulus: version.stimulus.value }
                : {}),
            } satisfies TryoutQuestionBody).pipe(
              // Every part was decoded by the contract, so it encodes.
              Effect.orDie
            );
            return { body, hash: version.hash, language };
          }
        );
        const head = yield* readBody(first.language);
        const tail = yield* Effect.forEach(rest, ({ language }) =>
          readBody(language)
        );
        return {
          placementId: placement._id,
          versions: Arr.prepend(tail, head),
        };
      })
    );
  }
);
