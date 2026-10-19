"use client";

import { useMutation } from "@confect/react";
import { ArrowLeft01Icon, ViewIcon } from "@hugeicons/core-free-icons";
import exams from "@repo/backend/confect/_generated/refs/exams";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Input } from "@repo/design-system/components/ui/input";
import { buttonVariants } from "@repo/design-system/lib/button";
import { isComposingKey } from "@repo/utilities/composition";
import { Function as Fn, Option } from "effect";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { runExamAction, sentAction } from "@/components/tenant/exams/action";
import { isFrozen } from "@/components/tenant/exams/freeze";
import { renameUpdate } from "@/components/tenant/exams/optimistic";
import { useExam } from "@/components/tenant/exams/provider";
import { ScheduleExam } from "@/components/tenant/exams/schedule";
import { titleToSave } from "@/components/tenant/exams/title";

/**
 * The header of the editor: a link back to the exams, then the exam's title, renamed in
 * place. The field shows the saved title until the teacher types, so it follows a
 * co-editor's rename. The title is saved when the field loses focus or the teacher presses
 * Enter, and only a trimmed, changed, valid title is sent. The optimistic change restores
 * the saved title when the server refuses the rename. The row ends with the action that
 * tries the exam as a student and the button that schedules it, and the title gives way
 * before them. On a phone the trial action keeps its icon and its name for screen readers,
 * so the title keeps room to read at 375 pixels. A frozen exam says why its questions are
 * fixed in a line under the header (ExamFrozenNote).
 */
export function ExamHeader() {
  const t = useTranslations("Exams");
  const { exam, slug } = useExam();
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
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-2">
      <Link
        aria-label={t("title")}
        className={buttonVariants({ size: "icon", variant: "ghost" })}
        href="/exams"
      >
        <HugeIcons icon={ArrowLeft01Icon} />
      </Link>
      <Input
        aria-label={t("title-label")}
        className="border-0 font-semibold text-lg shadow-none md:text-lg"
        onBlur={save}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          // While the teacher composes a character, Enter belongs to the keyboard.
          if (event.key === "Enter" && !isComposingKey(event.nativeEvent)) {
            event.currentTarget.blur();
          }
        }}
        placeholder={t("untitled")}
        value={draft ?? exam.title}
      />
      <Link
        className={buttonVariants({ variant: "outline" })}
        href={`/exams/${exam.id}/try`}
      >
        <HugeIcons icon={ViewIcon} />
        <span className="max-sm:sr-only">{t("try-action")}</span>
      </Link>
      <ScheduleExam />
    </header>
  );
}

/**
 * The sentence a scheduled exam's editor shows under its header, across the page, so it
 * wraps on a phone instead of being cut short beside the title.
 */
export function ExamFrozenNote() {
  const t = useTranslations("Exams");
  const { exam } = useExam();
  if (!isFrozen(exam)) {
    return null;
  }

  return (
    <p className="border-b px-4 py-2 text-muted-foreground text-sm">
      {t("frozen-note")}
    </p>
  );
}
