import {
  boundText,
  countTextTokens,
  NINA_BUDGET,
} from "@repo/backend/confect/nina/budget";
import type { NakafaAgentQuranReference } from "@repo/contents/agent/schema/quran/reference";
import type { NakafaAgentMarkdown } from "@repo/contents/agent/schema/read";
import type { NakafaAgentSearchResult } from "@repo/contents/agent/schema/search";
import type { NakafaAgentTaxonomy } from "@repo/contents/agent/schema/taxonomy";
import { slugify } from "@repo/utilities/slug";
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

/** The implicit section before a document's first heading. */
export const READ_START_SECTION = "top";
/** Most remaining sections listed in a read outline. */
const OUTLINE_LIMIT = 24;
const HEADING = /^#{2,3}\s+(.+?)\s*#*$/;

/** One readable markdown section, keyed by a stable heading slug. */
interface ReadSection {
  readonly slug: string;
  readonly text: string;
  readonly title: string;
}

/** Splits agent markdown at level-two and level-three headings. */
function splitSections(markdown: string) {
  const sections: ReadSection[] = [];
  const counts = new Map<string, number>();
  let title = "Start";
  let slug = READ_START_SECTION;
  let lines: string[] = [];
  const close = () => {
    const text = lines.join("\n").trim();
    if (text) {
      sections.push({ slug, text, title });
    }
  };
  for (const line of markdown.split("\n")) {
    const heading = HEADING.exec(line);
    if (!heading?.[1]) {
      lines.push(line);
      continue;
    }
    close();
    title = heading[1];
    const base = slugify(title);
    const seen = (counts.get(base) ?? 0) + 1;
    counts.set(base, seen);
    slug = seen === 1 ? base : `${base}-${seen}`;
    lines = [line];
  }
  close();
  return sections;
}

/** Lists sections the model can request next, capped for long documents. */
function formatOutline(sections: readonly ReadSection[]) {
  if (sections.length === 0) {
    return "";
  }
  const listed = sections
    .slice(0, OUTLINE_LIMIT)
    .map(({ slug, title }) => `- ${title} (section: ${slug})`);
  const more = sections.length - listed.length;
  return [
    "## Other Sections",
    ...listed,
    ...(more > 0 ? [`- ${more} more sections`] : []),
  ].join("\n");
}

/**
 * Formats a Nakafa content read within a token budget. Reading starts at
 * `section` when given, then continues through the sections that fit, and the
 * outline names the rest so the model can read them next.
 */
export function formatRead(
  result: NakafaAgentMarkdown,
  {
    budget = NINA_BUDGET.evidence,
    section,
  }: {
    readonly budget?: number;
    readonly section?: string | undefined;
  } = {}
) {
  const description = result.description
    ? `\n- Description: ${result.description}`
    : "";
  const header = `# Nakafa Content\n- Title: ${result.title}${description}\n- Content ID: ${result.content_id}`;
  const sections = splitSections(result.text);
  const start = sections.findIndex(
    ({ slug }) => slug === (section ?? READ_START_SECTION)
  );
  if (section !== undefined && start < 0) {
    return boundText(
      [
        header,
        `Section ${section} was not found in this content.`,
        formatOutline(sections),
      ].join("\n\n"),
      budget,
      "Request one of the listed sections."
    );
  }
  const from = Math.max(start, 0);
  const bodyBudget =
    budget - countTextTokens(header) - countTextTokens(formatOutline(sections));
  const included: ReadSection[] = [];
  let used = 0;
  for (const candidate of sections.slice(from)) {
    const cost = countTextTokens(candidate.text);
    if (included.length > 0 && used + cost > bodyBudget) {
      break;
    }
    included.push(candidate);
    used += cost;
  }
  const remaining = sections.filter(
    (candidate) => !included.includes(candidate)
  );
  const body = boundText(
    included.map(({ text }) => text).join("\n\n"),
    bodyBudget,
    "Read the rest of this section with a narrower request."
  );
  return [header, body, formatOutline(remaining)].filter(Boolean).join("\n\n");
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
