import type { QuranTranslationDocument } from "@nakafa/aksara-contracts/quran/notes";

/** Projects semantic notes into a stable text-and-definitions contract. */
export function projectQuranTranslationV2(
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
export function renderQuranTranslationMarkdownV2(
  translation: QuranTranslationDocument
): readonly string[] {
  const { notes, text } = projectQuranTranslationV2(translation);
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
