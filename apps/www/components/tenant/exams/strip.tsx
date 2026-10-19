"use client";

import { useMutation } from "@confect/react";
import { Add01Icon, MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import exams from "@repo/backend/confect/_generated/refs/exams";
import { newChoiceAnswers } from "@repo/backend/confect/exams/question";
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
import { Array as Arr, Effect, Function as Fn, Option } from "effect";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { runExamAction, sentAction } from "@/components/tenant/exams/action";
import { isLocked } from "@/components/tenant/exams/freeze";
import {
  addQuestionUpdate,
  copyQuestionUpdate,
  moveUpdate,
  placeholderQuestion,
  type Question,
  removeUpdate,
} from "@/components/tenant/exams/optimistic";
import {
  placeholderPromptId,
  placeholderQuestionId,
} from "@/components/tenant/exams/placeholder";
import { QuestionPreview } from "@/components/tenant/exams/preview";
import {
  useActiveQuestion,
  useExam,
  useExamSelection,
} from "@/components/tenant/exams/provider";

/** Runs an action of the strip from a browser event, without any handler of its own. */
const act = <A, E>(action: Effect.Effect<A, E>) =>
  runExamAction(action, {
    onFailure: Fn.constVoid,
    onSuccess: Fn.constVoid,
  });

/**
 * A question the server has not saved yet, with its own placeholder IDs. It takes the
 * answers and the key it starts with, and the prompt it shows at once.
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
 * The questions of the exam in order, like the pages of a design: each thumbnail is its
 * question's page drawn small, beside its number and a dot when it has no answer key. The
 * strip is a column beside the canvas, and a row above it on a phone. An add button at the
 * end adds a question. Each thumbnail's menu copies, moves, and removes its question. A question the server has not saved yet is disabled until it
 * answers, and the exam keeps at least one question, so the last one has no remove.
 * A frozen exam shows neither the add button nor the menus, so its questions stay as the
 * sitting was scheduled.
 */
export function ExamStrip() {
  const t = useTranslations("Exams");
  const { exam, slug } = useExam();
  const frozen = isLocked(exam);
  const active = useActiveQuestion();
  const selectedId = Option.getOrNull(
    Option.map(active, (current) => current.question.id)
  );
  const pending = useExamSelection((state) => state.pending);
  const chosen = useExamSelection((state) => state.selected);
  const select = useExamSelection((state) => state.select);
  const replace = useExamSelection((state) => state.replace);
  const startPending = useExamSelection((state) => state.startPending);
  const endPending = useExamSelection((state) => state.endPending);
  const add = useMutation(exams.questions.add);

  /** Adds a question at the end, shows it at once, and selects it when the server saves it. */
  const addQuestion = () =>
    act(
      placeholderDraft(newChoiceAnswers(), null).pipe(
        Effect.flatMap((draft) => {
          const previous = chosen;
          startPending(draft.id);
          select(draft.id);
          return sentAction(() =>
            add.withOptimisticUpdate(addQuestionUpdate(draft))({
              after: null,
              examId: exam.id,
              slug,
            })
          ).pipe(
            Effect.ensuring(Effect.sync(() => endPending(draft.id))),
            Effect.tap((saved) =>
              Effect.sync(() => replace(draft.id, saved.id))
            ),
            Effect.tapError(() =>
              Effect.sync(() => replace(draft.id, previous))
            )
          );
        })
      )
    );

  return (
    <nav
      aria-label={t("questions")}
      className="flex shrink-0 gap-3 overflow-x-auto border-b bg-sidebar p-3 md:w-64 md:flex-col md:overflow-y-auto md:overflow-x-hidden md:border-r md:border-b-0"
    >
      {Arr.map(exam.questions, (question, index) => (
        <Thumbnail
          count={exam.questions.length}
          index={index}
          key={question.id}
          pending={Arr.contains(pending, question.id)}
          question={question}
          selected={question.id === selectedId}
        />
      ))}
      {frozen ? null : (
        <div className="flex shrink-0 gap-2 md:w-full">
          <span aria-hidden className="w-5 shrink-0" />
          <Button
            className="h-auto self-stretch border-dashed md:h-9 md:flex-1"
            onClick={addQuestion}
            variant="outline"
          >
            <HugeIcons icon={Add01Icon} />
            {t("add-question")}
          </Button>
        </div>
      )}
    </nav>
  );
}

/** One question of the strip: the button that shows it, and the menu of its actions. */
function Thumbnail({
  count,
  index,
  pending,
  question,
  selected,
}: {
  count: number;
  index: number;
  pending: boolean;
  question: Question;
  selected: boolean;
}) {
  const t = useTranslations("Exams");
  const common = useTranslations("Common");
  const { exam, slug } = useExam();
  const frozen = isLocked(exam);
  const chosen = useExamSelection((state) => state.selected);
  const select = useExamSelection((state) => state.select);
  const replace = useExamSelection((state) => state.replace);
  const startPending = useExamSelection((state) => state.startPending);
  const endPending = useExamSelection((state) => state.endPending);
  const [asking, setAsking] = useState(false);
  const move = useMutation(exams.questions.move).withOptimisticUpdate(
    moveUpdate
  );
  const remove = useMutation(exams.questions.remove).withOptimisticUpdate(
    removeUpdate
  );
  const copy = useMutation(exams.questions.copy);

  /** Copies the question right after itself, and selects the copy once the server saves it. */
  const copyQuestion = () =>
    act(
      placeholderDraft(question.answers, question.key).pipe(
        Effect.flatMap((draft) => {
          const previous = chosen;
          startPending(draft.id);
          select(draft.id);
          return sentAction(() =>
            copy.withOptimisticUpdate(copyQuestionUpdate(draft))({
              examId: exam.id,
              questionId: question.id,
              slug,
            })
          ).pipe(
            Effect.ensuring(Effect.sync(() => endPending(draft.id))),
            Effect.tap((saved) =>
              Effect.sync(() => replace(draft.id, saved.id))
            ),
            Effect.tapError(() =>
              Effect.sync(() => replace(draft.id, previous))
            )
          );
        })
      )
    );

  /** Moves the question to an index of the order, and shows the move at once. */
  const moveTo = (target: number) =>
    act(
      sentAction(() =>
        move({ examId: exam.id, index: target, questionId: question.id, slug })
      )
    );

  /** Removes the question once the teacher confirmed it. */
  const removeQuestion = () => {
    setAsking(false);
    act(
      sentAction(() =>
        remove({ examId: exam.id, questionId: question.id, slug })
      )
    );
  };

  return (
    <div className="group/thumb flex shrink-0 gap-2 md:w-full">
      <div className="flex w-5 shrink-0 flex-col items-end gap-1.5 pt-0.5">
        <span className="text-muted-foreground text-xs tabular-nums">
          {index + 1}
        </span>
        {question.key === null ? (
          <span aria-hidden className="size-1.5 rounded-full bg-primary" />
        ) : null}
      </div>
      <div className="relative w-32 md:w-auto md:flex-1">
        <button
          aria-current={selected ? "true" : undefined}
          className="relative block aspect-4/3 w-full overflow-hidden rounded-lg border bg-muted/40 outline-none transition-[scale,box-shadow,border-color] duration-150 ease-out hover:border-foreground/20 focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-96 disabled:opacity-60 aria-[current=true]:border-primary aria-[current=true]:ring-2 aria-[current=true]:ring-primary"
          disabled={pending}
          onClick={() => select(question.id)}
          type="button"
        >
          <span className="sr-only">
            {t("question", { number: index + 1 })}
            {question.key === null ? ` ${t("no-key")}` : null}
          </span>
          <QuestionPreview
            number={index + 1}
            open={selected}
            question={question}
            saved={!pending}
          />
        </button>
        {pending || frozen ? null : (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  aria-label={common("more-actions")}
                  className="absolute end-1.5 top-1.5 opacity-0 pointer-coarse:opacity-100 transition-opacity duration-150 focus-visible:opacity-100 group-focus-within/thumb:opacity-100 group-hover/thumb:opacity-100 data-popup-open:opacity-100"
                  size="icon-sm"
                  variant="secondary"
                >
                  <HugeIcons icon={MoreHorizontalIcon} />
                </Button>
              }
            />
            <DropdownMenuContent align="start" className="w-44">
              <DropdownMenuItem onClick={copyQuestion}>
                {t("copy")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={index === 0}
                onClick={() => moveTo(index - 1)}
              >
                {t("move-up")}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={index === count - 1}
                onClick={() => moveTo(index + 1)}
              >
                {t("move-down")}
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
        )}
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
    </div>
  );
}
