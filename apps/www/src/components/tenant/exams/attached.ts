import type { Ref } from "@confect/core";
import type { OptimisticUpdate } from "@confect/react";
import type exams from "@repo/backend/confect/_generated/refs/exams";
import { Array as Arr, Option } from "effect";
import {
  changeExam,
  type ExamView,
  examQuery,
  type Question,
  type QuestionId,
} from "@/components/tenant/exams/optimistic";

/**
 * The readings a question may share: each reading another question of the exam holds, once, by the first
 * question that holds it, with the number that names that question.
 */
export const sharedReadings = (
  questions: readonly Question[],
  questionId: QuestionId
) => {
  const held = Arr.flatMap(questions, (question, index) =>
    question.reading === null || question.id === questionId
      ? []
      : [
          {
            number: index + 1,
            reading: question.reading,
            source: question.id,
          },
        ]
  );
  return Arr.dedupeWith(
    held,
    (first, second) => first.reading === second.reading
  );
};

/**
 * The exam with one question's reading changed as the server changes it: none, or the reading of another
 * question. A new reading waits for the document the server makes, so the question stays as it is until then.
 */
export const readQuestionWith = (
  view: ExamView,
  questionId: QuestionId,
  source: Ref.Args<typeof exams.questions.reading>["source"]
): ExamView => {
  if (source === "new") {
    return view;
  }
  const reading =
    source === "none"
      ? null
      : Option.match(
          Arr.findFirst(view.questions, (question) => question.id === source),
          { onNone: () => null, onSome: (question) => question.reading }
        );
  return {
    ...view,
    questions: Arr.map(view.questions, (question) =>
      question.id === questionId ? { ...question, reading } : question
    ),
  };
};

/** Shows the reading of a question in the store while the server saves it. */
export const readingUpdate: OptimisticUpdate<typeof exams.questions.reading> = (
  localStore,
  args
) =>
  changeExam(localStore, examQuery(args), (view) =>
    readQuestionWith(view, args.questionId, args.source)
  );

/** The exam with one question's media changed. The server keeps what it is given. */
export const mediaQuestion = (
  view: ExamView,
  questionId: QuestionId,
  media: Question["media"]
): ExamView => ({
  ...view,
  questions: Arr.map(view.questions, (question) =>
    question.id === questionId ? { ...question, media } : question
  ),
});

/** Shows the media of a question in the store while the server saves it. */
export const mediaUpdate: OptimisticUpdate<typeof exams.questions.media> = (
  localStore,
  args
) =>
  changeExam(localStore, examQuery(args), (view) =>
    mediaQuestion(view, args.questionId, args.media)
  );
