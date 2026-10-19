"use client";

import { useMutation } from "@confect/react";
import {
  Add01Icon,
  Alert02Icon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  Copy01Icon,
  Delete02Icon,
  MoreHorizontalIcon,
} from "@hugeicons/core-free-icons";
import exams from "@repo/backend/confect/_generated/refs/exams";
import {
  CHOICE_OPTIONS_MAX,
  CHOICE_OPTIONS_MIN,
} from "@repo/backend/confect/exams/question";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import type { Node } from "@tiptap/pm/model";
import { Array as Arr, Function as Fn, Option } from "effect";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { type RefObject, useEffect, useRef, useState } from "react";
import { runExamAction, sentAction } from "@/components/tenant/exams/action";
import { useQuestionActions } from "@/components/tenant/exams/actions";
import {
  choiceOf,
  markedKey,
  markedOption,
  type OptionLabel,
  optionLetter,
  withOptionAdded,
  withOptionLabel,
  withOptionRemoved,
} from "@/components/tenant/exams/answer";
import { isLocked } from "@/components/tenant/exams/freeze";
import {
  answerUpdate,
  type Question,
} from "@/components/tenant/exams/optimistic";
import { OptionRow } from "@/components/tenant/exams/option";
import { isPlaceholderId } from "@/components/tenant/exams/placeholder";
import {
  OptionSketch,
  PreviewProse,
  usePromptDocument,
} from "@/components/tenant/exams/preview";
import { useExam, useExamSelection } from "@/components/tenant/exams/provider";
import {
  PaperOption,
  PaperOptions,
  QuestionPaper,
} from "@/components/tenant/exams/sheet";

/** The prompt loads when a page mounts its editors, never with the page. */
const ExamPrompt = dynamic(
  () =>
    import("@/components/tenant/exams/prompt").then(
      (module) => module.ExamPrompt
    ),
  { loading: () => null, ssr: false }
);

/** The margin that mounts a page's editors: one viewport of the canvas above and below it. */
const NEAR_MARGIN = "100% 0px";

/** The margin that unmounts a page's editors: three viewports, so a page near the edge keeps them. */
const FAR_MARGIN = "300% 0px";

/** Whether the last report of an observer has the page inside its margin. */
const isInside = (entries: readonly IntersectionObserverEntry[]) =>
  Option.match(Arr.last(entries), {
    onNone: () => false,
    onSome: (entry) => entry.isIntersecting,
  });

/**
 * Where a page sits against the canvas. `mounted` turns on when the page comes within a viewport
 * of the canvas, and turns off only when it leaves the three-viewport margin, so a page at the edge
 * keeps its editors. `reached` tells whether the page is within the three-viewport margin, where its
 * text may be read. The observers report each change, and the state changes only in their callbacks.
 */
function usePageWindow(
  page: RefObject<HTMLElement | null>,
  canvas: RefObject<HTMLElement | null>
) {
  const [mounted, setMounted] = useState(false);
  const [reached, setReached] = useState(false);

  useEffect(() => {
    const element = page.current;
    const root = canvas.current;
    if (element === null || root === null) {
      return;
    }

    const near = new IntersectionObserver(
      (entries) => {
        if (isInside(entries)) {
          setMounted(true);
        }
      },
      { root, rootMargin: NEAR_MARGIN }
    );
    const far = new IntersectionObserver(
      (entries) => {
        const inside = isInside(entries);
        setReached(inside);
        if (!inside) {
          setMounted(false);
        }
      },
      { root, rootMargin: FAR_MARGIN }
    );
    near.observe(element);
    far.observe(element);

    return () => {
      near.disconnect();
      far.disconnect();
    };
  }, [canvas, page]);

  return { mounted, reached };
}

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
 * is far away, the paper shows the same document as drawn text, so the page keeps its shape. A page
 * the server has not saved yet shows its options only, and they take no change until it answers.
 */
