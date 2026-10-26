import { hasDistinctIds } from "@nakafa/aksara-contracts/assessment/identity";
import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import type {
  ExamQuestionsDoc,
  ExamSittingsDoc,
} from "@repo/backend/confect/_generated/docs";
import type { Version } from "@repo/backend/confect/assessment/gate/rules";
import { pairsFit } from "@repo/backend/confect/exams/key";
import { questionAnswers } from "@repo/backend/confect/exams/question";
import {
  ResponseDoesNotFit,
  StaleAnswer,
} from "@repo/backend/confect/exams/sittings/errors";
import { sittingGate } from "@repo/backend/confect/exams/sittings/gate";
import {
  type ExamResponse,
  isPairsResponse,
  isTextResponse,
  TEXT_RESPONSE_MAX,
} from "@repo/backend/confect/exams/sittings/response";
import { toSittingError } from "@repo/backend/confect/exams/sittings/refusal";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { Array as Arr, Effect, Match, Option } from "effect";

/** A choice, whose response is the options the student chose. */
type Choice = Extract<Interaction, { readonly kind: "choice" }>;

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
 * Whether a response fits the one interaction of a question: a choice takes the options it holds
 * (`fitsChoice`), a text entry takes one line of typed text, an essay takes written text, blank text
 * included in both, which leaves the question unanswered, and a match takes pairs that pair each of its
 * statements and answers at most once (`pairsFit`), none or some of them included. A question of any other shape, or of
 * more than one interaction, takes no response.
 */
const fitsQuestion = (
  interactions: readonly Interaction[],
  response: ExamResponse
) => {
  if (interactions.length !== 1) {
    return false;
  }
  return Arr.some(interactions, (interaction) =>
    Match.value(interaction).pipe(
      Match.when({ kind: "choice" }, (choice) =>
        isTextResponse(response) ? false : fitsChoice(choice, response)
      ),
      Match.when(
        { kind: "textEntry" },
        () =>
          isTextResponse(response) &&
          response.text.length <= TEXT_RESPONSE_MAX
      ),
      Match.when({ kind: "extendedText" }, () => isTextResponse(response)),
      Match.when(
        { kind: "match" },
        (match) => isPairsResponse(response) && pairsFit(match, response.pairs)
      ),
      Match.orElse(() => false)
    )
  );
};

/**
 * The response as the question takes it: the caller's response when it fits the question's one
 * interaction (`fitsQuestion`), and `ResponseDoesNotFit` for any other.
 */
const fittingResponse = Effect.fn("exams.sittings.answer.fit")(function* (
  question: ExamQuestionsDoc,
  response: ExamResponse
) {
  const interactions = yield* questionAnswers(question.answers);
  if (!fitsQuestion(interactions, response)) {
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
  response: ExamResponse;
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
