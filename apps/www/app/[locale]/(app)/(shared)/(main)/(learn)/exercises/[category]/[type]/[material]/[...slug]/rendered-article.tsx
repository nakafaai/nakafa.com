import { importContentModule } from "@repo/contents/_lib/module";
import type { ExerciseWithoutDefaults } from "@repo/contents/_types/exercises/shared";
import { slugify } from "@repo/design-system/lib/utils";
import type { Locale } from "next-intl";
import { ExerciseArticle } from "@/components/exercise/render/article";
import { QuestionAnalytics } from "@/components/exercise/render/question-analytics";

async function getExerciseContentModules(
  locale: Locale,
  setPath: string,
  exerciseNumber: number
) {
  const entryPath = `${setPath}/${exerciseNumber}`;

  const [question, answer] = await Promise.all([
    importContentModule(`${entryPath}/_question`, locale).catch(() => null),
    importContentModule(`${entryPath}/_answer`, locale).catch(() => null),
  ]);

  return {
    Answer: answer?.default,
    Question: question?.default,
  };
}

/** Renders one set exercise inside analytics tracking with its compiled MDX content. */
export async function ExerciseSetArticle({
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
  const { Answer, Question } = await getExerciseContentModules(
    locale,
    setPath,
    exercise.number
  );

  return (
    <QuestionAnalytics exerciseNumber={exercise.number}>
      <ExerciseArticle
        answerContent={Answer ? <Answer /> : null}
        choices={exercise.choices[locale]}
        exerciseNumber={exercise.number}
        id={id}
        questionContent={Question ? <Question /> : null}
        srLabel={srLabel}
      />
    </QuestionAnalytics>
  );
}

/** Renders one standalone exercise without the set-level analytics wrapper. */
export async function SingleExerciseArticle({
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
  const { Answer, Question } = await getExerciseContentModules(
    locale,
    setPath,
    exercise.number
  );

  return (
    <ExerciseArticle
      answerContent={Answer ? <Answer /> : null}
      choices={exercise.choices[locale]}
      exerciseNumber={exercise.number}
      id={id}
      questionContent={Question ? <Question /> : null}
      srLabel={srLabel}
    />
  );
}
