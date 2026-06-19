import type { Locale } from "@repo/contents/_types/content";
import { toPublicPracticeQuestionSegment } from "@repo/contents/_types/route/practice/path";

/** Builds preview links without appending duplicate leaves to question-level results. */
export function readExercisePreviewHref({
  exerciseNumber,
  locale,
  number,
  url,
}: {
  exerciseNumber?: number;
  locale: Locale;
  number: number;
  url: string;
}) {
  if (exerciseNumber !== undefined) {
    return url;
  }

  return `${url}/${toPublicPracticeQuestionSegment({
    locale,
    number,
  })}`;
}
