"use client";

import { Add01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Array as Arr, Option } from "effect";
import { useTranslations } from "next-intl";
import type { RefObject } from "react";
import { useQuestionActions } from "@/components/tenant/exams/actions";
import { isLocked } from "@/components/tenant/exams/freeze";
import { ExamPage } from "@/components/tenant/exams/page";
import { pageAt } from "@/components/tenant/exams/pages";
import {
  useActiveQuestion,
  useExam,
  useExamSelection,
} from "@/components/tenant/exams/provider";

/**
 * The distance, in pixels from the top of the canvas, at which a page counts as the one in view:
 * the page whose top has passed this line is the page the teacher is on.
 */
const PAGE_LINE = 96;

/**
 * The canvas of the exam: every question as a page, stacked in order with one gap between them,
 * on a muted ground that scrolls. Each page is its paper at the chosen zoom, and an add button
 * below the last page adds a question at the end. The page the teacher is on follows the scroll,
 * so the footer's position names it. A frozen exam shows its pages without the add button.
 */
export function ExamCanvas({
  canvas,
  zoom,
}: {
  canvas: RefObject<HTMLElement | null>;
  zoom: number;
}) {
  const t = useTranslations("Exams");
  const { exam } = useExam();
  const frozen = isLocked(exam);
  const select = useExamSelection((state) => state.select);
  const active = useActiveQuestion();
  const actions = useQuestionActions();

  /** Chooses the page at the top of the canvas as the one the teacher is on, when the scroll brings a new one. */
  const syncPage = () => {
    const root = canvas.current;
    if (root === null) {
      return;
    }
    const top = root.getBoundingClientRect().top;
    const tops = Arr.map(
      Arr.fromIterable(root.querySelectorAll<HTMLElement>("[data-page]")),
      (page) => page.getBoundingClientRect().top - top
    );
    const index = pageAt(tops, PAGE_LINE);
    Option.match(Arr.get(exam.questions, index), {
      onNone: () => undefined,
      onSome: (question) => {
        if (
          Option.getOrNull(
            Option.map(active, (current) => current.question.id)
          ) !== question.id
        ) {
          select(question.id);
        }
      },
    });
  };

  return (
    <section
      aria-label={t("pages-label")}
      className="relative min-h-0 min-w-0 flex-1 overflow-y-auto bg-muted/40"
      onScroll={syncPage}
      ref={canvas}
    >
      <div
        className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-6 md:px-6"
        style={{ zoom: zoom / 100 }}
      >
        {Arr.map(exam.questions, (question, index) => (
          <ExamPage
            canvas={canvas}
            count={exam.questions.length}
            index={index}
            key={question.id}
            question={question}
          />
        ))}
        {frozen ? null : (
          <div>
            <Button
              onClick={() => actions.addQuestion(null)}
              type="button"
              variant="outline"
            >
              <HugeIcons aria-hidden="true" icon={Add01Icon} />
              {t("add-question")}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
