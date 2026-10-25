import { hasDistinctIds } from "@nakafa/aksara-contracts/assessment/identity";
import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import type {
  ExamQuestionsDoc,
  ExamSittingsDoc,
} from "@repo/backend/confect/_generated/docs";
import type { Version } from "@repo/backend/confect/assessment/gate/rules";
import { questionAnswers } from "@repo/backend/confect/exams/question";
import {
  ResponseDoesNotFit,
  StaleAnswer,
} from "@repo/backend/confect/exams/sittings/errors";
import { sittingGate } from "@repo/backend/confect/exams/sittings/gate";
import { toSittingError } from "@repo/backend/confect/exams/sittings/refusal";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { Array as Arr, Effect, Option } from "effect";

/** The one kind of interaction that a student's response answers. */
type Choice = Extract<Interaction, { readonly kind: "choice" }>;

/**
 * The choice of a question that holds exactly one interaction, and that interaction is a
 * choice. A question of another shape takes no response, so none fits it.
 */
const oneChoice = (
  interactions: readonly Interaction[]
): Option.Option<Choice> =>
  interactions.length === 1
    ? Arr.findFirst(
        interactions,
        (interaction): interaction is Choice => interaction.kind === "choice"
      )
    : Option.none();

/**
 * Whether a response fits the choice: each option is one of its options, no option repeats,
 * and the count is within its minimum and maximum (ADR 0013).
 */
const fitsChoice = (choice: Choice, response: readonly string[]) =>
  hasDistinctIds(response) &&
  response.length >= choice.minChoices &&
  response.length <= choice.maxChoices &&
  Arr.every(response, (id) =>
    Arr.some(choice.options, (option) => option.id === id)
  );

/**
 * The response as the question takes it: the caller's response when it fits the question's
 * one choice, and `ResponseDoesNotFit` for any other. A question of another shape takes no
 * response, so no response fits it.
 */
const fittingResponse = Effect.fn("exams.sittings.answer.fit")(function* (
  question: ExamQuestionsDoc,
  response: readonly string[]
) {
  const interactions = yield* questionAnswers(question.answers);
  const fits = Option.exists(oneChoice(interactions), (choice) =>
    fitsChoice(choice, response)
  );
  if (!fits) {
    return yield* new ResponseDoesNotFit();
  }
  return response;
});

/**
 * Saves the caller's response to one question of its sitting, replacing the response that
 * was saved before. The gate admits the write to the device that owns an open attempt, and
 * refuses a version that is not newer than the saved one. The question must belong to the
 * sitting's exam, and a student's answer is not journaled, because the answers are the
 * record of the student (ADR 0013, ADR 0016).
 */
export const answer = Effect.fn("exams.sittings.answer")(function* (args: {
  deviceId: string;
  questionId: ExamQuestionsDoc["_id"];
  response: readonly string[];
  sittingId: ExamSittingsDoc["_id"];
  version: Version;
}) {
  const member = yield* Member;
  yield* sittingGate
    .answer({
      device: Option.some(args.deviceId),
      owner: member.person._id,
      placement: {
        person: member.person,
        questionId: args.questionId,
        sittingId: args.sittingId,
        tenantId: member.tenant._id,
      },
      value: (live) => fittingResponse(live.question, args.response),
      version: args.version,
    })
    .pipe(
      Effect.catchTags({
        AttemptRefused: (refusal) => Effect.fail(toSittingError(refusal)),
        Stale: () => Effect.fail(new StaleAnswer()),
      })
    );
  return null;
});
