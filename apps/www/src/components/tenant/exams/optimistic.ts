import type { Ref } from "@confect/core";
import type {
  OptimisticLocalStore as LocalStore,
  OptimisticUpdate,
} from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import { HOME_DRAFT_LIMIT } from "@repo/backend/confect/exams/home/bounds";
import type { HomeDraft } from "@repo/backend/confect/exams/home/contract";
import { insertIndex, placeAt } from "@repo/backend/confect/exams/order";
import { asTemplate } from "@repo/backend/confect/exams/template";
import { Array as Arr, Option } from "effect";

/** One exam with its questions in order, as the editor reads it. */
export type ExamView = Ref.Returns<typeof exams.exams.open>;

/** One exam as the list shows it: its title, when it was created, how many questions it holds, and its scope. */
export type ListedExam = Ref.Returns<typeof exams.exams.list>["page"][number];

/** One question of an exam, as the editor reads it. */
export type Question = ExamView["questions"][number];

/** The ID of one question. */
export type QuestionId = Question["id"];

/** The arguments that read one exam. */
type ExamQuery = Ref.Args<typeof exams.exams.open>;

/** The exam with its title changed. */
export const renamedExam = (view: ExamView, title: string): ExamView => ({
  ...view,
  title,
});

/**
 * The exam with one question moved to an index of its order. The order is the one
 * the server keeps (`placeAt`), so the view matches the server's answer.
 */
export const movedQuestion = (
  view: ExamView,
  questionId: QuestionId,
  index: number
): ExamView => {
  const order = placeAt(
    Arr.map(view.questions, (question) => question.id),
    questionId,
    index
  );
  return {
    ...view,
    questions: Arr.flatMap(order, (id) =>
      Arr.filter(view.questions, (question) => question.id === id)
    ),
  };
};

/** The exam without one question. */
export const removedQuestion = (
  view: ExamView,
  questionId: QuestionId
): ExamView => ({
  ...view,
  questions: Arr.filter(
    view.questions,
    (question) => question.id !== questionId
  ),
});

/**
 * The exam with one question answered. The question takes the answers and the key
 * that were saved, and its revision rises by one, as the server raises it.
 */
export const answeredQuestion = (
  view: ExamView,
  questionId: QuestionId,
  answer: Pick<Question, "answers" | "key">
): ExamView => ({
  ...view,
  questions: Arr.map(view.questions, (question) =>
    question.id === questionId
      ? {
          ...question,
          answers: answer.answers,
          key: answer.key,
          revision: question.revision + 1,
        }
      : question
  ),
});

/** The query that reads the exam of a mutation, which every exam mutation names. */
const examQuery = (args: ExamQuery): ExamQuery => ({
  examId: args.examId,
  slug: args.slug,
});

/**
 * Applies a change to the exam the editor reads. A store that does not hold the exam
 * is left as it is, so the server's answer is the only one that can change it.
 */
const changeExam = (
  localStore: LocalStore.OptimisticLocalStore,
  query: ExamQuery,
  change: (view: ExamView) => ExamView
) => {
  const current = localStore.getQuery(exams.exams.open, query);
  if (Option.isSome(current)) {
    localStore.setQuery(
      exams.exams.open,
      query,
      Option.some(change(current.value))
    );
  }
};

/** Renames the exam in the store while the server saves its title. */
export const renameUpdate: OptimisticUpdate<typeof exams.exams.rename> = (
  localStore,
  args
) =>
  changeExam(localStore, examQuery(args), (view) =>
    renamedExam(view, args.title)
  );

/** Moves a question in the store while the server saves its order. */
export const moveUpdate: OptimisticUpdate<typeof exams.questions.move> = (
  localStore,
  args
) =>
  changeExam(localStore, examQuery(args), (view) =>
    movedQuestion(view, args.questionId, args.index)
  );

/** Takes a question out of the store while the server removes it. */
export const removeUpdate: OptimisticUpdate<typeof exams.questions.remove> = (
  localStore,
  args
) =>
  changeExam(localStore, examQuery(args), (view) =>
    removedQuestion(view, args.questionId)
  );

/**
 * The exam with one question in another template: its answers and key converted as the server converts
 * them, with the labels of the options the template fixes (`asTemplate`), and its revision one higher, as
 * the server raises it.
 */
