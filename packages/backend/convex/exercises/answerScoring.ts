import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { ConvexError } from "convex/values";
import { getManyFrom } from "convex-helpers/server/relationships";

type ExerciseDbReader = QueryCtx["db"];
type ExerciseAttemptAnswerContext = Pick<
  Doc<"exerciseAttempts">,
  "exerciseNumber" | "scope" | "slug"
>;
type CanonicalExerciseAnswer = Pick<
  Doc<"exerciseAnswers">,
  "isCorrect" | "questionId" | "selectedOptionId" | "textAnswer"
>;

/**
 * Load and validate that a question belongs to the current exercise attempt.
 */
async function getQuestionForAttempt(
  db: ExerciseDbReader,
  {
    attempt,
    exerciseNumber,
    questionId,
  }: {
    attempt: ExerciseAttemptAnswerContext;
    exerciseNumber: Doc<"exerciseAnswers">["exerciseNumber"];
    questionId: NonNullable<Doc<"exerciseAnswers">["questionId"]>;
  }
) {
  const question = await db.get("exerciseQuestions", questionId);

  if (!question) {
    throw new ConvexError({
      code: "QUESTION_NOT_FOUND",
      message: "Question not found.",
    });
  }

  const set = await db.get("exerciseSets", question.setId);

  if (!set || set.slug !== attempt.slug) {
    throw new ConvexError({
      code: "INVALID_QUESTION",
      message: "Question does not belong to this attempt.",
    });
  }

  if (question.number !== exerciseNumber) {
    throw new ConvexError({
      code: "INVALID_ARGUMENT",
      message: "exerciseNumber does not match the provided question.",
    });
  }

  if (attempt.scope === "single" && attempt.exerciseNumber !== exerciseNumber) {
    throw new ConvexError({
      code: "INVALID_ARGUMENT",
      message: "exerciseNumber does not match this single-scope attempt.",
    });
  }

  return question;
}

/**
 * Resolve the selected choice for a question using the canonical option key.
 */
async function getSelectedChoice(
  db: ExerciseDbReader,
  {
    questionId,
    selectedOptionId,
  }: {
    questionId: NonNullable<CanonicalExerciseAnswer["questionId"]>;
    selectedOptionId: NonNullable<CanonicalExerciseAnswer["selectedOptionId"]>;
  }
) {
  const choices = await getManyFrom(
    db,
    "exerciseChoices",
    "by_questionId_and_locale",
    questionId,
    "questionId"
  );

  const selectedChoice = choices.find(
    (choice) => choice.optionKey === selectedOptionId
  );

  if (!selectedChoice) {
    throw new ConvexError({
      code: "INVALID_ARGUMENT",
      message: "selectedOptionId does not belong to the provided question.",
    });
  }

  return selectedChoice;
}

/**
 * Canonicalize and score one submitted answer on the server.
 *
 * The backend derives `isCorrect` from the stored exercise choice instead of
 * trusting client-provided correctness flags.
 */
export async function scoreExerciseAnswer(
  db: ExerciseDbReader,
  {
    attempt,
    exerciseNumber,
    questionId,
    selectedOptionId,
  }: {
    attempt: ExerciseAttemptAnswerContext;
    exerciseNumber: Doc<"exerciseAnswers">["exerciseNumber"];
    questionId: NonNullable<Doc<"exerciseAnswers">["questionId"]>;
    selectedOptionId: NonNullable<Doc<"exerciseAnswers">["selectedOptionId"]>;
  }
): Promise<CanonicalExerciseAnswer> {
  await getQuestionForAttempt(db, {
    attempt,
    exerciseNumber,
    questionId,
  });

  const selectedChoice = await getSelectedChoice(db, {
    questionId,
    selectedOptionId,
  });

  return {
    questionId,
    selectedOptionId: selectedChoice.optionKey,
    textAnswer: selectedChoice.label,
    isCorrect: selectedChoice.isCorrect,
  };
}
