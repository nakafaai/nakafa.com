import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  findActiveExplanationSnapshotId,
  readExplanation,
} from "@repo/backend/confect/tryouts/rows";
import type { readTryoutSectionContentAccess } from "@repo/backend/confect/tryouts/runtime/content";
import { isTryoutReviewPreviewQuestion } from "@repo/backend/confect/tryouts/runtime/content";
import type { PlacedQuestion } from "@repo/backend/confect/tryouts/runtime/question";
import { readPlacedQuestion } from "@repo/backend/confect/tryouts/runtime/question";
import type { TryoutQuestionBody } from "@repo/backend/confect/tryouts/runtime/spec";
import { TryoutQuestionBodyText } from "@repo/backend/confect/tryouts/runtime/spec";
import type { PlacedQuestionVersion } from "@repo/backend/confect/tryouts/runtime/version";
import { placeVersion } from "@repo/backend/confect/tryouts/runtime/version";
import { Array as Arr, Effect, Option, Schema } from "effect";

/** What a section's review opens: every answer, or the leading questions' only. */
type ReviewAccess = Pick<
  Effect.Success<ReturnType<typeof readTryoutSectionContentAccess>>,
  "answers" | "preview"
>;

/**
 * Reads the body of one frozen question in one language, a try-out's placement or a practice question
 * alike, as the JSON text a page decodes: the version's prompt, its interactions with that language's
 * labels, and the shared reading it was written against (`placeVersion`). A `reviewed` question also
 * carries its key's answer for each interaction and the version's explanation in `appLocale`.
 */
export const readQuestionBody = Effect.fn("tryouts.runtime.readQuestionBody")(
  function* (input: {
    readonly activeSnapshotId: Option.Option<string>;
    readonly appLocale: AppLocaleCode;
    readonly fallbackSnapshotId?: string | undefined;
    readonly question: PlacedQuestion;
    readonly reviewed: boolean;
    readonly version: PlacedQuestionVersion;
  }) {
    const { reviewed, version } = input;
    const explanation = reviewed
      ? yield* readExplanation({
          activeSnapshotId: input.activeSnapshotId,
          fallbackSnapshotId: input.fallbackSnapshotId,
          language: input.appLocale,
          versionHash: version.hash,
        })
      : Option.none();
    return yield* Schema.encodeEffect(TryoutQuestionBodyText)({
      ...(Option.isSome(explanation) ? { explanation: explanation.value } : {}),
      interactions: version.interactions,
      ...(reviewed
        ? { keys: Arr.map(input.question.interactions, ({ key }) => key) }
        : {}),
      prompt: version.prompt,
      ...(Option.isSome(version.stimulus)
        ? { stimulus: version.stimulus.value }
        : {}),
    } satisfies TryoutQuestionBody).pipe(
      // Every part was decoded by the contract, so it encodes.
      Effect.orDie
    );
  }
);

/**
 * Reads the bodies of a section's questions in their order, each in every language of its section
 * (`readQuestionBody`). In a review, a learner entitled to every answer (`answers`) receives each key's
 * answer and each version's explanation in `appLocale`, and anyone else (`preview`) only those of the
 * section's leading questions. Resolves the active snapshot once per query before reading explanations.
 */
export const readSectionBodies = Effect.fn("tryouts.runtime.readSectionBodies")(
  function* (input: {
    readonly access: ReviewAccess;
    readonly appLocale: AppLocaleCode;
    readonly attemptSnapshotId: string;
    readonly placements: readonly Docs["tryoutAttemptPlacements"][];
  }) {
    const activeSnapshotId =
      input.access.answers || input.access.preview
        ? yield* findActiveExplanationSnapshotId()
        : Option.none<string>();
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
            const body = yield* readQuestionBody({
              activeSnapshotId,
              appLocale: input.appLocale,
              fallbackSnapshotId: input.attemptSnapshotId,
              question,
              reviewed,
              version,
            });
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
