import {
  Add01Icon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  Copy01Icon,
  Delete02Icon,
  DragDropVerticalIcon,
  MoreHorizontalIcon,
} from "@hugeicons/core-free-icons";
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
import { useState } from "react";
import { useTranslations } from "use-intl";
import { useQuestionActions } from "@/components/tenant/exams/actions";
import type {
  Question,
  QuestionId,
} from "@/components/tenant/exams/optimistic";

/**
 * The actions of a page: move up, move down, copy, add a question below, and remove. A page shows
 * the icon buttons from the medium width up, and one More menu on a phone. Each button names its
 * action and its question, since every page of the exam has the same actions. Removing a question
 * asks first, and an exam keeps at least one question.
 */
export function PageActions({
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
  const number = index + 1;

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
          aria-label={t("move-up-of", { number })}
          disabled={index === 0}
          onClick={moveUp}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <HugeIcons aria-hidden="true" icon={ArrowUp01Icon} />
        </Button>
        <Button
          aria-label={t("move-down-of", { number })}
          disabled={index === count - 1}
          onClick={moveDown}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <HugeIcons aria-hidden="true" icon={ArrowDown01Icon} />
        </Button>
        <Button
          aria-label={t("copy-of", { number })}
          onClick={copy}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <HugeIcons aria-hidden="true" icon={Copy01Icon} />
        </Button>
        <Button
          aria-label={t("add-below-of", { number })}
          onClick={addBelow}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <HugeIcons aria-hidden="true" icon={Add01Icon} />
        </Button>
        {count > 1 ? (
          <Button
            aria-label={t("remove-of", { number })}
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
                aria-label={t("more-actions-of", { number })}
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

/**
 * The grip of a page: the handle the teacher drags to move the question, or focuses to move it with
 * the arrow keys. The canvas reads the handle's question from its `data-grip` attribute, so the grip
 * holds no handler of its own.
 */
export function QuestionGrip({
  number,
  questionId,
}: {
  number: number;
  questionId: QuestionId;
}) {
  const t = useTranslations("Exams");
  return (
    <Button
      aria-label={t("reorder-of", { number })}
      className="cursor-grab touch-none active:cursor-grabbing"
      data-grip={questionId}
      size="icon-sm"
      type="button"
      variant="ghost"
    >
      <HugeIcons aria-hidden="true" icon={DragDropVerticalIcon} />
    </Button>
  );
}
