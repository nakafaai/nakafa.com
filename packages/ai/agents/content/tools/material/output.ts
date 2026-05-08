import type { GetContentOutput } from "@repo/ai/agents/content/schema";
import type { Locale } from "@repo/backend/convex/lib/validators/contents";
import type { ExerciseWithoutDefaults } from "@repo/contents/_types/exercises/shared";
import type { Surah } from "@repo/contents/_types/quran";
import dedent from "dedent";

/**
 * Formats fetched content for the model as source-backed markdown.
 */
export function formatOutput({ output }: { output: GetContentOutput }) {
  return dedent(`
    # Source
    - URL: ${output.url}

    # Content
    ${output.content}
  `);
}

/**
 * Formats exercises with questions, choices, and answer explanations.
 */
export function formatExercises({
  output,
  locale,
}: {
  output: ExerciseWithoutDefaults[];
  locale: Locale;
}) {
  return dedent(`
    # Exercises
    ${output
      .map(
        (exercise) => `
    ## Exercise ${exercise.number}

    ### Question
    ${exercise.question.raw}

    ### Choices
    ${exercise.choices[locale]
      .map(
        (choice) =>
          `- ${choice.label} (Correct: ${choice.value ? "Yes" : "No"})`
      )
      .join("\n")}

    ### Answer
    ${exercise.answer.raw}`
      )
      .join("\n\n")}
  `);
}

/**
 * Formats a Quran surah with metadata and verse content.
 */
export function formatQuran({
  output,
  locale,
}: {
  output: Surah;
  locale: Locale;
}) {
  return dedent(`
    # Surah ${output.number}

    ## Info
    - Name: ${output.name.transliteration[locale]} (${output.name.translation[locale]})
    - Sequence: ${output.sequence}
    - Total Verses: ${output.numberOfVerses}
    - Revelation: ${output.revelation[locale]}
    ${
      output.preBismillah
        ? `
    ## Pre-Bismillah
    - Arabic: ${output.preBismillah.text.arab}
    - Transliteration: ${output.preBismillah.text.transliteration.en}
    - Translation: ${output.preBismillah.translation[locale]}`
        : ""
    }

    ## Verses
    ${output.verses
      .map(
        (verse) => `
    ### Verse ${verse.number.inSurah}
    - Arabic: ${verse.text.arab}
    - Transliteration: ${verse.text.transliteration.en}
    - Translation: ${verse.translation[locale]}
    ${verse.tafsir.id.short ? `- Tafsir Short: ${verse.tafsir.id.short}` : ""}
    ${verse.tafsir.id.long ? `- Tafsir Long: ${verse.tafsir.id.long}` : ""}`
      )
      .join("\n")}
  `);
}
