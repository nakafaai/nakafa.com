import type { NakafaAgentQuranReference } from "@repo/contents/agent/schema/quran/reference";
import type { NakafaAgentMarkdown } from "@repo/contents/agent/schema/read";
import type { NakafaAgentReadableContentRef } from "@repo/contents/agent/schema/ref";
import type { NakafaAgentTaxonomy } from "@repo/contents/agent/schema/taxonomy";
import { Array as Arr, Option } from "effect";

/** Builds the bounded UI preview for a full content read. */
export function previewRead(result: NakafaAgentMarkdown) {
  return {
    ...previewContentRef(result),
    ...(result.description === undefined
      ? {}
      : { description: result.description }),
    title: result.title,
  };
}

/** Builds the bounded UI preview for a Quran reference. */
export function previewQuran(result: NakafaAgentQuranReference) {
  const firstVerse = Arr.head(result.verses);
  const lastVerse = Arr.last(result.verses);

  return {
    ...previewContentRef(result),
    from_verse: Option.match(firstVerse, {
      onNone: () => 1,
      onSome: (verse) => verse.number,
    }),
    meaning: result.meaning,
    name: result.name,
    revelation: result.revelation,
    to_verse: Option.match(lastVerse, {
      onNone: () => 1,
      onSome: (verse) => verse.number,
    }),
    verse_count: result.verses.length,
  };
}

/** Builds the shared graph-backed content reference preview fields. */
function previewContentRef<const Result extends NakafaAgentReadableContentRef>(
  result: Result
) {
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
