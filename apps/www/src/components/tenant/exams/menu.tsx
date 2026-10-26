import {
  ArrowDown01Icon,
  Delete02Icon,
  FileImportIcon,
  ViewIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { buttonVariants } from "@repo/design-system/lib/button";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { DeleteExam } from "@/components/tenant/exams/delete";
import { isLocked } from "@/components/tenant/exams/freeze";
import { ImportQuestions } from "@/components/tenant/exams/import/dialog";
import { useExam } from "@/components/tenant/exams/provider";
import { Link } from "@/lib/routing/link";

/**
 * The editor's secondary action with the rest joined to it, as Google Docs and Canva show them: Try
 * as student as one button, and a menu beside it of what a teacher reaches less often, Import and
 * Delete exam, each opening its dialog. With Schedule, the main action, the header shows two buttons.
 * A locked exam takes neither change, so Try as student stands alone. On a phone the button keeps its
 * icon and its name for screen readers.
 */
export function ExamMenu() {
  const t = useTranslations("Exams");
  const common = useTranslations("Common");
  const { exam, slug } = useExam();
  const [dialog, setDialog] = useState<"delete" | "import" | null>(null);
  const tryAsStudent = (
    <Link
      aria-label={t("try-action")}
      className={buttonVariants({ variant: "outline" })}
      params={{ exam: exam.id, slug }}
      to="/school/$slug/exams/$exam/try"
    >
      <HugeIcons aria-hidden="true" icon={ViewIcon} />
      <span className="max-sm:sr-only">{t("try-action")}</span>
    </Link>
  );

  if (isLocked(exam)) {
    return tryAsStudent;
  }

  return (
    <>
      <ButtonGroup aria-label={t("exam-actions")}>
        {tryAsStudent}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger
              render={
                <DropdownMenuTrigger
                  render={
                    <Button
                      aria-label={common("more-actions")}
                      size="icon"
                      variant="outline"
                    />
                  }
                >
                  <HugeIcons aria-hidden="true" icon={ArrowDown01Icon} />
                </DropdownMenuTrigger>
              }
            />
            <TooltipContent side="bottom">
              {common("more-actions")}
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuGroup>
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => setDialog("import")}
              >
                <HugeIcons icon={FileImportIcon} />
                {t("import-action")}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => setDialog("delete")}
                variant="destructive"
              >
                <HugeIcons icon={Delete02Icon} />
                {t("delete-action")}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </ButtonGroup>
      <ImportQuestions
        onOpenChange={(open) => setDialog(open ? "import" : null)}
        open={dialog === "import"}
      />
      <DeleteExam
        onOpenChange={(open) => setDialog(open ? "delete" : null)}
        open={dialog === "delete"}
      />
    </>
  );
}
