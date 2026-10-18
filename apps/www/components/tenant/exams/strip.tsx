"use client";

import { useMutation } from "@confect/react";
import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import exams from "@repo/backend/confect/_generated/refs/exams";
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
import { Array as Arr, Option } from "effect";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  moveUpdate,
  type Question,
  removeUpdate,
} from "@/components/tenant/exams/optimistic";
import {
  useActiveQuestion,
  useExam,
  useExamSelection,
} from "@/components/tenant/exams/provider";

/**
 * The questions of the exam in order, one thumbnail each: its number, and a dot when it
 * has no answer key. Each thumbnail's menu moves the question and removes it, and the
 * exam keeps at least one question, so the last one has no remove.
 */
export function ExamStrip() {
  const t = useTranslations("Exams");
  const { exam } = useExam();
  const active = Option.map(
    useActiveQuestion(),
    (current) => current.question.id
  );
  const selectedId = Option.getOrNull(active);

  return (
    <nav
      aria-label={t("questions")}
      className="flex shrink-0 gap-2 overflow-x-auto border-b p-3 md:w-44 md:flex-col md:overflow-y-auto md:border-e md:border-b-0"
      data-slot="exam-strip"
    >
      {Arr.map(exam.questions, (question, index) => (
        <Thumbnail
          count={exam.questions.length}
          index={index}
          key={question.id}
          question={question}
          selected={question.id === selectedId}
        />
      ))}
    </nav>
  );
}

/** One question of the strip: the button that shows it, and the menu of its actions. */
function Thumbnail({
  count,
  index,
  question,
  selected,
}: {
  count: number;
  index: number;
  question: Question;
  selected: boolean;
}) {
  const t = useTranslations("Exams");
  const common = useTranslations("Common");
  const { exam, slug } = useExam();
  const select = useExamSelection((state) => state.select);
  const [asking, setAsking] = useState(false);
  const move = useMutation(exams.questions.move).withOptimisticUpdate(
    moveUpdate
  );
  const remove = useMutation(exams.questions.remove).withOptimisticUpdate(
    removeUpdate
  );

  function moveTo(target: number) {
    move({ examId: exam.id, index: target, questionId: question.id, slug });
  }

  return (
    <div className="flex shrink-0 items-center gap-1 md:w-full">
      <Button
        aria-current={selected ? "true" : undefined}
        className="h-auto flex-1 justify-start gap-2"
        onClick={() => select(question.id)}
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
      <ResponsiveDialog
        description={t("remove-description")}
        footer={
          <>
            <Button onClick={() => setAsking(false)} variant="outline">
              {common("cancel")}
            </Button>
            <Button
              onClick={() => {
                setAsking(false);
                remove({ examId: exam.id, questionId: question.id, slug });
              }}
              variant="destructive"
            >
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
