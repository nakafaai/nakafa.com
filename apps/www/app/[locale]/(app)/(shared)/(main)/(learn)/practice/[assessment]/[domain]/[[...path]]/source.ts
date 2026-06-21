import type { ContentPagination } from "@repo/contents/_types/content";
import {
  readPracticeQuestionSourceParts,
  readPracticeSourceSetParts,
} from "@repo/contents/_types/route/practice/identity";
import {
  readSourcePracticeQuestionNumber,
  toPublicPracticeQuestionSegment,
} from "@repo/contents/_types/route/practice/path";
import { notFound } from "next/navigation";

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
  const parts = readPracticeQuestionSourceParts(sourcePath);

  if (!parts) {
    notFound();
  }

  return parts;
}

/** Parses the stable source set path into runtime exercise group arguments. */
export function readExerciseSetSourceParts(sourcePath: string) {
  const parts = readPracticeSourceSetParts(sourcePath);

  if (!parts) {
    notFound();
  }

  return parts;
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
