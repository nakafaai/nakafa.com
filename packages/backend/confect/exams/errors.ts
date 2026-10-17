import { refusal } from "@repo/backend/confect/tenancy/errors";
import { Schema } from "effect";

/** An exam that holds as many questions as it can, `MAX_EXAM_QUESTIONS`, so a new question is refused. */
export class ExamFull extends Schema.TaggedError<ExamFull>()("ExamFull", {
  ...refusal("EXAM_FULL", "This exam holds as many questions as it can."),
}) {}

/** The last question of an exam. An exam keeps at least one question, so it is never empty. */
export class ExamEmpty extends Schema.TaggedError<ExamEmpty>()("ExamEmpty", {
  ...refusal("EXAM_EMPTY", "An exam keeps at least one question."),
}) {}

/**
 * Answers that are not the interactions of a question of this kind: a question takes
 * distinct single-answer choices, and any other interaction is refused. The reply names
 * no part of the answers.
 */
export class AnswersDoNotFit extends Schema.TaggedError<AnswersDoNotFit>()(
  "AnswersDoNotFit",
  {
    ...refusal(
      "ANSWERS_DO_NOT_FIT",
      "These answers do not fit a question of this kind."
    ),
  }
) {}

/**
 * A question whose edits since its last saved snapshot take more than one read of the
 * step log, so a copy cannot hold its whole current text yet. The editor saves the
 * snapshot as the snapshot rule allows, and the copy is tried again then. It writes nothing.
 */
export class QuestionHistoryLong extends Schema.TaggedError<QuestionHistoryLong>()(
  "QuestionHistoryLong",
  {
    ...refusal(
      "QUESTION_HISTORY_LONG",
      "This question has too many edits since it was last saved to copy now. Copy it again once it is saved."
    ),
  }
) {}

/**
 * An answer key that does not fit its question: an option it names does not exist,
 * a choice marks more correct options than it allows, or an interaction has no answer.
 * The reply names no option, so a learner's content never reaches an error message.
 */
export class KeyDoesNotFit extends Schema.TaggedError<KeyDoesNotFit>()(
  "KeyDoesNotFit",
  {
    ...refusal(
      "KEY_DOES_NOT_FIT",
      "The key does not match the options of this question."
    ),
  }
) {}

/**
 * An edit made on a revision that is no longer current. The edit writes nothing,
 * and the reply carries the current revision, so the editor keeps the server's value.
 */
export class RevisionStale extends Schema.TaggedError<RevisionStale>()(
  "RevisionStale",
  {
    current: Schema.Natural,
    ...refusal(
      "REVISION_STALE",
      "This question changed before your edit arrived."
    ),
  }
) {}
