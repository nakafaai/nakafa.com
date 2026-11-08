import { useMutation } from "@confect/react";
import {
  Calendar03Icon,
  Copy01Icon,
  Delete02Icon,
  PencilEdit02Icon,
  TaskEdit01Icon,
  ViewIcon,
} from "@hugeicons/core-free-icons";
import exams from "@repo/backend/confect/_generated/refs/exams";
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@repo/design-system/components/ui/dropdown-menu";
import { ResponsiveDialogSubject } from "@repo/design-system/components/ui/responsive-dialog";
import { Function as Fn } from "effect";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { RowItems } from "@/components/shared/table/menu";
import { useTenant } from "@/components/tenant/context";
import { ExamDeleteConfirm } from "@/components/tenant/exams/delete";
import { useDuplicateExam } from "@/components/tenant/exams/duplicate";
import type { ListedExam } from "@/components/tenant/exams/optimistic";
import { removeExamUpdate } from "@/components/tenant/exams/removal";
import { runSchoolWrite, schoolCall } from "@/components/tenant/write";
import { Link } from "@/lib/routing/link";

/**
 * The row menu of one exam in the list: its editor, its rooms, the exam as a student sees it, a copy of it, and Delete,
 * which asks first. A deleted exam leaves the list at once, and a refusal puts it back with the action-error toast.
 */
export function ExamRowMenu({ exam }: { exam: ListedExam }) {
  const t = useTranslations("Exams");
  const common = useTranslations("Common");
  const { slug } = useTenant();
  const remove = useMutation(exams.exams.remove).withOptimisticUpdate(
    removeExamUpdate
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const { isPending, press } = useDuplicateExam(exam, slug);
  const params = { exam: exam.id, slug };

  const deleteExam = () => {
    setIsDeleting(false);
    runSchoolWrite(
      schoolCall(() => remove({ examId: exam.id, slug })),
      { onFailed: Fn.constVoid, onSaved: Fn.constVoid }
    );
  };

  return (
    <>
      <RowItems>
        <DropdownMenuGroup>
          <DropdownMenuItem
            icon={PencilEdit02Icon}
            render={
              <Link params={params} to="/school/$slug/exams/$exam/edit" />
            }
          >
            {common("edit")}
          </DropdownMenuItem>
          <DropdownMenuItem
            icon={Calendar03Icon}
            render={<Link params={params} to="/school/$slug/exams/$exam" />}
          >
            {t("rooms-title")}
          </DropdownMenuItem>
          <DropdownMenuItem
            icon={ViewIcon}
            render={<Link params={params} to="/school/$slug/exams/$exam/try" />}
          >
            {t("try-action")}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={isPending}
            icon={Copy01Icon}
            onClick={press}
          >
            {t("duplicate-action")}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            icon={Delete02Icon}
            onClick={() => setIsDeleting(true)}
            variant="destructive"
          >
            {common("delete")}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </RowItems>
      <ExamDeleteConfirm
        onConfirm={deleteExam}
        open={isDeleting}
        setOpen={setIsDeleting}
      >
        <ResponsiveDialogSubject icon={TaskEdit01Icon}>
          {exam.title}
        </ResponsiveDialogSubject>
      </ExamDeleteConfirm>
    </>
  );
}
