"use client";

import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@repo/design-system/components/ui/collapsible";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Separator } from "@repo/design-system/components/ui/separator";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { TryoutChoices } from "@/components/tryout/runtime/choice";
import type { TryoutRuntimeQuestion as RuntimeQuestion } from "@/components/tryout/runtime/types";

interface TryoutRuntimeQuestionValue {
  answer: ReactNode | null;
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
  const { answer, content, locked, question, reviewMode, sectionStartedAt } =
    value;
  const id = `question-${question.questionOrder}`;
  const explanationId = `${id}-explanation`;

  return (
    <Collapsible disabled={!(reviewMode && answer)}>
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

          <CollapsibleTrigger
            className="group"
            render={
              <Button disabled={!reviewMode} type="button" variant="outline" />
            }
          >
            {tExercises("explanation")}
            <HugeIcons
              className="transition-transform ease-out group-data-[panel-open]:rotate-180"
              icon={ArrowDown01Icon}
            />
          </CollapsibleTrigger>
        </div>

        <section className="my-6">{content}</section>

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

        <TryoutQuestionExplanation
          value={{ answer, explanationId, reviewMode }}
        />
      </article>
    </Collapsible>
  );
}

/** Renders authored answer content only in an authorized review runtime. */
function TryoutQuestionExplanation({
  value,
}: {
  value: {
    answer: ReactNode | null;
    explanationId: string;
    reviewMode: boolean;
  };
}) {
  const tExercises = useTranslations("Exercises");

  if (!(value.reviewMode && value.answer)) {
    return null;
  }

  return (
    <CollapsiblePanel>
      <section aria-labelledby={value.explanationId} className="space-y-6 pb-8">
        <Separator />
        <h3
          className="scroll-mt-44 font-medium text-lg"
          id={value.explanationId}
        >
          {tExercises("explanation")}
        </h3>
        {value.answer}
      </section>
    </CollapsiblePanel>
  );
}
