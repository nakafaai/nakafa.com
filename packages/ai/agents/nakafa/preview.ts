import { formatNakafaRouteTitle } from "@repo/contents/_lib/agent/format";
import type { NakafaAgentExerciseResult } from "@repo/contents/_lib/agent/schema/exercise";
import type { NakafaAgentQuranReference } from "@repo/contents/_lib/agent/schema/quran";
import type { NakafaAgentMarkdown } from "@repo/contents/_lib/agent/schema/read";
import type { NakafaAgentContentRef } from "@repo/contents/_lib/agent/schema/ref";
import type { NakafaAgentTaxonomy } from "@repo/contents/_lib/agent/schema/taxonomy";
import { Option } from "effect";

/** Builds the bounded UI preview for a full content read. */
export function previewRead(result: NakafaAgentMarkdown) {
  return {
    ...previewContentRef(result),
    description: result.description,
    title: result.title,
  };
}

/** Builds the bounded UI preview for an exercise read. */
export function previewExercise(result: NakafaAgentExerciseResult) {
  const preview = {
    ...previewContentRef(result),
    count: result.count,
    numbers: result.exercises.map((exercise) => exercise.number),
    title: formatNakafaRouteTitle(result.route, result.locale),
  };

  const exerciseNumber = Option.fromNullable(result.exercise_number);

  if (Option.isNone(exerciseNumber)) {
    return preview;
  }

  return {
    ...preview,
    exercise_number: exerciseNumber.value,
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
