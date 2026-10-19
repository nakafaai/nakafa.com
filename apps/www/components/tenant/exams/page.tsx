"use client";

import { useMutation } from "@confect/react";
import { Alert02Icon } from "@hugeicons/core-free-icons";
import { useCallbackRef } from "@mantine/hooks";
import exams from "@repo/backend/confect/_generated/refs/exams";
import {
  CHOICE_OPTIONS_MAX,
  CHOICE_OPTIONS_MIN,
} from "@repo/backend/confect/exams/question";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Array as Arr, Effect, Function as Fn, Option } from "effect";
import { useTranslations } from "next-intl";
import {
  lazy,
  type RefObject,
  Suspense,
  useEffect,
  useRef,
  useState,
} from "react";
import { runExamAction, sentAction } from "@/components/tenant/exams/action";
import {
  choiceOf,
  keyWithoutOption,
  markedKey,
  markedOption,
  type OptionLabel,
  optionLetter,
  withOptionAdded,
  withOptionLabel,
  withOptionRemoved,
} from "@/components/tenant/exams/answer";
import { PageActions } from "@/components/tenant/exams/controls";
import { isLocked } from "@/components/tenant/exams/freeze";
import {
  answerUpdate,
  type Question,
} from "@/components/tenant/exams/optimistic";
import { OptionRow } from "@/components/tenant/exams/option";
import { isPlaceholderId } from "@/components/tenant/exams/placeholder";
import {
  PaperSketch,
  usePromptDocument,
} from "@/components/tenant/exams/preview";
import { useExam, useExamSelection } from "@/components/tenant/exams/provider";
import { PaperOptions, QuestionPaper } from "@/components/tenant/exams/sheet";
import { usePageWindow } from "@/components/tenant/exams/window";
import {
  makeQuestionWriter,
  type QuestionDraft,
  type QuestionWrite,
} from "@/components/tenant/exams/writer";

/**
 * The prompt loads when a page mounts its editors, never with the page. Until it loads, the page
 * keeps its paper on the screen, since the live paper of the page suspends until the prompt loads.
 */
const ExamPrompt = lazy(() =>
  import("@/components/tenant/exams/prompt").then((module) => ({
    default: module.ExamPrompt,
  }))
);

/** The props of one page of the canvas. */
interface ExamPageProps {
  /** The canvas that scrolls the pages, which decides how far a page is from the view. */
  readonly canvas: RefObject<HTMLElement | null>;
  /** The number of questions in the exam, which decides whether a page may be removed. */
  readonly count: number;
  /** The place of the question in the exam, from zero. */
  readonly index: number;
  /** The question the page shows. */
  readonly question: Question;
}

/**
 * One question as a page of the canvas: a row above the paper names the question and holds its
 * actions, and the paper below it is what the student reads. A page mounts its editors while it is
 * within a viewport of the canvas and unmounts them past three viewports. Until then, and while it
 * is far away, the paper shows the same document as drawn text, so the page keeps its shape. The
 * drawn paper stays until the prompt's editor loads. A page the server has not saved yet shows its
 * options only, and they take no change until it answers.
 */
export function ExamPage({ canvas, count, index, question }: ExamPageProps) {
  const t = useTranslations("Exams");
  const { exam } = useExam();
  const frozen = isLocked(exam);
  // Each page reads a boolean for its own choice, so a change of the choice renders only the two pages it moves between.
  const awaiting = useExamSelection((state) =>
    Arr.contains(state.pending, question.id)
  );
  const chosen = useExamSelection((state) => state.selected === question.id);
  const saved = !(awaiting || isPlaceholderId(question.prompt));
  const number = index + 1;
  const page = useRef<HTMLElement>(null);
  const { mounted, reached } = usePageWindow(page, canvas);
  // A question the teacher just added or copied, which the server has not saved yet, comes into view.
  useEffect(() => {
    if (chosen && !saved) {
      page.current?.scrollIntoView({ block: "nearest" });
    }
  }, [chosen, saved]);

  const live = mounted && saved;
  const doc = usePromptDocument({
    open: chosen,
    question,
    read: reached && !live,
    saved,
  });
  const paper = <PaperSketch doc={doc} question={question} withControls />;

  return (
    <section
      aria-label={t("question", { number })}
      className="flex min-w-0 flex-col gap-2"
      data-page=""
      id={`question-${question.id}`}
      ref={page}
    >
      <div className="flex min-h-9 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="font-medium text-sm">{t("question", { number })}</h2>
          {question.key === null ? (
            <span className="flex items-center gap-1 text-muted-foreground text-xs">
              <HugeIcons
                aria-hidden="true"
                className="size-3.5 text-primary"
                icon={Alert02Icon}
              />
              {t("page-no-key")}
            </span>
          ) : null}
        </div>
        {saved && !frozen ? (
          <PageActions count={count} index={index} question={question} />
        ) : null}
      </div>
      {live ? (
        <Suspense fallback={paper}>
          <LivePaper number={number} question={question} />
        </Suspense>
      ) : (
        paper
      )}
    </section>
  );
}

