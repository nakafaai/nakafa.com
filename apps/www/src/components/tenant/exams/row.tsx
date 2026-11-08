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
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Function as Fn } from "effect";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { ConfirmSubject } from "@/components/shared/table/confirm";
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
            render={
              <Link params={params} to="/school/$slug/exams/$exam/edit">
                <HugeIcons icon={PencilEdit02Icon} />
                {common("edit")}
              </Link>
            }
          />
          <DropdownMenuItem
            render={
              <Link params={params} to="/school/$slug/exams/$exam">
                <HugeIcons icon={Calendar03Icon} />
                {t("rooms-title")}
              </Link>
            }
          />
          <DropdownMenuItem
            render={
              <Link params={params} to="/school/$slug/exams/$exam/try">
                <HugeIcons icon={ViewIcon} />
                {t("try-action")}
              </Link>
            }
          />
          <DropdownMenuItem disabled={isPending} onClick={press}>
            <HugeIcons icon={Copy01Icon} />
            {t("duplicate-action")}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={() => setIsDeleting(true)}
            variant="destructive"
          >
            <HugeIcons icon={Delete02Icon} />
            {common("delete")}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </RowItems>
      <ExamDeleteConfirm
        onConfirm={deleteExam}
        open={isDeleting}
        setOpen={setIsDeleting}
      >
        <ConfirmSubject icon={TaskEdit01Icon} name={exam.title} />
      </ExamDeleteConfirm>
    </>
  );
}