export function ExamPage({ canvas, count, index, question }: ExamPageProps) {
  const t = useTranslations("Exams");
  const { exam } = useExam();
  const frozen = isLocked(exam);
  const pending = useExamSelection((state) => state.pending);
  const selected = useExamSelection((state) => state.selected);
  const saved = !(
    Arr.contains(pending, question.id) || isPlaceholderId(question.prompt)
  );
  const number = index + 1;
  const page = useRef<HTMLElement>(null);
  const { mounted, reached } = usePageWindow(page, canvas);
  const live = mounted && saved;
  const doc = usePromptDocument({
    open: selected === question.id,
    question,
    read: reached && !live,
    saved,
  });

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
        <LivePaper number={number} question={question} />
      ) : (
        <StaticPaper doc={doc} question={question} />
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

  /** Saves the answers and the key of this question as they are now, at the revision the teacher saw. */
  const saveAnswers = (answers: Question["answers"], key: Question["key"]) => {
    runExamAction(
      sentAction(() =>
        answer({
          answers,
          examId: exam.id,
          key,
          questionId: question.id,
          revision: question.revision,
          slug,
        })
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
                    saveAnswers(
                      question.answers,
                      markedKey(question.answers, option.id)
                    );
                  }
                }}
                onRemove={
                  choice.options.length > CHOICE_OPTIONS_MIN
                    ? () => {
                        const next = withOptionRemoved(
                          question.answers,
                          question.key,
                          option.id
                        );
                        saveAnswers(next.answers, next.key);
                      }
                    : null
                }
                onSave={(label: OptionLabel) =>
                  saveAnswers(
                    withOptionLabel(question.answers, option.id, label),
                    question.key
                  )
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
              saveAnswers(withOptionAdded(question.answers), question.key)
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

/** The paper of a page without editors: the same document and options, drawn as text. */
function StaticPaper({
  doc,
  question,
}: {
  doc: Option.Option<Node>;
  question: Question;
}) {
  const choice = Option.getOrNull(choiceOf(question.answers));

  return (
    <QuestionPaper>
      {Option.isSome(doc) ? <PreviewProse doc={doc.value} /> : null}
      {choice === null ? null : (
        <PaperOptions>
          {Arr.map(choice.options, (option, index) => (
            <PaperOption key={option.id} letter={optionLetter(index)}>
              <OptionSketch label={option.label} />
            </PaperOption>
          ))}
        </PaperOptions>
      )}
    </QuestionPaper>
  );
}

/**
 * The actions of a page: move up, move down, copy, add a question below, and remove. A page shows
 * the icon buttons from the medium width up, and one More menu on a phone, and each button names
 * its action. Removing a question asks first, and an exam keeps at least one question.
 */
function PageActions({
  count,
  index,
  question,
}: {
  count: number;
  index: number;
  question: Question;
}) {
  const t = useTranslations("Exams");
  const common = useTranslations("Common");
  const actions = useQuestionActions();
  const [asking, setAsking] = useState(false);

  const moveUp = () => actions.moveQuestion(question.id, index - 1);
  const moveDown = () => actions.moveQuestion(question.id, index + 1);
  const copy = () => actions.copyQuestion(question);
  const addBelow = () => actions.addQuestion(question.id);
  const removeQuestion = () => {
    setAsking(false);
    actions.removeQuestion(question.id);
  };

  return (
    <>
      <div className="hidden items-center gap-0.5 md:flex">
        <Button
          aria-label={t("move-up")}
          disabled={index === 0}
          onClick={moveUp}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <HugeIcons aria-hidden="true" icon={ArrowUp01Icon} />
        </Button>
        <Button
          aria-label={t("move-down")}
          disabled={index === count - 1}
          onClick={moveDown}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <HugeIcons aria-hidden="true" icon={ArrowDown01Icon} />
        </Button>
        <Button
          aria-label={t("copy")}
          onClick={copy}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <HugeIcons aria-hidden="true" icon={Copy01Icon} />
        </Button>
        <Button
          aria-label={t("add-below")}
          onClick={addBelow}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <HugeIcons aria-hidden="true" icon={Add01Icon} />
        </Button>
        {count > 1 ? (
          <Button
            aria-label={t("remove")}
            onClick={() => setAsking(true)}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <HugeIcons aria-hidden="true" icon={Delete02Icon} />
          </Button>
        ) : null}
      </div>
      <div className="md:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                aria-label={common("more-actions")}
                size="icon-sm"
                variant="ghost"
              >
                <HugeIcons aria-hidden="true" icon={MoreHorizontalIcon} />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem disabled={index === 0} onClick={moveUp}>
              {t("move-up")}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={index === count - 1} onClick={moveDown}>
              {t("move-down")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={copy}>{t("copy")}</DropdownMenuItem>
            <DropdownMenuItem onClick={addBelow}>
              {t("add-below")}
            </DropdownMenuItem>
            {count > 1 ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setAsking(true)}
                  variant="destructive"
                >
                  {t("remove")}
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <ResponsiveDialog
        description={t("remove-description")}
        footer={
          <>
            <Button onClick={() => setAsking(false)} variant="outline">
              {common("cancel")}
            </Button>
            <Button onClick={removeQuestion} variant="destructive">
              {t("remove")}
            </Button>
          </>
        }
        open={asking}
        setOpen={setAsking}
        title={t("remove-title")}
      />
    </>
  );
}
