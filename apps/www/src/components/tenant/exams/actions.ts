import { useMutation } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import { newChoiceAnswers } from "@repo/backend/confect/exams/question";
import { Effect, Function as Fn } from "effect";
import { runExamAction, sentAction } from "@/components/tenant/exams/action";
import {
  addQuestionUpdate,
  copyQuestionUpdate,
  moveUpdate,
  placeholderQuestion,
  type Question,
  type QuestionId,
  removeUpdate,
} from "@/components/tenant/exams/optimistic";
import {
  placeholderPromptId,
  placeholderQuestionId,
} from "@/components/tenant/exams/placeholder";
import {
  useExam,
  useExamSelection,
  useExamSelectionStore,
} from "@/components/tenant/exams/provider";

/** Runs an action of a page from a browser event, without any handler of its own. */
const act = <A, E>(action: Effect.Effect<A, E>) =>
  runExamAction(action, {
    onFailure: Fn.constVoid,
    onSuccess: Fn.constVoid,
  });

/**
 * A question the server has not saved yet, with its own placeholder IDs. It takes the answers
 * and the key it starts with, and the prompt it shows at once.
 */
const placeholderDraft = (answers: Question["answers"], key: Question["key"]) =>
  placeholderQuestionId.pipe(
    Effect.flatMap((id) =>
      placeholderPromptId.pipe(
        Effect.map((prompt) =>
          placeholderQuestion({ answers, id, key, prompt })
        )
      )
    )
  );

/**
 * The actions of a page: a question added after another one or at the end, a copy right after a
 * question, a move to an index, and a removal. Each shows its change at once, and each rolls it
 * back when the server refuses it. A question the server has not saved yet is shown from its
 * placeholder, which the saved question replaces, and the chosen question moves with it. The
 * chosen question is read when an action runs, so no page renders again for a change of the choice.
 */
export function useQuestionActions() {
  const { exam, slug } = useExam();
  const selection = useExamSelectionStore();
  const select = useExamSelection((state) => state.select);
  const replace = useExamSelection((state) => state.replace);
  const startPending = useExamSelection((state) => state.startPending);
  const endPending = useExamSelection((state) => state.endPending);
  const add = useMutation(exams.questions.add);
  const copy = useMutation(exams.questions.copy);
  const move = useMutation(exams.questions.move).withOptimisticUpdate(
    moveUpdate
  );
  const remove = useMutation(exams.questions.remove).withOptimisticUpdate(
    removeUpdate
  );

  /** Shows a placeholder question, selects it, and swaps it for the saved question once the server answers. */
  const showDraft = <S extends { readonly id: QuestionId }, E>(
    draft: Question,
    save: (shown: Question) => Effect.Effect<S, E>
  ) => {
    const previous = selection.getState().selected;
    startPending(draft.id);
    select(draft.id);
    return save(draft).pipe(
      Effect.ensuring(Effect.sync(() => endPending(draft.id))),
      Effect.tap((saved) => Effect.sync(() => replace(draft.id, saved.id))),
      Effect.tapError(() => Effect.sync(() => replace(draft.id, previous)))
    );
  };

  /** Adds an empty question right after `after`, or at the end when `after` is none. */
  const addQuestion = (after: QuestionId | null) =>
    act(
      placeholderDraft(newChoiceAnswers(), null).pipe(
        Effect.flatMap((draft) =>
          showDraft(draft, (shown) =>
            sentAction(() =>
              add.withOptimisticUpdate(addQuestionUpdate(shown))({
                after,
                examId: exam.id,
                slug,
              })
            )
          )
        )
      )
    );

  /** Copies a question right after itself, and selects the copy once the server saves it. */
  const copyQuestion = (question: Question) =>
    act(
      placeholderDraft(question.answers, question.key).pipe(
        Effect.flatMap((draft) =>
          showDraft(draft, (shown) =>
            sentAction(() =>
              copy.withOptimisticUpdate(copyQuestionUpdate(shown))({
                examId: exam.id,
                questionId: question.id,
                slug,
              })
            )
          )
        )
      )
    );

  /** Moves a question to an index of the order, and shows the move at once. */
  const moveQuestion = (questionId: QuestionId, index: number) =>
    act(sentAction(() => move({ examId: exam.id, index, questionId, slug })));

  /** Removes a question, once the teacher confirmed it. */
  const removeQuestion = (questionId: QuestionId) =>
    act(sentAction(() => remove({ examId: exam.id, questionId, slug })));

  return { addQuestion, copyQuestion, moveQuestion, removeQuestion };
}
