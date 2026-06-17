import {
  parseExercisesMaterial,
  parseExercisesType,
} from "@repo/contents/_lib/assessment/route";
import type { ContentPagination } from "@repo/contents/_types/content";
import type { PublicContentRoute } from "@repo/contents/_types/route/schema";
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

  return (
    segment.startsWith(prefix) && NUMERIC_SEGMENT_PATTERN.test(numericSegment)
  );
}

/** Uses the first set row to name the group card like the old route did. */
export function readGroupTitle(route: Pick<PublicContentRoute, "sourcePath">) {
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
  const questionNumber = Number.parseInt(
    questionSegment?.replace("question-", "") ?? "",
    10
  );

  if (!Number.isFinite(questionNumber)) {
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

/** Converts old numeric pagination into localized question label paths. */
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
