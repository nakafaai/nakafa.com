import { hasDistinctIds } from "@nakafa/aksara-contracts/assessment/identity";
import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import type {
  ExamQuestionsDoc,
  ExamSittingsDoc,
} from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { questionAnswers } from "@repo/backend/confect/exams/question";
import {
  boundAttempt,
  requireOpen,
} from "@repo/backend/confect/exams/sittings/attempt";
import {
  QuestionNotInExam,
  ResponseDoesNotFit,
} from "@repo/backend/confect/exams/sittings/errors";
import { Array as Arr, Clock, Effect, Option } from "effect";

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
 * Saves the caller's response to one question of its sitting, replacing the response that
 * was saved before. The attempt must be open on the bound device, and the question must
 * belong to the sitting's exam. A student's answer is not journaled, because the answers are
 * the record of the student (ADR 0016).
 */
export const answer = Effect.fn("exams.sittings.answer")(function* (args: {
  deviceId: string;
  questionId: ExamQuestionsDoc["_id"];
  response: readonly string[];
  sittingId: ExamSittingsDoc["_id"];
}) {
  const { attempt, sitting } = yield* boundAttempt(
    args.sittingId,
    args.deviceId
  );
  const now = yield* Clock.currentTimeMillis;
  yield* requireOpen(attempt, now);
  if (!Arr.contains(sitting.exam.questions, args.questionId)) {
    return yield* new QuestionNotInExam();
  }
  const reader = yield* DatabaseReader;
  const question = yield* reader
    .table("examQuestions")
    .get(args.questionId)
    .pipe(Effect.orDie);
  const interactions = yield* questionAnswers(question.answers);
  const fits = Option.exists(oneChoice(interactions), (choice) =>
    fitsChoice(choice, args.response)
  );
  if (!fits) {
    return yield* new ResponseDoesNotFit();
  }
  const saved = yield* reader
    .table("examAnswers")
    .index("by_attemptId_and_questionId", (query) =>
      query.eq("attempt", attempt._id).eq("question", args.questionId)
    )
    .first()
    .pipe(Effect.orDie);
  const writer = yield* DatabaseWriter;
  if (Option.isSome(saved)) {
    yield* writer
      .table("examAnswers")
      .patch(saved.value._id, { answeredAt: now, response: args.response })
      .pipe(Effect.orDie);
    return null;
  }
  yield* writer
    .table("examAnswers")
    .insert({
      answeredAt: now,
      attempt: attempt._id,
      question: args.questionId,
      response: args.response,
      tenantId: attempt.tenantId,
    })
    .pipe(Effect.orDie);
  return null;
});