/** The paper of a page with its editors: the prompt as an editor, then each option with its controls. */
function LivePaper({
  number,
  question,
}: {
  number: number;
  question: Question;
}) {
  const t = useTranslations("Exams");
  const { exam, slug } = useExam();
  const frozen = isLocked(exam);
  const answer = useMutation(exams.questions.answer).withOptimisticUpdate(
    answerUpdate
  );
  const choice = Option.getOrNull(choiceOf(question.answers));
  // The writer sends through the latest mutation. It keeps the saves of this question in order, and each
  // save sends the revision that the save before it returned, so no save is refused for a revision the
  // render held before that save landed.
  const send = useCallbackRef((draft: QuestionDraft) =>
    sentAction(() =>
      answer({
        answers: draft.answers,
        examId: exam.id,
        key: draft.key,
        questionId: question.id,
        revision: draft.revision,
        slug,
      })
    ).pipe(
      Effect.map((view) => ({
        answers: view.answers,
        key: view.key,
        revision: view.revision,
      }))
    )
  );
  const [writer] = useState(() => Effect.runSync(makeQuestionWriter(send)));

  /**
   * Saves the answers and the key that `edit` makes of this question. The edit takes the draft the save
   * before it left, or the question as the teacher sees it when no save is in flight, so the edits of one
   * question land one after another and none writes over another.
   */
  const saveAnswers = (edit: (draft: QuestionDraft) => QuestionWrite) => {
    runExamAction(
      writer.save(
        {
          answers: question.answers,
          key: question.key,
          revision: question.revision,
        },
        edit
      ),
      { onFailure: Fn.constVoid, onSuccess: Fn.constVoid }
    );
  };

  return (
    <>
      <QuestionPaper>
        <ExamPrompt
          key={`${question.prompt}-${frozen}`}
          number={number}
          prompt={question.prompt}
        />
        {choice === null ? null : (
          <PaperOptions>
            {Arr.map(choice.options, (option, index) => (
              <OptionRow
                key={option.id}
                label={option.label}
                letter={optionLetter(index)}
                locked={frozen}
                marked={markedOption(question.key) === option.id}
                number={number}
                onMark={() => {
                  if (markedOption(question.key) !== option.id) {
                    saveAnswers((draft) => ({
                      answers: draft.answers,
                      key: markedKey(draft.answers, option.id),
                    }));
                  }
                }}
                onRemove={
                  choice.options.length > CHOICE_OPTIONS_MIN
                    ? () =>
                        saveAnswers((draft) => ({
                          answers: withOptionRemoved(draft.answers, option.id),
                          key: keyWithoutOption(draft.key, option.id),
                        }))
                    : null
                }
                onSave={(label: OptionLabel) =>
                  saveAnswers((draft) => ({
                    answers: withOptionLabel(draft.answers, option.id, label),
                    key: draft.key,
                  }))
                }
              />
            ))}
          </PaperOptions>
        )}
      </QuestionPaper>
      {choice !== null &&
      choice.options.length < CHOICE_OPTIONS_MAX &&
      !frozen ? (
        <div>
          <Button
            onClick={() =>
              saveAnswers((draft) => ({
                answers: withOptionAdded(draft.answers),
                key: draft.key,
              }))
            }
            size="sm"
            type="button"
            variant="outline"
          >
            {t("option-add")}
          </Button>
        </div>
      ) : null}
    </>
  );
}
