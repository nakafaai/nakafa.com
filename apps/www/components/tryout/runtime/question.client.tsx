"use client";

import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { TryoutChoices } from "@/components/tryout/runtime/choice";
import type { TryoutRuntimeQuestion as RuntimeQuestion } from "@/components/tryout/runtime/types";

interface TryoutRuntimeQuestionValue {
  content: ReactNode;
  locked: boolean;
  question: RuntimeQuestion;
  reviewMode: boolean;
  sectionStartedAt: number;
}

/** Renders one question with the original production exercise answer styling. */
export function TryoutRuntimeQuestion({
  value,
}: {
  value: TryoutRuntimeQuestionValue;
}) {
  const tExercises = useTranslations("Exercises");
  const { content, locked, question, reviewMode, sectionStartedAt } = value;
  const id = `question-${question.questionOrder}`;

  return (
    <article aria-labelledby={`${id}-title`} id={`exercise-${id}`}>
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
          value={{
            locked,
            question,
            reviewMode,
            sectionStartedAt,
          }}
        />
      </section>
    </article>
  );
}
