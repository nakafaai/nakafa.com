import type { NakafaAgentQuranReference } from "@repo/contents/_lib/agent/schema/quran/reference";
import type { NakafaAgentMarkdown } from "@repo/contents/_lib/agent/schema/read";
import type { NakafaAgentSearchResult } from "@repo/contents/_lib/agent/schema/search";
import type { NakafaAgentTaxonomy } from "@repo/contents/_lib/agent/schema/taxonomy";
import dedent from "dedent";

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

    ${result.items
      .map(
        (item, index) => `
    ## Result ${index + 1}
    - Title: ${item.title}
    - Description: ${item.description}
    - Excerpt: ${item.excerpt}
    - Content ID: ${item.content_id}
    - Section: ${item.section}`
      )
      .join("\n")}
  `);
}

/** Formats a full Nakafa content read for model consumption. */
export function formatRead(result: NakafaAgentMarkdown) {
  const description = result.description
    ? `\n    - Description: ${result.description}`
    : "";
  return dedent(`
    # Nakafa Content
    - Title: ${result.title}${description}
    - Content ID: ${result.content_id}

    ${result.text}
  `);
}

/** Renders semantic text while preserving every source note relationship. */
function formatQuranTranslation(
  translation: NakafaAgentQuranReference["verses"][number]["translation"]
) {
  const text = translation.segments
    .map((segment) =>
      segment.kind === "text"
        ? segment.value
        : `[translation note ${segment.number}]`
    )
    .join("");
  const notes = translation.notes
    .map((note) => `- Translation note ${note.number}: ${note.text}`)
    .join("\n");
  return notes.length === 0
    ? `- Translation: ${text}`
    : `- Translation: ${text}\n${notes}`;
}

/** Formats the source identity shared by embedded and link-only editions. */
function formatQuranSource(source: {
  readonly label: string;
  readonly publisher: string;
  readonly source_url: string;
  readonly terms: { readonly url: string };
  readonly update_url: string;
  readonly version: string;
}) {
  return `${source.label}; publisher: ${source.publisher}; version: ${source.version}; source: ${source.source_url}; updates: ${source.update_url}; terms: ${source.terms.url}`;
}

/** Formats a source-grounded Quran reference for model consumption. */
export function formatQuran(result: NakafaAgentQuranReference) {
  const meaning = result.meaning
    ? `${result.meaning.text} (${result.meaning.locale})`
    : `Not available for requested locale ${result.locale}`;
  const preBismillah =
    result.pre_bismillah === null
      ? ""
      : `
    ## Bismillah
    - Arabic: ${result.pre_bismillah.arabic}
    - Translation: ${result.pre_bismillah.translation}`;
  const tafsirAccess =
    result.tafsir_access === null
      ? `## Tafsir access
    - Availability: No Tafsir access metadata is available in the current signed publication.`
      : `## Tafsir access
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

    ${result.verses
      .map(
        (verse) => `
    ## Verse ${verse.number}
    - Arabic: ${verse.arabic}
    ${formatQuranTranslation(verse.translation)}
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

    ## Articles
    - Categories: ${result.articles.categories.join(", ")}

    ## Counts
    ${result.content_counts
      .map((item) => `- ${item.locale}: ${item.count}`)
      .join("\n")}

    ## Try Out
    - Countries: ${result.tryout.countries.map(formatTaxonomyOption).join(", ")}
    - Exams: ${result.tryout.exams.map(formatTaxonomyOption).join(", ")}
  `);
}
