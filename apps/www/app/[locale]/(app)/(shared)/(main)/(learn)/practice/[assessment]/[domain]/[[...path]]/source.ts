import {
  parseExercisesMaterial,
  parseExercisesType,
} from "@repo/contents/_lib/assessment/route";
import type { ContentPagination } from "@repo/contents/_types/content";
import { cleanSlug } from "@repo/utilities/helper";
import { Option } from "effect";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";

const NUMERIC_SEGMENT_PATTERN = /^\d+$/;
const EXERCISE_TYPE_YEAR_PATTERN = /^(.+)-(\d{4})$/;

/** Checks one localized final question segment without creating route data. */
export function isLocalizedQuestionSegment(
  locale: Locale,
  segment: string | undefined
) {
  if (!segment) {
    return false;
  }

  const prefix = locale === "id" ? "soal-" : "question-";
  const numericSegment = segment.slice(prefix.length);
  const questionNumber = Number.parseInt(numericSegment, 10);

  return (
    segment.startsWith(prefix) &&
    NUMERIC_SEGMENT_PATTERN.test(numericSegment) &&
    questionNumber > 0 &&
    questionNumber.toString() === numericSegment
  );
}

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

  const questionNumber = Number.parseInt(questionSegment, 10);

  if (
    !(Number.isSafeInteger(questionNumber) && questionNumber > 0) ||
    questionNumber.toString() !== questionSegment
  ) {
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
  const numericQuestion = segments.pop();

  if (!numericQuestion) {
    return item;
  }

  const locale = item.href.startsWith("/id/") ? "id" : "en";
  const questionSegment =
    locale === "id" ? `soal-${numericQuestion}` : `question-${numericQuestion}`;

  return {
    ...item,
    href: [...segments, questionSegment].join("/"),
  };
}
