import { useMutation } from "@confect/react";
import { useCallbackRef } from "@mantine/hooks";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { QuestionTemplate } from "@repo/backend/confect/exams/question";
import { asTemplate } from "@repo/backend/confect/exams/template";
import { Array as Arr, Effect, Match } from "effect";
import { useRef, useState } from "react";
import { useTranslations } from "use-intl";
import { runExamAction, sentAction } from "@/components/tenant/exams/action";
import {
  markedKey,
  markedOptions,
  toggledKey,
} from "@/components/tenant/exams/answer";
import {
  answerUpdate,
  type Question,
  templateUpdate,
} from "@/components/tenant/exams/optimistic";
import { useExam } from "@/components/tenant/exams/provider";
import {
  makeQuestionWriter,
  type QuestionDraft,
  type QuestionWrite,
} from "@/components/tenant/exams/writer";

/**
 * The answers and the key of one question as its page shows them, with the saves that change them.
 * The page owns the writer, so the paper's option labels and the layer's key save in the same order,
 * and each save starts from the newest draft the writer knows. A change shows at once, and the page
 * shows the server's answer once every save of the question has settled.
 */
export function useQuestionEditing(question: Question) {
  const t = useTranslations("Exams");
  const { exam, slug } = useExam();
  const answer = useMutation(exams.questions.answer).withOptimisticUpdate(
    answerUpdate
  );
  const retemplate = useMutation(exams.questions.template).withOptimisticUpdate(
    templateUpdate
  );
  // The writer sends through the latest mutations. It keeps the saves of this question in order, and each
  // save starts from the newer of the draft its last answer returned and the question the render holds. A
  // save that changes the template sends the template's call, which converts the answers on the server.
  const send = useCallbackRef((draft: QuestionDraft, base: QuestionDraft) =>
    sentAction(() =>
      draft.template === base.template
        ? answer({
            answers: draft.answers,
            examId: exam.id,
            key: draft.key,
            questionId: question.id,
            revision: draft.revision,
            slug,
          })
        : retemplate({
            examId: exam.id,
            labels: labelsOf(draft.template),
            questionId: question.id,
            revision: draft.revision,
            slug,
            template: draft.template,
          })
    ).pipe(
      Effect.map((view) => ({
        answers: view.answers,
        key: view.key,
        revision: view.revision,
        template: view.template,
      }))
    )
  );
  // The question as the render holds it, which the writer reads each time a save starts.
  const rendered = useCallbackRef(
    (): QuestionDraft => ({
      answers: question.answers,
      key: question.key,
      revision: question.revision,
      template: question.template,
    })
  );
  // The writer lives with this page. A page that unmounts with a save in flight leaves that save to finish.
  const [writer] = useState(() =>
    Effect.runSync(makeQuestionWriter(send, Effect.sync(rendered)))
  );

  // A save shows its change at once, even while an earlier save of this question is still in flight. Each click
  // applies its edit to the draft the last click left on screen, and the render shows again once every save of
  // this question has settled.
  const [shown, setShown] = useState<QuestionDraft | null>(null);
  const shownRef = useRef<QuestionDraft | null>(null);
  const unsettled = useRef(0);
  const current = () => shownRef.current ?? rendered();

  /**
   * Saves the answers and the key that `edit` makes of this question, and shows them at once. The edit runs on
   * the draft the writer starts from, so the edits of one question land in the order they were made. `unstored`
   * runs when the server does not store the change, so the option that asked can take its text back.
   */
  const saveAnswers = (
    edit: (draft: QuestionDraft) => QuestionWrite,
    unstored?: () => void
  ) => {
    const base = current();
    const next: QuestionDraft = { ...edit(base), revision: base.revision };
    shownRef.current = next;
    setShown(next);
    unsettled.current += 1;
    const settle = () => {
      unsettled.current -= 1;
      if (unsettled.current === 0) {
        shownRef.current = null;
        setShown(null);
      }
    };
    runExamAction(writer.save(edit), {
      onFailure: () => {
        settle();
        unstored?.();
      },
      onSuccess: settle,
    });
  };

  /**
   * Marks one option of the key, which saves at once. A single-answer choice marks it alone, and marking
   * its marked option again saves nothing; a complex choice marks it beside the others, or unmarks it.
   */
  const markOption = (optionId: string) => {
    const draft = current();
    if (draft.template === "choices") {
      saveAnswers((base) => ({
        ...base,
        key: toggledKey(base.answers, base.key, optionId),
      }));
      return;
    }
    if (!Arr.contains(markedOptions(draft.key), optionId)) {
      saveAnswers((base) => ({
        ...base,
        key: markedKey(base.answers, optionId),
      }));
    }
  };

  /**
   * The labels of the options a template fixes, in the teacher's language: true and false, or the five
   * relations of a statement and its reason. A template whose options the teacher adds fixes none.
   */
  function labelsOf(template: QuestionTemplate): readonly string[] {
    return Match.value(template).pipe(
      Match.when("truefalse", () => [t("truefalse-true"), t("truefalse-false")]),
      Match.when("cause", () => [
        t("cause-related"),
        t("cause-unrelated"),
        t("cause-reason-false"),
        t("cause-statement-false"),
        t("cause-both-false"),
      ]),
      Match.orElse(() => [])
    );
  }

  /**
   * Gives the question another template, which saves at once: the answers take the template's bounds, or the
   * options it fixes with their labels, and the key stays only when it still fits (`asTemplate`), as the server
   * converts them.
   */
  const setTemplate = (template: QuestionTemplate) => {
    if (current().template !== template) {
      saveAnswers((base) => ({
        ...asTemplate(template, base.answers, base.key, labelsOf(template)),
        template,
      }));
    }
  };

  return {
    displayed: shown ?? question,
    markOption,
    saveAnswers,
    setTemplate,
  };
}

/** The answers and the key of one question, as its page edits them. */
export type QuestionEditing = ReturnType<typeof useQuestionEditing>;
