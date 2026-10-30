import { useMutation } from "@confect/react";
import {
  Calendar03Icon,
  Delete02Icon,
  MoreHorizontalIcon,
  PencilEdit02Icon,
  ViewIcon,
} from "@hugeicons/core-free-icons";
import exams from "@repo/backend/confect/_generated/refs/exams";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Function as Fn } from "effect";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { useTenant } from "@/components/tenant/context";
import { runExamAction, sentAction } from "@/components/tenant/exams/action";
import type { ListedExam } from "@/components/tenant/exams/optimistic";
import { removeExamUpdate } from "@/components/tenant/exams/removal";
import { Link } from "@/lib/routing/link";

/**
 * The row menu of one exam in the list: its editor, its rooms, the exam as a student sees it, and Delete, which asks
 * first. A deleted exam leaves the list at once, and a refusal puts it back with the action-error toast.
 */
export function ExamRowMenu({ exam }: { exam: ListedExam }) {
  const t = useTranslations("Exams");
  const common = useTranslations("Common");
  const { slug } = useTenant();
  const remove = useMutation(exams.exams.remove).withOptimisticUpdate(
    removeExamUpdate
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const params = { exam: exam.id, slug };

  const deleteExam = () => {
    setIsDeleting(false);
    runExamAction(
      sentAction(() => remove({ examId: exam.id, slug })),
      { onFailure: Fn.constVoid, onSuccess: Fn.constVoid }
    );
  };

  return (
    <div className="flex justify-end">
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
        <DropdownMenuContent align="end" className="w-48">
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
        </DropdownMenuContent>
      </DropdownMenu>
      <ResponsiveDialog
        description={t("delete-description")}
        footer={
          <>
            <Button onClick={() => setIsDeleting(false)} variant="outline">
              {common("cancel")}
            </Button>
            <Button onClick={deleteExam} variant="destructive">
              <HugeIcons aria-hidden="true" icon={Delete02Icon} />
              {common("delete")}
            </Button>
          </>
        }
        open={isDeleting}
        setOpen={setIsDeleting}
        title={t("delete-title")}
      />
    </div>
  );
}
