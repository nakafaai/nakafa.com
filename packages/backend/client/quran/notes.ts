import type { QuranTranslationDocument } from "@nakafa/aksara-contracts/quran/notes";
import { Array as Arr } from "effect";

/** Projects semantic notes into a stable text-and-definitions contract. */
export function projectQuranTranslation(
  translation: QuranTranslationDocument,
  renderReference: (number: number) => string = (number) =>
    `[translation note ${number}]`
) {
  return {
    notes: Arr.map(translation.notes, ({ number, text }) => ({
      number,
      text,
    })),
    text: Arr.join(
      Arr.map(translation.segments, (segment) =>
        segment.kind === "text"
          ? segment.value
          : renderReference(segment.number)
      ),
      ""
    ),
  };
}

/** Renders one translation and its exact notes for agent Markdown. */
export function renderQuranTranslationMarkdown(
  translation: QuranTranslationDocument
): readonly string[] {
  const { notes, text } = projectQuranTranslation(translation);
  if (notes.length === 0) {
    return [`Translation: ${text}`];
  }
  return [
    `Translation: ${text}`,
    "",
    "Translation notes:",
    ...Arr.map(notes, (note) => `- ${note.number}. ${note.text}`),
  ];
}
