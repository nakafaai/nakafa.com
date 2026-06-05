import type { ExerciseWithoutDefaults } from "@repo/contents/_types/exercises/shared";
import { slugify } from "@repo/design-system/lib/utils";
import type { Locale } from "next-intl";
import { Suspense } from "react";
import { QuestionAnalytics } from "@/components/exercise/item/analytics";
import { ExerciseArticle } from "@/components/exercise/item/article";
import { importContentModuleOrNull } from "@/lib/content/module";

/** Loads the compiled question module for one exercise entry. */
async function QuestionContent({
  exerciseNumber,
  locale,
  setPath,
}: {
  exerciseNumber: number;
  locale: Locale;
  setPath: string;
}) {
  const questionPath = `${setPath}/${exerciseNumber}/_question`;
  const question = await importContentModuleOrNull({
    context: {
      exercise_number: exerciseNumber,
    },
    filePath: questionPath,
    locale,
    source: "exercise-question-module",
  });
  const Question = question?.default;

  return Question ? <Question /> : null;
}

/** Loads the compiled answer module for one exercise entry. */
async function AnswerContent({
  exerciseNumber,
  locale,
  setPath,
}: {
  exerciseNumber: number;
  locale: Locale;
  setPath: string;
}) {
  const answerPath = `${setPath}/${exerciseNumber}/_answer`;
  const answer = await importContentModuleOrNull({
    context: {
      exercise_number: exerciseNumber,
    },
    filePath: answerPath,
    locale,
    source: "exercise-answer-module",
  });
  const Answer = answer?.default;

  return Answer ? <Answer /> : null;
}

/** Builds the shared exercise article body used by learn and try-out routes. */
function ExerciseEntryBody({
  exercise,
  id,
  locale,
  setPath,
  srLabel,
}: {
  exercise: ExerciseWithoutDefaults;
  id: string;
  locale: Locale;
  setPath: string;
  srLabel: string;
}) {
  return (
    <ExerciseArticle
      answerContent={
        <Suspense fallback={null}>
          <AnswerContent
            exerciseNumber={exercise.number}
            locale={locale}
            setPath={setPath}
          />
        </Suspense>
      }
      choices={exercise.choices[locale]}
      exerciseNumber={exercise.number}
      id={id}
      questionContent={
        <QuestionContent
          exerciseNumber={exercise.number}
          locale={locale}
          setPath={setPath}
        />
      }
      srLabel={srLabel}
    />
  );
}

/** Renders one exercise entry without analytics tracking. */
export function ExerciseEntry({
  exercise,
  locale,
  setPath,
  srLabel,
}: {
  exercise: ExerciseWithoutDefaults;
  locale: Locale;
  setPath: string;
  srLabel: string;
}) {
  const id = slugify(srLabel);

  return (
    <ExerciseEntryBody
      exercise={exercise}
      id={id}
      locale={locale}
      setPath={setPath}
      srLabel={srLabel}
    />
  );
}

/** Renders one exercise entry inside viewport analytics tracking. */
export function ExerciseTrackedEntry({
  exercise,
  locale,
  setPath,
  srLabel,
}: {
  exercise: ExerciseWithoutDefaults;
  locale: Locale;
  setPath: string;
  srLabel: string;
}) {
  const id = slugify(srLabel);

  return (
    <>
      <QuestionAnalytics
        articleId={`exercise-${id}`}
        exerciseNumber={exercise.number}
      />
      <ExerciseEntryBody
        exercise={exercise}
        id={id}
        locale={locale}
        setPath={setPath}
        srLabel={srLabel}
      />
    </>
  );
}
