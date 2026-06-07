import {
  getCurrentMaterial,
  getMaterials,
} from "@repo/contents/_lib/exercises/material";
import { getMaterialPath } from "@repo/contents/_lib/exercises/route";
import { ExercisesCategorySchema } from "@repo/contents/_types/exercises/category";
import { ExercisesMaterialSchema } from "@repo/contents/_types/exercises/material";
import { ExercisesTypeSchema } from "@repo/contents/_types/exercises/type";
import { Effect, Option, Schema } from "effect";
import { cacheLife } from "next/cache";
import type { Locale } from "next-intl";
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

  cacheLife("seconds");

  return await Effect.runPromise(getLlmsExerciseText({ cleanSlug, locale }));
}

/** Builds uncached exercise markdown from source content. */
export const getLlmsExerciseText = Effect.fn("www.llms.exercises.text")(
  function* ({ cleanSlug, locale }: { cleanSlug: string; locale: Locale }) {
    if (!cleanSlug.startsWith("exercises")) {
      return null;
    }

    const { exerciseNumber, path } = getExerciseMarkdownTarget(cleanSlug);
    const exercises = yield* getExerciseRows({ locale, path });

    if (exercises.length === 0) {
      return null;
    }

    let targetExercises = exercises;

    if (Option.isSome(exerciseNumber)) {
      targetExercises = exercises.filter(
        (exercise) => exercise.number === exerciseNumber.value
      );
    }

    if (targetExercises.length === 0) {
      return null;
    }

    const description = yield* getExerciseDescription({
      exerciseNumber,
      locale,
      path,
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

/** Loads exercise rows from the existing content package source. */
const getExerciseRows = Effect.fn("www.llms.exercises.rows")(function* ({
  locale,
  path,
}: {
  locale: Locale;
  path: string;
}) {
  const setPage = yield* getRuntimeExerciseSetPage({
    locale,
    slug: path,
  });

  return setPage?.exercises ?? [];
});

type ExerciseRows = Effect.Effect.Success<ReturnType<typeof getExerciseRows>>;

/** Builds the markdown document description for an exercise page. */
const getExerciseDescription = Effect.fn("www.llms.exercises.description")(
  function* ({
    exerciseNumber,
    locale,
    path,
    targetExercises,
  }: {
    exerciseNumber: Option.Option<number>;
    locale: Locale;
    path: string;
    targetExercises: ExerciseRows;
  }) {
    const description = yield* getExerciseSetDescription({ locale, path });

    if (Option.isNone(exerciseNumber)) {
      return description;
    }

    const exerciseTitle = targetExercises[0]?.question.metadata.title;

    if (exerciseTitle) {
      return `${description} - ${exerciseTitle}`;
    }

    return `${description} - Question ${exerciseNumber.value}`;
  }
);

/** Resolves the existing material title and description for an exercise set. */
const getExerciseSetDescription = Effect.fn(
  "www.llms.exercises.setDescription"
)(function* ({ locale, path }: { locale: Locale; path: string }) {
  const pathParts = path.split("/");
  const category = pathParts.at(1);
  const type = pathParts.at(2);
  const material = pathParts.at(3);
  const parsedCategory = Schema.decodeUnknownOption(ExercisesCategorySchema)(
    category
  );
  const parsedType = Schema.decodeUnknownOption(ExercisesTypeSchema)(type);
  const parsedMaterial = Schema.decodeUnknownOption(ExercisesMaterialSchema)(
    material
  );

  if (
    Option.isNone(parsedCategory) ||
    Option.isNone(parsedType) ||
    Option.isNone(parsedMaterial)
  ) {
    return "Exercises Content";
  }

  const materialPath = getMaterialPath(
    parsedCategory.value,
    parsedType.value,
    parsedMaterial.value
  );
  const materialsList = yield* getMaterials(materialPath, locale);
  const { currentMaterial, currentMaterialItem } = getCurrentMaterial(
    `/${path}`,
    materialsList
  );

  if (Option.isNone(currentMaterial) || Option.isNone(currentMaterialItem)) {
    return "Exercises Content";
  }

  if (currentMaterial.value.description) {
    return `Exercises: ${currentMaterial.value.title} - ${currentMaterialItem.value.title}: ${currentMaterial.value.description}`;
  }

  return `Exercises: ${currentMaterial.value.title} - ${currentMaterialItem.value.title}`;
});
