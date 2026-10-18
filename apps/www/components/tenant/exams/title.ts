import { ExamTitle } from "@repo/backend/confect/exams/exam";
import { Option, Schema, String as Str } from "effect";

/**
 * The title that a rename sends, or none. A teacher who has typed nothing sends nothing.
 * So does a title that is the saved one once trimmed, or that the contract refuses, such as
 * a blank one. Any other title is sent trimmed, so the server only gets a whole title.
 */
export const titleToSave = (
  draft: string | null,
  saved: string
): Option.Option<string> => {
  if (draft === null) {
    return Option.none();
  }
  const title = Str.trim(draft);
  if (title === saved || !Schema.is(ExamTitle)(title)) {
    return Option.none();
  }
  return Option.some(title);
};
