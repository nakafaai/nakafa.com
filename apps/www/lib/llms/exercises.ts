import {
  getCurrentMaterial,
  getMaterialPath,
  getMaterials,
} from "@repo/contents/_lib/exercises/material";
import { getRenderableExercisesContent } from "@repo/contents/_lib/exercises/renderable";
import { ExercisesCategorySchema } from "@repo/contents/_types/exercises/category";
import { ExercisesMaterialSchema } from "@repo/contents/_types/exercises/material";
import { ExercisesTypeSchema } from "@repo/contents/_types/exercises/type";
import { cacheLife } from "next/cache";
import type { Locale } from "next-intl";
import { BASE_URL, NUMBER_SEGMENT } from "@/lib/llms/constants";
import { buildHeader } from "@/lib/llms/format";

/** Builds markdown for an exercise set or a single exercise question. */
export async function getCachedLlmsExerciseText({
  cleanSlug,
  locale,
}: {
  cleanSlug: string;
  locale: Locale;
}) {
  "use cache";

  cacheLife("max");

  return await getLlmsExerciseText({ cleanSlug, locale });
}

/** Builds uncached exercise markdown from source content. */
export async function getLlmsExerciseText({
  cleanSlug,
  locale,
}: {
  cleanSlug: string;
  locale: Locale;
}) {
  if (!cleanSlug.startsWith("exercises")) {
    return null;
  }

  const { exerciseNumber, path } = getExerciseMarkdownTarget(cleanSlug);
  const exercises = await getExerciseRows({ locale, path });

  if (exercises.length === 0) {
    return null;
  }

  let targetExercises = exercises;

  if (exerciseNumber !== null) {
    targetExercises = exercises.filter(
      (exercise) => exercise.number === exerciseNumber
    );
  }

  if (targetExercises.length === 0) {
    return null;
  }

  const description = await getExerciseDescription({
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

/** Finds the exercise set path and optional question number from a route. */
function getExerciseMarkdownTarget(cleanSlug: string) {
  const parts = cleanSlug.split("/");
  const lastPart = parts.at(-1);

  if (!(lastPart && NUMBER_SEGMENT.test(lastPart))) {
    return {
      exerciseNumber: null,
      path: cleanSlug,
    };
  }

  return {
    exerciseNumber: Number.parseInt(lastPart, 10),
    path: parts.slice(0, -1).join("/"),
  };
}

/** Loads exercise rows from the existing content package source. */
async function getExerciseRows({
  locale,
  path,
}: {
  locale: Locale;
  path: string;
}) {
  return await getRenderableExercisesContent(locale, path);
}

/** Builds the markdown document description for an exercise page. */
async function getExerciseDescription({
  exerciseNumber,
  locale,
  path,
  targetExercises,
}: {
  exerciseNumber: number | null;
  locale: Locale;
  path: string;
  targetExercises: Awaited<ReturnType<typeof getExerciseRows>>;
}) {
  const description = await getExerciseSetDescription({ locale, path });

  if (exerciseNumber === null) {
    return description;
  }

  const exerciseTitle = targetExercises[0]?.question.metadata.title;

  if (exerciseTitle) {
    return `${description} - ${exerciseTitle}`;
  }

  return `${description} - Question ${exerciseNumber}`;
}

/** Resolves the existing material title and description for an exercise set. */
async function getExerciseSetDescription({
  locale,
  path,
}: {
  locale: Locale;
  path: string;
}) {
  const pathParts = path.split("/");
  const category = pathParts.at(1);
  const type = pathParts.at(2);
  const material = pathParts.at(3);
  const parsedCategory = ExercisesCategorySchema.safeParse(category);
  const parsedType = ExercisesTypeSchema.safeParse(type);
  const parsedMaterial = ExercisesMaterialSchema.safeParse(material);

  if (
    !(parsedCategory.success && parsedType.success && parsedMaterial.success)
  ) {
    return "Exercises Content";
  }

  const materialPath = getMaterialPath(
    parsedCategory.data,
    parsedType.data,
    parsedMaterial.data
  );
  const materialsList = await getMaterials(materialPath, locale);
  const { currentMaterial, currentMaterialItem } = getCurrentMaterial(
    `/${path}`,
    materialsList
  );

  if (!(currentMaterial && currentMaterialItem)) {
    return "Exercises Content";
  }

  if (currentMaterial.description) {
    return `Exercises: ${currentMaterial.title} - ${currentMaterialItem.title}: ${currentMaterial.description}`;
  }

  return `Exercises: ${currentMaterial.title} - ${currentMaterialItem.title}`;
}
