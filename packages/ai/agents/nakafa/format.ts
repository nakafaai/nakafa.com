import type { NakafaAgentExerciseResult } from "@repo/contents/_lib/agent/schema/exercise";
import type { NakafaAgentQuranReference } from "@repo/contents/_lib/agent/schema/quran";
import type { NakafaAgentMarkdown } from "@repo/contents/_lib/agent/schema/read";
import type { NakafaAgentSearchResult } from "@repo/contents/_lib/agent/schema/search";
import type { NakafaAgentTaxonomy } from "@repo/contents/_lib/agent/schema/taxonomy";
import dedent from "dedent";

/** Formats one taxonomy value with its canonical ID and localized label. */
function formatTaxonomyOption(option: { id: string; label: string }) {
  return `${option.id} (${option.label})`;
}

/** Formats Nakafa search results as compact source-backed markdown. */
export function formatSearch(result: NakafaAgentSearchResult) {
  return dedent(`
    # Nakafa Search
    - Count: ${result.count}
    - Offset: ${result.offset}
    - Next offset: ${result.next_offset ?? "none"}

    ${result.items
      .map(
        (item, index) => `
    ## Result ${index + 1}
    - Title: ${item.title}
    - Description: ${item.description}
    - Content ID: ${item.content_id}
    - Section: ${item.section}
    - URL: ${item.url}
    - Markdown URL: ${item.markdown_url}`
      )
      .join("\n")}
  `);
}

/** Formats a full Nakafa content read for model consumption. */
export function formatRead(result: NakafaAgentMarkdown) {
  return dedent(`
    # Nakafa Content
    - Title: ${result.title}
    - Description: ${result.description}
    - Content ID: ${result.content_id}
    - URL: ${result.url}
    - Markdown URL: ${result.markdown_url}

    ${result.text}
  `);
}

/** Formats structured Nakafa exercises with choices and explanations. */
export function formatExercise(result: NakafaAgentExerciseResult) {
  return dedent(`
    # Nakafa Exercises
    - Content ID: ${result.content_id}
    - URL: ${result.url}
    - Count: ${result.count}
    - Exercise number: ${result.exercise_number ?? "all"}

    ${result.exercises
      .map(
        (exercise) => `
    ## Exercise ${exercise.number}

    ### Question
    ${exercise.question.raw}

    ### Choices
    ${exercise.choices
      .map(
        (choice) =>
          `- ${choice.label} (Correct: ${choice.correct ? "Yes" : "No"})`
      )
      .join("\n")}

    ### Answer
    ${exercise.answer.raw}`
      )
      .join("\n\n")}
  `);
}

/** Formats a bounded Quran reference with translation and optional tafsir. */
export function formatQuran(result: NakafaAgentQuranReference) {
  return dedent(`
    # Nakafa Quran Reference
    - Name: ${result.name}
    - Translation: ${result.translation}
    - Revelation: ${result.revelation}
    - Content ID: ${result.content_id}
    - URL: ${result.url}

    ${result.verses
      .map(
        (verse) => `
    ## Verse ${verse.number}
    - Arabic: ${verse.arabic}
    - Transliteration: ${verse.transliteration}
    - Translation: ${verse.translation}
    ${verse.tafsir ? `- Tafsir: ${verse.tafsir}` : ""}`
      )
      .join("\n")}
  `);
}

/** Formats Nakafa taxonomy as a short discovery guide. */
export function formatTaxonomy(result: NakafaAgentTaxonomy) {
  return dedent(`
    # Nakafa Taxonomy
    - Locale: ${result.locale}
    - Locales: ${result.locales.join(", ")}
    - Sections: ${result.sections.join(", ")}
    - Tools: ${result.tools.join(", ")}

    ## Counts
    ${result.content_counts
      .map((item) => `- ${item.locale}: ${item.count}`)
      .join("\n")}

    ## Subject
    - Categories: ${result.subject.categories.join(", ")}
    - Grades: ${result.subject.grades.join(", ")}
    - Materials: ${result.subject.materials.join(", ")}

    ## Exercises
    - Categories: ${result.exercises.categories.map(formatTaxonomyOption).join(", ")}
    - Types: ${result.exercises.types.map(formatTaxonomyOption).join(", ")}
    - Materials: ${result.exercises.materials.map(formatTaxonomyOption).join(", ")}
  `);
}
