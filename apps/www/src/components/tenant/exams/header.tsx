import { useMutation } from "@confect/react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import exams from "@repo/backend/confect/_generated/refs/exams";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Input } from "@repo/design-system/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { buttonVariants } from "@repo/design-system/lib/button";
import { isComposingKey } from "@repo/utilities/composition";
import { cn } from "cn";
import { Function as Fn, Option } from "effect";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { contentWidthVariants } from "@/components/shared/content/width";
import { runExamAction, sentAction } from "@/components/tenant/exams/action";
import { ExamMenu } from "@/components/tenant/exams/menu";
import { renameUpdate } from "@/components/tenant/exams/optimistic";
import { ExamPresence } from "@/components/tenant/exams/presence";
import { useExam } from "@/components/tenant/exams/provider";
import { ScheduleExam } from "@/components/tenant/exams/schedule";
import { titleToSave } from "@/components/tenant/exams/title";
import { ExamGone } from "@/components/tenant/exams/unavailable";
import { Link } from "@/lib/routing/link";

/**
 * The header of the editor: a link back to the exams, then the exam's title, renamed in place,
 * which an archived unit's exam does not take. The field shows the saved title until the teacher
 * types, so it follows a co-editor's rename. The title is saved when the field loses focus or the
 * teacher presses Enter, and only a trimmed, changed, valid title is sent. The optimistic change
 * restores the saved title when the server refuses the rename. The row ends with the other teachers
 * in the exam (ExamPresence) and two buttons at most: Try as student with a menu of the rarer actions
 * joined to it (ExamMenu), and Schedule, the main action. The title takes the room left between
 * them, truncated while the field is not focused. On a phone the buttons keep their icons and their
 * names for screen readers, so the title keeps room to read at 375 pixels. The bar and its border run
 * the page's full width, and its row keeps the page width of the editor's panes, so on a wide screen the
 * row lines up with them. An exam of an archived unit says why it is locked in a line under the header
 * (ExamLockedNote), and a gone exam keeps its title with neither button.
 */
export function ExamHeader() {
  const t = useTranslations("Exams");
  const { exam, gone, slug } = useExam();
  const [draft, setDraft] = useState<string | null>(null);
  const rename = useMutation(exams.exams.rename).withOptimisticUpdate(
    renameUpdate
  );

  function save() {
    const title = titleToSave(draft, exam.title);
    setDraft(null);
    if (Option.isNone(title)) {
      return;
    }
    runExamAction(
      sentAction(() => rename({ examId: exam.id, slug, title: title.value })),
      {
        onFailure: Fn.constVoid,
        onSuccess: Fn.constVoid,
      }
    );
  }

  return (
    <header className="shrink-0 border-b" data-slot="page-header">
      <div
        className={cn(
          contentWidthVariants({ width: "page" }),
          "flex h-14 w-full items-center gap-2 px-2"
        )}
      >
        <Tooltip>
          <TooltipTrigger
            render={
              <Link
                aria-label={t("title")}
                className={buttonVariants({ size: "icon", variant: "outline" })}
                params={{ slug }}
                to="/school/$slug/exams"
              />
            }
          >
            <HugeIcons icon={ArrowLeft01Icon} />
          </TooltipTrigger>
          <TooltipContent side="bottom">{t("title")}</TooltipContent>
        </Tooltip>
        <Input
          aria-label={t("title-label")}
          className="min-w-0 flex-1 truncate border-0 font-semibold text-lg shadow-none md:text-lg"
          dir="auto"
          onBlur={save}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            // While the teacher composes a character, Enter belongs to the keyboard.
            if (event.key === "Enter" && !isComposingKey(event.nativeEvent)) {
              event.currentTarget.blur();
            }
          }}
          placeholder={t("untitled")}
          readOnly={exam.archived || gone}
          value={draft ?? exam.title}
        />
        <ExamPresence />
        <ExamMenu />
        {exam.archived || gone ? null : <ScheduleExam />}
      </div>
    </header>
  );
}

/**
 * The sentence the editor shows under its header, across the page: that the unit holding the exam is
 * archived, which locks it, or that the exam is gone, with the way back to the exams. A scheduled or
 * running exam takes changes, and a finished one reads as fixed without a sentence. It wraps on a phone instead of being cut short
 * beside the title.
 */
export function ExamLockedNote() {
  const t = useTranslations("Exams");
  const { exam, gone } = useExam();
  if (gone) {
    return (
      <div className="border-b">
        <p
          className={cn(
            contentWidthVariants({ width: "page" }),
            "px-4 py-2 text-muted-foreground text-sm"
          )}
        >
          <ExamGone />
        </p>
      </div>
    );
  }
  // A finished exam reads as fixed on its own; only an archived unit says why its exam is locked.
  if (!exam.archived) {
    return null;
  }

  return (
    <div className="border-b">
      <p
        className={cn(
          contentWidthVariants({ width: "page" }),
          "px-4 py-2 text-muted-foreground text-sm"
        )}
      >
        {t("archived-note")}
      </p>
    </div>
  );
}
