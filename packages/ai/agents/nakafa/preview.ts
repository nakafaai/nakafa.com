import { formatNakafaRouteTitle } from "@repo/contents/_lib/agent/format";
import type {
  NakafaAgentExerciseResult,
  NakafaAgentMarkdown,
  NakafaAgentQuranReference,
  NakafaAgentTaxonomy,
} from "@repo/contents/_lib/agent/schemas";

/** Builds the bounded UI preview for a full content read. */
export function previewRead(result: NakafaAgentMarkdown) {
  return {
    content_id: result.content_id,
    description: result.description,
    locale: result.locale,
    markdown_url: result.markdown_url,
    route: result.route,
    section: result.section,
    title: result.title,
    url: result.url,
  };
}

/** Builds the bounded UI preview for an exercise read. */
export function previewExercise(result: NakafaAgentExerciseResult) {
  return {
    content_id: result.content_id,
    count: result.count,
    exercise_number: result.exercise_number,
    locale: result.locale,
    markdown_url: result.markdown_url,
    numbers: result.exercises.map((exercise) => exercise.number),
    route: result.route,
    section: result.section,
    title: formatNakafaRouteTitle(result.route),
    url: result.url,
  };
}

/** Builds the bounded UI preview for a Quran reference. */
export function previewQuran(result: NakafaAgentQuranReference) {
  const firstVerse = result.verses.at(0);
  const lastVerse = result.verses.at(-1);

  return {
    content_id: result.content_id,
    from_verse: firstVerse?.number ?? 1,
    locale: result.locale,
    markdown_url: result.markdown_url,
    name: result.name,
    revelation: result.revelation,
    route: result.route,
    section: result.section,
    to_verse: lastVerse?.number ?? firstVerse?.number ?? 1,
    translation: result.translation,
    url: result.url,
    verse_count: result.verses.length,
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
