import {
  Copy01Icon,
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
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { buttonVariants } from "@repo/design-system/lib/button";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { SplitMenuTrigger } from "@/components/shared/split";
import { DeleteExam } from "@/components/tenant/exams/delete";
import { useDuplicateExam } from "@/components/tenant/exams/duplicate";
import { ImportQuestions } from "@/components/tenant/exams/import/dialog";
import { ExamLockMark } from "@/components/tenant/exams/lock";
import { useExam, useExamLocked } from "@/components/tenant/exams/provider";
import { Link } from "@/lib/routing/link";

/**
 * The editor's secondary action with the rest joined to it, as Google Docs and Canva show them: Try
 * as student as one button, and a menu beside it of what a teacher reaches less often, Import, Duplicate and
 * Delete exam, each opening its dialog. With Schedule, the main action, the header shows two buttons.
 * A locked exam takes neither change, so Try as student stands alone. On a phone the button keeps its
 * icon and its name for screen readers.
 */
export function ExamMenu() {
  const t = useTranslations("Exams");
  const { exam, gone, slug } = useExam();
  const locked = useExamLocked();
  const [dialog, setDialog] = useState<"delete" | "import" | null>(null);
  const { isPending, press } = useDuplicateExam(exam, slug);

  // A gone exam has no try to open.
  if (gone) {
    return null;
  }
  if (locked) {
    return (
      <ButtonGroup aria-label={t("exam-actions")}>
        <TryAsStudent />
        <ExamLockMark />
      </ButtonGroup>
    );
  }

  return (
    <>
      <ButtonGroup aria-label={t("exam-actions")}>
        <TryAsStudent />
        <DropdownMenu>
          <SplitMenuTrigger />
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => setDialog("import")}>
                <HugeIcons icon={FileImportIcon} />
                {t("import-action")}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={isPending} onClick={press}>
                <HugeIcons icon={Copy01Icon} />
                {t("duplicate-action")}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
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
 * The editor's actions before the exam is read: Try as student and the menu joined to it, as an exam that takes
 * changes shows them, disabled.
 */
export function ExamMenuFrame() {
  const t = useTranslations("Exams");

  return (
    <ButtonGroup aria-label={t("exam-actions")}>
      <Button aria-label={t("try-action")} disabled variant="outline">
        <TryAsStudentLabel />
      </Button>
      <DropdownMenu disabled>
        <SplitMenuTrigger />
      </DropdownMenu>
    </ButtonGroup>
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
      <TryAsStudentLabel />
    </Link>
  );
}

/** The icon and the words of Try as student, the words for screen readers alone on a phone. */
function TryAsStudentLabel() {
  const t = useTranslations("Exams");

  return (
    <>
      <HugeIcons aria-hidden="true" icon={ViewIcon} />
      <span className="max-sm:sr-only">{t("try-action")}</span>
    </>
  );
}
