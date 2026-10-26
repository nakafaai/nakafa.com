import {
  Add01Icon,
  ArrowDown02Icon,
  ArrowUp02Icon,
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { type ComponentProps, useState } from "react";
import { useTranslations } from "use-intl";
import { useQuestionActions } from "@/components/tenant/exams/actions";
import type {
  Question,
  QuestionId,
} from "@/components/tenant/exams/optimistic";
import { useExam, useExamSelection } from "@/components/tenant/exams/provider";

/**
 * The actions of a page: move up, move down, copy, add a question below, and remove. A page shows
 * the icon buttons from the medium width up, and one More menu on a phone. Each button names its
 * action and its question, since every page of the exam has the same actions. Removing a question
 * asks first, and an exam keeps at least one question.
 */
export function PageActions({
  index,
  question,
}: {
  index: number;
  question: Question;
}) {
  const { exam } = useExam();
  const count = exam.questions.length;
  const t = useTranslations("Exams");
  const common = useTranslations("Common");
  const actions = useQuestionActions();
  const requestFocus = useExamSelection((state) => state.requestFocus);
  const [asking, setAsking] = useState(false);
  const number = index + 1;

  // A move keeps the focus on the moved page, so the keyboard user who pressed the button keeps their place.
  const moveUp = () => {
    requestFocus(question.id);
    actions.moveQuestion(question.id, index - 1);
  };
  const moveDown = () => {
    requestFocus(question.id);
    actions.moveQuestion(question.id, index + 1);
  };
  const copy = () => actions.copyQuestion(question);
  const addBelow = () => actions.addQuestion(question.id);
  const removeQuestion = () => {
    setAsking(false);
    actions.removeQuestion(question.id);
  };

  return (
    <>
      <div className="hidden items-center gap-0.5 md:flex">
        <PageAction
          disabled={index === 0}
          hint={t("move-up")}
          icon={ArrowUp02Icon}
          label={t("move-up-of", { number })}
          onClick={moveUp}
        />
        <PageAction
          disabled={index === count - 1}
          hint={t("move-down")}
          icon={ArrowDown02Icon}
          label={t("move-down-of", { number })}
          onClick={moveDown}
        />
        <PageAction
          hint={t("copy")}
          icon={Copy01Icon}
          label={t("copy-of", { number })}
          onClick={copy}
        />
        <PageAction
          hint={t("add-below")}
          icon={Add01Icon}
          label={t("add-below-of", { number })}
          onClick={addBelow}
        />
        {count > 1 ? (
          <PageAction
            hint={t("remove")}
            icon={Delete02Icon}
            label={t("remove-of", { number })}
            onClick={() => setAsking(true)}
          />
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
              <HugeIcons aria-hidden="true" icon={ArrowUp02Icon} />
              {t("move-up")}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={index === count - 1} onClick={moveDown}>
              <HugeIcons aria-hidden="true" icon={ArrowDown02Icon} />
              {t("move-down")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={copy}>
              <HugeIcons aria-hidden="true" icon={Copy01Icon} />
              {t("copy")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={addBelow}>
              <HugeIcons aria-hidden="true" icon={Add01Icon} />
              {t("add-below")}
            </DropdownMenuItem>
            {count > 1 ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setAsking(true)}
                  variant="destructive"
                >
                  <HugeIcons aria-hidden="true" icon={Delete02Icon} />
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
 * One action of a page as an icon button, named for assistive technology with its question, and
 * shown in a tooltip by the action alone, since the tooltip stands beside its page.
 */
function PageAction({
  disabled = false,
  hint,
  icon,
  label,
  onClick,
}: {
  disabled?: boolean;
  hint: string;
  icon: ComponentProps<typeof HugeIcons>["icon"];
  label: string;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={label}
            disabled={disabled}
            onClick={onClick}
            size="icon-sm"
            type="button"
            variant="ghost"
          />
        }
      >
        <HugeIcons aria-hidden="true" icon={icon} />
      </TooltipTrigger>
      <TooltipContent>{hint}</TooltipContent>
    </Tooltip>
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
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={t("reorder-of", { number })}
            className="cursor-grab touch-none active:cursor-grabbing"
            data-grip={questionId}
            size="icon-sm"
            type="button"
            variant="ghost"
          />
        }
      >
        <HugeIcons aria-hidden="true" icon={DragDropVerticalIcon} />
      </TooltipTrigger>
      <TooltipContent>{t("reorder")}</TooltipContent>
    </Tooltip>
  );
}
