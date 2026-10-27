import {
  Delete02Icon,
  FileImportIcon,
  ViewIcon,
} from "@hugeicons/core-free-icons";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { buttonVariants } from "@repo/design-system/lib/button";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { SplitMenuTrigger } from "@/components/shared/split";
import { DeleteExam } from "@/components/tenant/exams/delete";
import { ImportQuestions } from "@/components/tenant/exams/import/dialog";
import { useExam, useExamLocked } from "@/components/tenant/exams/provider";
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
  const { gone } = useExam();
  const locked = useExamLocked();
  const [dialog, setDialog] = useState<"delete" | "import" | null>(null);

  // A gone exam has no try to open.
  if (gone) {
    return null;
  }
  if (locked) {
    return <TryAsStudent />;
  }

  return (
    <>
      <ButtonGroup aria-label={t("exam-actions")}>
        <TryAsStudent />
        <DropdownMenu>
          <SplitMenuTrigger />
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

/**
 * Opens the exam as a student sees it. The link carries the button slot that ButtonGroup joins on:
 * without it the link kept its own corners and border, and the pair read as two buttons.
 */
function TryAsStudent() {
  const t = useTranslations("Exams");
  const { exam, slug } = useExam();

  return (
    <Link
      aria-label={t("try-action")}
      className={buttonVariants({ variant: "outline" })}
      data-slot="button"
      params={{ exam: exam.id, slug }}
      to="/school/$slug/exams/$exam/try"
    >
      <HugeIcons aria-hidden="true" icon={ViewIcon} />
      <span className="max-sm:sr-only">{t("try-action")}</span>
    </Link>
  );
}