const templatedQuestion = (
  view: ExamView,
  questionId: QuestionId,
  change: {
    readonly labels: readonly string[];
    readonly template: Question["template"];
  }
): ExamView => ({
  ...view,
  questions: Arr.map(view.questions, (question) =>
    question.id === questionId
      ? {
          ...question,
          ...asTemplate(
            change.template,
            question.answers,
            question.key,
            change.labels
          ),
          revision: question.revision + 1,
          template: change.template,
        }
      : question
  ),
});

/** Shows a question in its new template in the store while the server converts it. */
export const templateUpdate: OptimisticUpdate<
  typeof exams.questions.template
> = (localStore, args) =>
  changeExam(localStore, examQuery(args), (view) =>
    templatedQuestion(view, args.questionId, args)
  );

/** Shows a saved answer of a question in the store while the server saves it. */
export const answerUpdate: OptimisticUpdate<typeof exams.questions.answer> = (
  localStore,
  args
) =>
  changeExam(localStore, examQuery(args), (view) =>
    answeredQuestion(view, args.questionId, args)
  );

/**
 * A question that the server has not saved yet, with the answers, the key, the points, the template,
 * and the documents it shows at once. Its revision is zero, as the server starts every new question.
 */
export const placeholderQuestion = (
  input: Omit<Question, "revision">
): Question => ({ ...input, revision: 0 });

/**
 * The exam with one question's points changed. The server keeps the points it is given, so the
 * view shows the same number.
 */
export const pointedQuestion = (
  view: ExamView,
  questionId: QuestionId,
  points: number
): ExamView => ({
  ...view,
  questions: Arr.map(view.questions, (question) =>
    question.id === questionId ? { ...question, points } : question
  ),
});

/** Shows the points of a question in the store while the server saves them. */
export const pointsUpdate: OptimisticUpdate<typeof exams.questions.points> = (
  localStore,
  args
) =>
  changeExam(localStore, examQuery(args), (view) =>
    pointedQuestion(view, args.questionId, args.points)
  );

/** The exam with a question added at its end, as the server adds a new question. */
export const appendedQuestion = (
  view: ExamView,
  question: Question
): ExamView => ({
  ...view,
  questions: Arr.append(view.questions, question),
});

/**
 * The exam with a question inserted right after another one. A question that the exam
 * does not hold leaves it as it is, as the server refuses such a copy.
 */
export const insertedAfter = (
  view: ExamView,
  afterId: QuestionId,
  question: Question
): ExamView =>
  Option.match(
    insertIndex(
      Arr.map(view.questions, (item) => item.id),
      afterId
    ),
    {
      onNone: () => view,
      onSome: (index) => ({
        ...view,
        questions: [
          ...Arr.take(view.questions, index),
          question,
          ...Arr.drop(view.questions, index),
        ],
      }),
    }
  );

/**
 * Shows a new question while the server adds it: at the end of the exam, or right after the
 * question it follows, where the server puts it.
 */
export const addQuestionUpdate =
  (question: Question): OptimisticUpdate<typeof exams.questions.add> =>
  (localStore, args) =>
    changeExam(localStore, examQuery(args), (view) =>
      args.after === null
        ? appendedQuestion(view, question)
        : insertedAfter(view, args.after, question)
    );

/** Shows a copy right after its source while the server copies it. */
export const copyQuestionUpdate =
  (question: Question): OptimisticUpdate<typeof exams.questions.copy> =>
  (localStore, args) =>
    changeExam(localStore, examQuery(args), (view) =>
      insertedAfter(view, args.questionId, question)
    );

/**
 * Shows a new exam while the server saves it: at the top of the first page of each open list, with no question yet in
 * the scope it is created in, and at the top of the drafts of the school home when the home is open. A list past its
 * first page keeps its pages, as the server's answer shows.
 */
export const insertDraftExam =
  (draft: typeof HomeDraft.Type): OptimisticUpdate<typeof exams.exams.create> =>
  (localStore, args) => {
    for (const query of localStore.getAllQueries(exams.exams.list)) {
      if (
        Option.isSome(query.value) &&
        query.args.paginationOpts.cursor === null
      ) {
        localStore.setQuery(
          exams.exams.list,
          query.args,
          Option.some({
            ...query.value.value,
            page: [
              { ...draft, questionCount: 0, scope: args.scope },
              ...query.value.value.page,
            ],
          })
        );
      }
    }
    const home = localStore.getQuery(exams.exams.home, { slug: args.slug });
    if (Option.isSome(home)) {
      localStore.setQuery(
        exams.exams.home,
        { slug: args.slug },
        Option.some({
          ...home.value,
          drafts: Arr.take([draft, ...home.value.drafts], HOME_DRAFT_LIMIT),
        })
      );
    }
  };
