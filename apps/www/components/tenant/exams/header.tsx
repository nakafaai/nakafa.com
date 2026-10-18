"use client";

import { useMutation } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import { ExamTitle } from "@repo/backend/confect/exams/exam";
import { Input } from "@repo/design-system/components/ui/input";
import { isComposingKey } from "@repo/utilities/composition";
import { Function as Fn, Schema, String as Str } from "effect";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { runExamAction, sentAction } from "@/components/tenant/exams/action";
import { renameUpdate } from "@/components/tenant/exams/optimistic";
import { useExam } from "@/components/tenant/exams/provider";

/**
 * The exam's title, renamed in place. The title is saved when the field loses focus or
 * the teacher presses Enter, so the server only ever gets a whole, trimmed title. A
 * title that is empty goes back to the saved one at once, and a title that the server
 * refuses goes back to the saved one too.
 */
export function ExamHeader() {
  const t = useTranslations("Exams");
  const { exam, slug } = useExam();
  const [draft, setDraft] = useState(exam.title);
  const rename = useMutation(exams.exams.rename).withOptimisticUpdate(
    renameUpdate
  );

  function save() {
    const title = Str.trim(draft);

    if (title === exam.title || !Schema.is(ExamTitle)(title)) {
      setDraft(exam.title);
      return;
    }

    setDraft(title);
    runExamAction(
      sentAction(() => rename({ examId: exam.id, slug, title })),
      {
        onFailure: () => setDraft(exam.title),
        onSuccess: Fn.constVoid,
      }
    );
  }

  return (
    <header className="flex items-center gap-2 border-b p-4">
      <Input
        aria-label={t("title-label")}
        className="font-semibold"
        onBlur={save}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          // While the teacher composes a character, Enter belongs to the keyboard.
          if (event.key === "Enter" && !isComposingKey(event.nativeEvent)) {
            event.currentTarget.blur();
          }
        }}
        placeholder={t("untitled")}
        value={draft}
      />
    </header>
  );
}
