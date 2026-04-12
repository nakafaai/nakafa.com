import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";
import type { Locale } from "next-intl";
import type { ReactNode } from "react";
import { ExerciseAnswerAction } from "@/components/exercise/item/action";
import { ExerciseAnswer } from "@/components/exercise/item/answer";
import { ExerciseChoices } from "@/components/exercise/item/choices";

/** Renders one exercise article with question, answer controls, choices, and explanation. */
export function ExerciseArticle({
  answerContent,
  choices,
  exerciseNumber,
  id,
  questionContent,
  srLabel,
}: {
  answerContent: ReactNode;
  choices: ExercisesChoices[Locale];
  exerciseNumber: number;
  id: string;
  questionContent: ReactNode;
  srLabel: string;
}) {
  const articleId = `exercise-${id}`;

  return (
    <article aria-labelledby={`exercise-${id}-title`} id={articleId}>
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
