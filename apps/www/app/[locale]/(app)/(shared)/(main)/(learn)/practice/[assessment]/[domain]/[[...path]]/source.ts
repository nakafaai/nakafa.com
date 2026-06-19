import {
  parseExercisesMaterial,
  parseExercisesType,
} from "@repo/contents/_lib/assessment/route";
import type { ContentPagination } from "@repo/contents/_types/content";
import {
  readSourcePracticeQuestionNumber,
  toPublicPracticeQuestionSegment,
} from "@repo/contents/_types/route/practice";
import { cleanSlug } from "@repo/utilities/helper";
import { Option } from "effect";
import { notFound } from "next/navigation";

const EXERCISE_TYPE_YEAR_PATTERN = /^(.+)-(\d{4})$/;

/** Uses the first set row to name the grouped practice card consistently. */
export function readGroupTitle(route: { sourcePath: string }) {
  const sourceParts = readExerciseSetSourceParts(route.sourcePath);
  const suffix = sourceParts.year ? ` ${sourceParts.year}` : "";

  if (sourceParts.exerciseType === "try-out") {
    return `Try Out${suffix}`;
  }

  return `${sourceParts.exerciseType}${suffix}`;
}

/** Reads source set and question number from a projected question source path. */
export function readQuestionSourcePathParts(sourcePath: string) {
  const segments = cleanSlug(sourcePath).split("/");
  const questionSegment = segments.at(-1);

  if (!questionSegment) {
    notFound();
  }

  const questionNumber = readSourcePracticeQuestionNumber(questionSegment);

  if (questionNumber === null) {
    notFound();
  }

  return {
    questionNumber,
    setSourcePath: segments.slice(0, -1).join("/"),
  };
}

/** Parses the stable source set path into runtime exercise group arguments. */
export function readExerciseSetSourceParts(sourcePath: string) {
  const segments = cleanSlug(sourcePath).split("/");
  const [, , , type, material, exerciseTypeSegment] = segments;
  const exerciseTypeMatch = exerciseTypeSegment?.match(
    EXERCISE_TYPE_YEAR_PATTERN
  );

  if (!(type && material && exerciseTypeSegment)) {
    notFound();
  }
  const parsedType = parseExercisesType(type);
  const parsedMaterial = parseExercisesMaterial(material);

  if (Option.isNone(parsedType) || Option.isNone(parsedMaterial)) {
    notFound();
  }

  return {
    exerciseType: exerciseTypeMatch?.[1] ?? exerciseTypeSegment,
    material: parsedMaterial.value,
    type: parsedType.value,
    year: exerciseTypeMatch?.[2],
  };
}

/** Converts numeric pagination into localized public question label paths. */
export function localizeQuestionPaginationItem(
  item: ContentPagination["prev"]
) {
  if (!item.href) {
    return item;
  }

  const segments = item.href.split("/");
  const sourceQuestionSegment = segments.pop();
  const locale = item.href.startsWith("/id/") ? "id" : "en";
  const questionNumber = readSourcePracticeQuestionNumber(
    sourceQuestionSegment
  );

  if (questionNumber === null) {
    return item;
  }

  return {
    ...item,
    href: [
      ...segments,
      toPublicPracticeQuestionSegment({ locale, number: questionNumber }),
    ].join("/"),
  };
}
