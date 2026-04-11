import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";
import type { Locale } from "next-intl";
import type { ReactNode } from "react";
import { ExerciseAnswer } from "@/components/exercise/render/answer";
import { ExerciseAnswerAction } from "@/components/exercise/render/answer-action";
import { ExerciseChoices } from "@/components/exercise/render/choices";

interface ExerciseArticleProps {
  answerContent: ReactNode;
  choices: ExercisesChoices[Locale];
  exerciseNumber: number;
  id: string;
  questionContent: ReactNode;
  srLabel: string;
}

/** Renders one exercise article with question, answer controls, choices, and explanation. */
export function ExerciseArticle({
  answerContent,
  choices,
  exerciseNumber,
  id,
  questionContent,
  srLabel,
}: ExerciseArticleProps) {
  return (
    <article aria-labelledby={`exercise-${id}-title`}>
      <div className="flex items-center gap-4">
        <a
          className="flex w-full flex-1 shrink-0 scroll-mt-44 outline-none ring-0"
          href={`#${id}`}
          id={id}
        >
          <div className="flex size-9 items-center justify-center rounded-full border border-primary bg-secondary text-secondary-foreground">
            <span className="font-mono text-xs tracking-tighter">
              {exerciseNumber}
            </span>
            <h2 className="sr-only" id={`exercise-${id}-title`}>
              {srLabel}
            </h2>
          </div>
        </a>
        <ExerciseAnswerAction exerciseNumber={exerciseNumber} />
      </div>

      <section className="my-6">{questionContent}</section>

      <section className="my-8">
        <ExerciseChoices
          choices={choices}
          exerciseNumber={exerciseNumber}
          id={id}
        />
      </section>

      <ExerciseAnswer exerciseNumber={exerciseNumber}>
        {answerContent}
      </ExerciseAnswer>
    </article>
  );
}
