import { useMutation } from "@confect/react";
import { Delete02Icon } from "@hugeicons/core-free-icons";
import exams from "@repo/backend/confect/_generated/refs/exams";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { useNavigate } from "@tanstack/react-router";
import { Function as Fn } from "effect";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { runExamAction, sentAction } from "@/components/tenant/exams/action";
import { useExam } from "@/components/tenant/exams/provider";
import { removeExamUpdate } from "@/components/tenant/exams/removal";

/**
 * Deletes the open draft, as Canva moves a design to the trash from inside the editor: an icon
 * with its name in a tooltip, then one question before anything is lost. On confirm the exam
 * leaves the lists and the home at once and the teacher lands on the exams; a refusal puts it
 * back with the action-error toast. A scheduled or archived exam shows no delete.
 */
export function DeleteExam() {
  const t = useTranslations("Exams");
  const common = useTranslations("Common");
  const { exam, slug } = useExam();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const remove = useMutation(exams.exams.remove).withOptimisticUpdate(
    removeExamUpdate
  );

  /** Closes the question, deletes the exam, and leaves its editor for the exams. */
  function confirm() {
    setOpen(false);
    runExamAction(
      sentAction(() => remove({ examId: exam.id, slug })),
      { onFailure: Fn.constVoid, onSuccess: Fn.constVoid }
    );
    navigate({ params: { slug }, replace: true, to: "/school/$slug/exams" });
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-label={t("delete-action")}
              onClick={() => setOpen(true)}
              size="icon"
              variant="ghost"
            />
          }
        >
          <HugeIcons aria-hidden="true" icon={Delete02Icon} />
        </TooltipTrigger>
        <TooltipContent side="bottom">{t("delete-action")}</TooltipContent>
      </Tooltip>
      <ResponsiveDialog
        description={t("delete-description")}
        footer={
          <>
            <Button onClick={() => setOpen(false)} variant="outline">
              {common("cancel")}
            </Button>
            <Button onClick={confirm} variant="destructive">
              <HugeIcons aria-hidden="true" icon={Delete02Icon} />
              {common("delete")}
            </Button>
          </>
        }
        open={open}
        setOpen={setOpen}
        title={t("delete-title")}
      />
    </>
  );
}
