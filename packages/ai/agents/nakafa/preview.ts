import type { NakafaAgentQuranReference } from "@repo/contents/_lib/agent/schema/quran";
import type { NakafaAgentMarkdown } from "@repo/contents/_lib/agent/schema/read";
import type { NakafaAgentContentRef } from "@repo/contents/_lib/agent/schema/ref";
import type { NakafaAgentTaxonomy } from "@repo/contents/_lib/agent/schema/taxonomy";

/** Builds the bounded UI preview for a full content read. */
export function previewRead(result: NakafaAgentMarkdown) {
  return {
    ...previewContentRef(result),
    description: result.description,
    title: result.title,
  };
}

/** Builds the bounded UI preview for a Quran reference. */
export function previewQuran(result: NakafaAgentQuranReference) {
  const firstVerse = result.verses.at(0);
  const lastVerse = result.verses.at(-1);

  return {
    ...previewContentRef(result),
    from_verse: firstVerse?.number ?? 1,
    name: result.name,
    revelation: result.revelation,
    to_verse: lastVerse?.number ?? firstVerse?.number ?? 1,
    translation: result.translation,
    verse_count: result.verses.length,
  };
}

/** Builds the shared graph-backed content reference preview fields. */
function previewContentRef(result: NakafaAgentContentRef) {
  return {
    alignmentId: result.alignmentId,
    assetId: result.assetId,
    conceptId: result.conceptId,
    content_id: result.content_id,
    learningObjectId: result.learningObjectId,
    lensId: result.lensId,
    locale: result.locale,
    markdown_url: result.markdown_url,
    route: result.route,
    section: result.section,
    url: result.url,
  };
}

/** Builds the bounded UI preview for taxonomy data. */
export function previewTaxonomy(result: NakafaAgentTaxonomy) {
  return {
    content_counts: result.content_counts,
    locale: result.locale,
    sections: result.sections,
    tools: result.tools,
  };
}
