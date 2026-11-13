import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  readExplanation,
  readItemVersion,
  readStimulus,
} from "@repo/backend/confect/tryouts/rows";
import {
  isTryoutReviewPreviewQuestion,
  type readTryoutSectionContentAccess,
} from "@repo/backend/confect/tryouts/runtime/content";
import { readPlacedQuestion } from "@repo/backend/confect/tryouts/runtime/question";
import {
  type TryoutQuestionBody,
  TryoutQuestionBodyText,
} from "@repo/backend/confect/tryouts/runtime/spec";
import { Effect, Option, Schema } from "effect";

/** What a section's review opens: every answer, or the leading questions' only. */
type ReviewAccess = Pick<
  Effect.Success<ReturnType<typeof readTryoutSectionContentAccess>>,
  "answers" | "preview"
>;

/**
 * Reads the body of one frozen question, a try-out's placement or a practice question alike, from the item
 * version it froze, as the JSON text a page decodes: its prompt and interaction, and the shared reading a
 * version was written against. A `reviewed` question also carries its key's answer and its explanation in
 * `appLocale`.
 */
export const readQuestionBody = Effect.fn("tryouts.runtime.readQuestionBody")(
  function* (input: {
    readonly appLocale: AppLocaleCode;
    readonly reviewed: boolean;
    readonly row: Pick<
      Docs["tryoutAttemptPlacements"],
      "interactionJson" | "keyJson" | "rule" | "versionHash"
    >;
  }) {
    const { reviewed, row } = input;
    const [version, question] = yield* Effect.all([
      readItemVersion(row.versionHash),
      readPlacedQuestion(row),
    ]);
    const stimulus =
      version.stimulus === undefined
        ? Option.none()
        : Option.some((yield* readStimulus(version.stimulus.hash)).document);
    const explanation = reviewed
      ? yield* readExplanation(row.versionHash, input.appLocale)
      : Option.none();
    return yield* Schema.encodeEffect(TryoutQuestionBodyText)({
      ...(Option.isSome(explanation) ? { explanation: explanation.value } : {}),
      interaction: question.interaction,
      ...(reviewed ? { key: question.key } : {}),
      prompt: version.prompt,
      ...(Option.isSome(stimulus) ? { stimulus: stimulus.value } : {}),
    } satisfies TryoutQuestionBody).pipe(
      // Every part was decoded by the contract, so it encodes.
      Effect.orDie
    );
  }
);

/**
 * Reads the bodies of a section's questions from the item versions its placements froze, in their
 * order (`readQuestionBody`). In a review, a learner entitled to every answer (`answers`) receives each
 * key's answer and explanation, and anyone else (`preview`) only those of the section's leading questions.
 */
export const readSectionBodies = Effect.fn("tryouts.runtime.readSectionBodies")(
  function* (input: {
    readonly access: ReviewAccess;
    readonly appLocale: AppLocaleCode;
    readonly placements: readonly Docs["tryoutAttemptPlacements"][];
  }) {
    return yield* Effect.forEach(input.placements, (placement) =>
      Effect.map(
        readQuestionBody({
          appLocale: input.appLocale,
          reviewed:
            input.access.answers ||
            (input.access.preview &&
              isTryoutReviewPreviewQuestion(placement.questionOrder)),
          row: placement,
        }),
        (body) => ({
          body,
          placementId: placement._id,
          versionHash: placement.versionHash,
        })
      )
    );
  }
);
