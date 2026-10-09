import type { NakafaAgentQuranReference } from "@repo/contents/agent/schema/quran/reference";
import type {
  NakafaQuranEmbeddedSourceSchema,
  NakafaQuranExternalSourceSchema,
} from "@repo/contents/agent/schema/quran/source";
import type { NakafaAgentSearchResult } from "@repo/contents/agent/schema/search";
import type { NakafaAgentTaxonomy } from "@repo/contents/agent/schema/taxonomy";
import dedent from "dedent";
import { Array as Arr, pipe } from "effect";

/** Formats one taxonomy value with its canonical ID and localized label. */
function formatTaxonomyOption(option: { id: string; label: string }) {
  return `${option.id} (${option.label})`;
}

/** Formats Nakafa search results as compact grounded markdown. */
export function formatSearch(result: NakafaAgentSearchResult) {
  return dedent(`
    # Nakafa Search
    - Count: ${result.count}
    - Offset: ${result.offset}
    - Next offset: ${result.next_offset ?? "none"}

    ${pipe(
      result.items,
      Arr.map(
        (item, index) => `
    ## Result ${index + 1}
    - Title: ${item.title}
    - Description: ${item.description}
    - Excerpt: ${item.excerpt}
    - Content ID: ${item.content_id}
    - Section: ${item.section}`
      ),
      Arr.join("\n")
    )}
  `);
}

/** Renders semantic text while preserving every source note relationship. */
function formatQuranTranslation(
  translation: NakafaAgentQuranReference["verses"][number]["translation"]
) {
  const text = pipe(
    translation.segments,
    Arr.map((segment) =>
      segment.kind === "text"
        ? segment.value
        : `[translation note ${segment.number}]`
    ),
    Arr.join("")
  );
  const notes = pipe(
    translation.notes,
    Arr.map((note) => `- Translation note ${note.number}: ${note.text}`),
    Arr.join("\n")
  );
  return notes.length === 0
    ? `- Translation: ${text}`
    : `- Translation: ${text}\n${notes}`;
}

/** Formats the source identity shared by embedded and link-only editions. */
function formatQuranSource(
  source:
    | typeof NakafaQuranEmbeddedSourceSchema.Type
    | typeof NakafaQuranExternalSourceSchema.Type
) {
  return `${source.label}; publisher: ${source.publisher}; version: ${source.version}; source: ${source.source_url}; updates: ${source.update_url}; terms: ${source.terms.url}`;
}

/** Formats a source-grounded Quran reference for model consumption. */
export function formatQuran(result: NakafaAgentQuranReference) {
  const meaning =
    result.meaning.locale === result.locale
      ? result.meaning.text
      : `${result.meaning.text} (${result.meaning.locale})`;
  const preBismillah =
    result.pre_bismillah === null
      ? ""
      : `
    ## Bismillah
    - Arabic: ${result.pre_bismillah.arabic}
    ${formatQuranTranslation(result.pre_bismillah.translation)}`;
  const tafsirAccess = `## Tafsir access
    - Kind: ${result.tafsir_access.kind}
    - Notice: ${result.tafsir_access.notice}
    - Source: ${formatQuranSource(result.tafsir_access.source)}`;
  return dedent(`
    # Nakafa Quran Reference
    - Name: ${result.name}
    - Meaning: ${meaning}
    - Revelation: ${result.revelation}
    - Content ID: ${result.content_id}

    ## Signed reading sources
    - Arabic: ${formatQuranSource(result.sources.arabic)}
    - Translation (${result.sources.translation.locale}): ${formatQuranSource(result.sources.translation)}

    ${tafsirAccess}

    ${preBismillah}

    ${pipe(
      result.verses,
      Arr.map(
        (verse) => `
    ## Verse ${verse.number}
    - Arabic: ${verse.arabic}
    ${formatQuranTranslation(verse.translation)}
    ${verse.tafsir ? `- Tafsir: ${verse.tafsir}` : ""}`
      ),
      Arr.join("\n")
    )}
  `);
}

/** Formats Nakafa taxonomy as a short discovery guide. */
export function formatTaxonomy(result: NakafaAgentTaxonomy) {
  return dedent(`
    # Nakafa Taxonomy
    - Locale: ${result.locale}
    - Locales: ${Arr.join(result.locales, ", ")}
    - Sections: ${Arr.join(result.sections, ", ")}
    - Tools: ${Arr.join(result.tools, ", ")}

    ## Articles
    - Categories: ${Arr.join(result.articles.categories, ", ")}

    ## Counts
    ${pipe(
      result.content_counts,
      Arr.map((item) => `- ${item.locale}: ${item.count}`),
      Arr.join("\n")
    )}

    ## Try Out
    - Countries: ${pipe(result.tryout.countries, Arr.map(formatTaxonomyOption), Arr.join(", "))}
    - Exams: ${pipe(result.tryout.exams, Arr.map(formatTaxonomyOption), Arr.join(", "))}
  `);
}
