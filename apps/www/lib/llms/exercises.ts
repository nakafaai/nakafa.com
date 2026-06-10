import { Effect, Option } from "effect";
import type { Locale } from "next-intl";
import { applyContentRuntimeCache } from "@/lib/content/cache";
import { getRuntimeExerciseSetPage } from "@/lib/content/runtime";
import { BASE_URL, NUMBER_SEGMENT } from "@/lib/llms/constants";
import { buildHeader } from "@/lib/llms/format";

/** Runs the cached exercise markdown Effect at the Next cache boundary. */
export async function getCachedLlmsExerciseText({
  cleanSlug,
  locale,
}: {
  cleanSlug: string;
  locale: Locale;
}) {
  "use cache";

  applyContentRuntimeCache();

  return await Effect.runPromise(getLlmsExerciseText({ cleanSlug, locale }));
}

/** Builds uncached exercise markdown from source content. */
export const getLlmsExerciseText = Effect.fn("www.llms.exercises.text")(
  function* ({ cleanSlug, locale }: { cleanSlug: string; locale: Locale }) {
    if (!cleanSlug.startsWith("exercises")) {
      return null;
    }

    const { exerciseNumber, path } = getExerciseMarkdownTarget(cleanSlug);
    const setPage = yield* getRuntimeExerciseSetPage({
      locale,
      slug: path,
    });

    if (!setPage) {
      return null;
    }

    let targetExercises = setPage.exercises;

    if (Option.isSome(exerciseNumber)) {
      targetExercises = setPage.exercises.filter(
        (exercise) => exercise.number === exerciseNumber.value
      );
    }

    if (targetExercises.length === 0) {
      return null;
    }

    const description = getExerciseDescription({
      exerciseNumber,
      setPage,
      targetExercises,
    });
    const scanned = buildHeader({
      url: `${BASE_URL}/${locale}/${cleanSlug}`,
      description,
    });

    for (const exercise of targetExercises) {
      scanned.push(`## Exercise ${exercise.number}`);
      scanned.push("");
      scanned.push("### Question");
      scanned.push("");
      scanned.push(exercise.question.raw);
      scanned.push("");
      scanned.push("### Choices");
      scanned.push("");

      const choices =
        (locale === "id" ? exercise.choices.id : exercise.choices.en) ||
        exercise.choices.en;

      if (choices) {
        for (const choice of choices) {
          const mark = choice.value ? "x" : " ";
          scanned.push(`- [${mark}] ${choice.label}`);
        }
      }

      scanned.push("");
      scanned.push("### Answer & Explanation");
      scanned.push("");
      scanned.push(exercise.answer.raw);
      scanned.push("");
      scanned.push("---");
      scanned.push("");
    }

    return scanned.join("\n");
  }
);

/** Finds the exercise set path and optional question number from a route. */
function getExerciseMarkdownTarget(cleanSlug: string) {
  const parts = cleanSlug.split("/");
  const lastPart = parts.at(-1);

  if (!(lastPart && NUMBER_SEGMENT.test(lastPart))) {
    return {
      exerciseNumber: Option.none(),
      path: cleanSlug,
    };
  }

  return {
    exerciseNumber: Option.some(Number.parseInt(lastPart, 10)),
    path: parts.slice(0, -1).join("/"),
  };
}

type ExerciseSetPage = NonNullable<
  Effect.Effect.Success<ReturnType<typeof getRuntimeExerciseSetPage>>
>;
type ExerciseRows = ExerciseSetPage["exercises"];

/** Builds the markdown document description for an exercise page. */
function getExerciseDescription({
  exerciseNumber,
  setPage,
  targetExercises,
}: {
  exerciseNumber: Option.Option<number>;
  setPage: ExerciseSetPage;
  targetExercises: ExerciseRows;
}) {
  const description = getExerciseSetDescription(setPage);

  if (Option.isNone(exerciseNumber)) {
    return description;
  }

  const exerciseTitle = targetExercises[0]?.question.metadata.title;

  if (exerciseTitle) {
    return `${description} - ${exerciseTitle}`;
  }

  return `${description} - Question ${exerciseNumber.value}`;
}

/** Resolves the markdown description for an exercise set page. */
function getExerciseSetDescription(setPage: ExerciseSetPage) {
  if (setPage.description) {
    return setPage.description;
  }

  return setPage.title;
}
