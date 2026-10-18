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
 * The questions of the exam in order, one thumbnail each: its number, and a dot when it has
 * no answer key. An add button at the end adds a question. Each thumbnail's menu copies,
 * moves, and removes its question. A question the server has not saved yet is inert until it
 * answers, and the exam keeps at least one question, so the last one has no remove.
 */
export function ExamStrip() {
  const t = useTranslations("Exams");
  const { exam, slug } = useExam();
  const active = useActiveQuestion();
  const selectedId = Option.getOrNull(
    Option.map(active, (current) => current.question.id)
  );
  const pending = useExamSelection((state) => state.pending);
  const chosen = useExamSelection((state) => state.selected);
  const select = useExamSelection((state) => state.select);
  const restore = useExamSelection((state) => state.restore);
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
            Effect.tap((saved) => Effect.sync(() => select(saved.id))),
            Effect.tapError(() =>
              Effect.sync(() => restore(draft.id, previous))
            )
          );
        })
      )
    );

  return (
    <nav
      aria-label={t("questions")}
      className="flex shrink-0 items-center gap-2 overflow-x-auto border-b p-3 md:w-44 md:flex-col md:overflow-y-auto md:border-e md:border-b-0"
      data-slot="exam-strip"
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
      <Button
        aria-label={t("add-question")}
        onClick={addQuestion}
        size="icon-sm"
        variant="outline"
      >
        <HugeIcons icon={Add01Icon} />
      </Button>
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
  const chosen = useExamSelection((state) => state.selected);
  const select = useExamSelection((state) => state.select);
  const restore = useExamSelection((state) => state.restore);
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
            Effect.tap((saved) => Effect.sync(() => select(saved.id))),
            Effect.tapError(() =>
              Effect.sync(() => restore(draft.id, previous))
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
    <div className="flex shrink-0 items-center gap-1 md:w-full">
      <Button
        aria-current={selected ? "true" : undefined}
        className="h-auto flex-1 justify-start gap-2"
        onClick={pending ? undefined : () => select(question.id)}
        variant={selected ? "secondary" : "ghost"}
      >
        <span className="tabular-nums">{index + 1}</span>
        {question.key === null ? (
          <>
            <span aria-hidden className="size-1.5 rounded-full bg-primary" />
            <span className="sr-only">{t("no-key")}</span>
          </>
        ) : null}
      </Button>
      {pending ? null : (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                aria-label={common("more-actions")}
                size="icon-sm"
                variant="ghost"
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
