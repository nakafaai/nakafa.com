"use client";

import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { TryoutChoices } from "@/components/tryout/choice";
import type { TryoutRuntimeQuestion as RuntimeQuestion } from "@/components/tryout/types";

interface TryoutRuntimeQuestionProps {
  content: ReactNode;
  isLocked: boolean;
  isReviewMode: boolean;
  question: RuntimeQuestion;
  sectionStartedAt: number;
}

/** Renders one question with the original production exercise answer styling. */
export function TryoutRuntimeQuestion({
  content,
  isLocked,
  isReviewMode,
  question,
  sectionStartedAt,
}: TryoutRuntimeQuestionProps) {
  const tExercises = useTranslations("Exercises");
  const id = `question-${question.questionOrder}`;

  return (
    <article
      aria-labelledby={`${id}-title`}
      className="content-auto-exercise"
      id={`exercise-${id}`}
    >
      <div className="flex items-center gap-4">
        <a
          className="flex w-full flex-1 shrink-0 scroll-mt-44 outline-none ring-0"
          href={`#${id}`}
          id={id}
        >
          <div className="flex size-9 items-center justify-center rounded-full border border-primary bg-secondary text-secondary-foreground">
            <span className="font-mono text-xs tracking-tighter">
              {question.questionOrder}
            </span>
            <h2 className="sr-only" id={`${id}-title`}>
              {tExercises("number-count", { count: question.questionOrder })}
            </h2>
          </div>
        </a>

        <Button disabled type="button" variant="outline">
          {tExercises("explanation")}
          <HugeIcons
            className="transition-transform ease-out"
            icon={ArrowDown01Icon}
          />
        </Button>
      </div>

      {content ? <section className="my-6">{content}</section> : null}

      <section className="my-8">
        <TryoutChoices
          isLocked={isLocked}
          isReviewMode={isReviewMode}
          question={question}
          sectionStartedAt={sectionStartedAt}
        />
      </section>
    </article>
  );
}
