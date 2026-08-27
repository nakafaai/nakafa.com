import type { QuranTranslationDocument } from "@nakafa/aksara-contracts/quran/notes";

/** Projects semantic notes into a stable text-and-definitions contract. */
export function projectQuranTranslation(
  translation: QuranTranslationDocument,
  renderReference: (number: number) => string = (number) =>
    `[translation note ${number}]`
) {
  return {
    notes: translation.notes.map(({ number, text }) => ({ number, text })),
    text: translation.segments
      .map((segment) =>
        segment.kind === "text"
          ? segment.value
          : renderReference(segment.number)
      )
      .join(""),
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
    ...notes.map((note) => `- ${note.number}. ${note.text}`),
  ];
}
