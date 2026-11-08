import { useMutation } from "@confect/react";
import { Delete02Icon } from "@hugeicons/core-free-icons";
import exams from "@repo/backend/confect/_generated/refs/exams";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { useNavigate } from "@tanstack/react-router";
import { Function as Fn } from "effect";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { runExamAction, sentAction } from "@/components/tenant/exams/action";
import { useExam } from "@/components/tenant/exams/provider";
import { removeExamUpdate } from "@/components/tenant/exams/removal";

/**
 * The delete of the open draft, as Canva asks before a design goes to the trash: the editor's menu (ExamMenu) asks with
 * `ExamDeleteConfirm`, and on confirm the exam leaves the lists and the home at once and the teacher lands on the
 * exams; a refusal puts it back with the action-error toast. `close` closes the confirmation first.
 */
export function useDeleteExam(close: () => void) {
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
    close();
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

  return { confirm, title: exam.title };
}

/**
 * Asks once before an exam is deleted, from its editor or its row in the list: the exam it removes in the body, and
 * Cancel beside Delete in the footer.
 */
export function ExamDeleteConfirm({
  children,
  onConfirm,
  open,
  setOpen,
}: {
  /** The body: the exam it removes, a `ConfirmSubject` with its title. */
  children: ReactNode;
  onConfirm: () => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const t = useTranslations("Exams");
  const common = useTranslations("Common");

  return (
    <ResponsiveDialog
      description={t("delete-description")}
      footer={
        <>
          <Button onClick={() => setOpen(false)} variant="outline">
            {common("cancel")}
          </Button>
          <Button onClick={onConfirm} variant="destructive">
            <HugeIcons aria-hidden="true" icon={Delete02Icon} />
            {common("delete")}
          </Button>
        </>
      }
      open={open}
      setOpen={setOpen}
      title={t("delete-title")}
    >
      {children}
    </ResponsiveDialog>
  );
}
