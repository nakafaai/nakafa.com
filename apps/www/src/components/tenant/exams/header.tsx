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
import { Function as Fn, Option } from "effect";
import { type ComponentProps, type ReactNode, useState } from "react";
import { useTranslations } from "use-intl";
import { useTenant } from "@/components/tenant/context";
import { runExamAction, sentAction } from "@/components/tenant/exams/action";
import { ExamMenu, ExamMenuFrame } from "@/components/tenant/exams/menu";
import { ExamOffline } from "@/components/tenant/exams/offline";
import { renameUpdate } from "@/components/tenant/exams/optimistic";
import { ExamPresence } from "@/components/tenant/exams/presence";
import { useExam } from "@/components/tenant/exams/provider";
import {
  ScheduleExam,
  ScheduleExamFrame,
} from "@/components/tenant/exams/schedule";
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
 * names for screen readers, so the title keeps room to read at 375 pixels. An exam of an archived unit says why it is locked in a line under the header
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
    <ExamHeaderRow>
      <BackToExams />
      <ExamTitleField
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
      <ExamOffline />
      <ExamPresence />
      <ExamMenu />
      {exam.archived || gone ? null : <ScheduleExam />}
    </ExamHeaderRow>
  );
}

/**
 * The editor's header before the exam is read, drawn from the first paint so that nothing in it appears late: the
 * link back to the exams, the title's field empty and read only, since a placeholder would read as the exam's
 * title, and the two buttons disabled. The buttons stand as an exam that takes changes shows them, so only an
 * archived unit's exam, which offers neither change, gives up some once it is read.
 */
export function ExamHeaderFrame() {
  return (
    <ExamHeaderRow>
      <BackToExams />
      <ExamTitleField placeholder="" readOnly value="" />
      <ExamMenuFrame />
      <ScheduleExamFrame />
    </ExamHeaderRow>
  );
}

/**
 * The bar of the editor's header and its row. Both run the screen's full width, as the editor's panes do, so on a
 * wide screen the row lines up with the canvas under it. It is the one page outside the page frame, as a design
 * tool's canvas is, and `data-canvas` says so to the frame's guard.
 */
function ExamHeaderRow({ children }: { children: ReactNode }) {
  return (
    <header className="h-14 shrink-0 border-b" data-slot="page-header">
      <div
        className="flex h-full w-full items-center gap-2 px-4"
        data-canvas=""
      >
        {children}
      </div>
    </header>
  );
}

/** The link back to the school's exams, an icon named in its tooltip. */
function BackToExams() {
  const t = useTranslations("Exams");
  const { slug } = useTenant();

  return (
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
  );
}

/**
 * The field of the exam's title, which takes the room the row leaves between the link and the buttons. Its text
 * starts 12px after the link, the player's distance from its back button to its title.
 */
function ExamTitleField(
  props: Omit<ComponentProps<typeof Input>, "aria-label" | "className" | "dir">
) {
  const t = useTranslations("Exams");

  return (
    <Input
      {...props}
      aria-label={t("title-label")}
      className="ms-1 min-w-0 flex-1 truncate border-0 px-1 text-lg font-semibold shadow-none md:text-lg"
      dir="auto"
    />
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
        <p className="text-muted-foreground px-4 py-2 text-sm">
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
      <p className="text-muted-foreground px-4 py-2 text-sm">
        {t("archived-note")}
      </p>
    </div>
  );
}
