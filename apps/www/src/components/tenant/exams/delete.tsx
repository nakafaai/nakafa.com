import { useMutation } from "@confect/react";
import { Delete02Icon } from "@hugeicons/core-free-icons";
import exams from "@repo/backend/confect/_generated/refs/exams";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { useNavigate } from "@tanstack/react-router";
import { Function as Fn } from "effect";
import { useTranslations } from "use-intl";
import { runExamAction, sentAction } from "@/components/tenant/exams/action";
import { useExam } from "@/components/tenant/exams/provider";
import { removeExamUpdate } from "@/components/tenant/exams/removal";

/**
 * Asks once before the open draft is deleted, as Canva asks before a design goes to the trash. The
 * editor's menu opens it (ExamMenu). On confirm the exam leaves the lists and the home at once and the
 * teacher lands on the exams; a refusal puts it back with the action-error toast.
 */
export function DeleteExam({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const t = useTranslations("Exams");
  const common = useTranslations("Common");
  const { exam, slug } = useExam();
  const navigate = useNavigate();
  const remove = useMutation(exams.exams.remove).withOptimisticUpdate(
    removeExamUpdate
  );

  /**
   * Closes the question, leaves the editor for the exams, then deletes the exam. The editor is left
   * first: once the server deletes the exam, the editor's live read of it fails, and an editor still
   * on screen drew the exam as not available, with its error, before the exams opened.
   */
  async function confirm() {
    onOpenChange(false);
    const examId = exam.id;
    await navigate({
      params: { slug },
      replace: true,
      to: "/school/$slug/exams",
    });
    runExamAction(
      sentAction(() => remove({ examId, slug })),
      { onFailure: Fn.constVoid, onSuccess: Fn.constVoid }
    );
  }

  return (
    <ResponsiveDialog
      description={t("delete-description")}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} variant="outline">
            {common("cancel")}
          </Button>
          <Button onClick={confirm} variant="destructive">
            <HugeIcons aria-hidden="true" icon={Delete02Icon} />
            {common("delete")}
          </Button>
        </>
      }
      open={open}
      setOpen={onOpenChange}
      title={t("delete-title")}
    />
  );
}
