import type { Exercise } from "@repo/contents/_types/exercises/shared";
import type { Locale } from "next-intl";
import { ExerciseAnswerAction } from "./actions";
import { ExerciseAnswer } from "./answer";
import { ExerciseChoices } from "./choices";

interface Props {
  exercise: Exercise;
  locale: Locale;
  id: string;
  srLabel: string;
}

export function ExerciseArticle({ exercise, locale, id, srLabel }: Props) {
  return (
    <article aria-labelledby={`exercise-${id}-title`} className="scroll-smooth">
      <div className="flex items-center gap-4">
        <a
          className="flex w-full flex-1 shrink-0 scroll-mt-44 outline-none ring-0"
          href={`#${id}`}
          id={id}
        >
          <div className="flex size-9 items-center justify-center rounded-full border border-primary bg-secondary text-secondary-foreground">
            <span className="font-mono text-xs tracking-tighter">
              {exercise.number}
            </span>
            <h2 className="sr-only" id={`exercise-${id}-title`}>
              {srLabel}
            </h2>
          </div>
        </a>
        <ExerciseAnswerAction exerciseNumber={exercise.number} />
      </div>

      <section className="my-6">{exercise.question.default}</section>

      <section className="my-8">
        <ExerciseChoices
          choices={exercise.choices[locale]}
          exerciseNumber={exercise.number}
          id={id}
        />
      </section>

      <ExerciseAnswer exerciseNumber={exercise.number}>
        {exercise.answer.default}
      </ExerciseAnswer>
    </article>
  );
}
