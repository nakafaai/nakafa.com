import { getNakafaAgentExercise } from "@repo/contents/_lib/agent/exercises";
import { formatNakafaRouteTitle } from "@repo/contents/_lib/agent/format";
import { getNakafaAgentQuranReference } from "@repo/contents/_lib/agent/quran";
import { parseNakafaContentRef } from "@repo/contents/_lib/agent/refs";
import {
  type NakafaAgentContentRef,
  NakafaAgentMarkdownSchema,
} from "@repo/contents/_lib/agent/schemas";
import { getContentMetadataWithRaw } from "@repo/contents/_lib/metadata";
import { getSurah } from "@repo/contents/_lib/quran";
import { Effect, Option } from "effect";

const QURAN_ROUTE_SECTION = "quran";
const QURAN_SURAH_PATTERN = /^\d+$/;

/** Retrieves full agent-readable markdown by content ID, resource URI, or URL. */
export const getNakafaAgentMarkdown = Effect.fn("NakafaAgent.getMarkdown")(
  function* (input: string) {
    const ref = parseNakafaContentRef(input);

    if (Option.isNone(ref)) {
      return Option.none();
    }

    if (ref.value.section === "quran") {
      return yield* renderNakafaQuranMarkdown(ref.value);
    }

    if (ref.value.section === "exercises") {
      return yield* renderNakafaExerciseMarkdown(ref.value);
    }

    return yield* renderNakafaMdxMarkdown(ref.value);
  }
);

/** Renders article and subject MDX source as agent markdown. */
function renderNakafaMdxMarkdown(ref: NakafaAgentContentRef) {
  return Effect.gen(function* () {
    const content = yield* Effect.option(
      getContentMetadataWithRaw(ref.locale, ref.route)
    );

    if (Option.isNone(content)) {
      return Option.none();
    }

    return Option.some(
      NakafaAgentMarkdownSchema.parse({
        ...ref,
        description:
          content.value.metadata.description ??
          content.value.metadata.subject ??
          "",
        text: [
          `# ${content.value.metadata.title}`,
          "",
          `Source URL: ${ref.url}`,
          `Markdown URL: ${ref.markdown_url}`,
          "",
          content.value.raw.trim(),
        ].join("\n"),
        title: content.value.metadata.title,
      })
    );
  });
}

/** Renders an exercise set as agent markdown with answers included. */
function renderNakafaExerciseMarkdown(ref: NakafaAgentContentRef) {
  return Effect.gen(function* () {
    const exercise = yield* getNakafaAgentExercise(ref.content_id);

    if (Option.isNone(exercise)) {
      return Option.none();
    }

    return Option.some(
      NakafaAgentMarkdownSchema.parse({
        ...ref,
        description: `${exercise.value.count} exercises`,
        text: [
          `# ${formatNakafaRouteTitle(exercise.value.route)}`,
          "",
          `Source URL: ${exercise.value.url}`,
          `Markdown URL: ${exercise.value.markdown_url}`,
          "",
          ...exercise.value.exercises.flatMap((item) => [
            `## Exercise ${item.number}`,
            "",
            "### Question",
            "",
            item.question.raw.trim(),
            "",
            "### Choices",
            "",
            ...item.choices.map(
              (choice) => `- [${choice.correct ? "x" : " "}] ${choice.label}`
            ),
            "",
            "### Answer & Explanation",
            "",
            item.answer.raw.trim(),
            "",
          ]),
        ].join("\n"),
        title: formatNakafaRouteTitle(exercise.value.route),
      })
    );
  });
}

/** Renders a full Quran surah as agent markdown for content retrieval. */
function renderNakafaQuranMarkdown(ref: NakafaAgentContentRef) {
  return Effect.gen(function* () {
    const surahNumber = parseQuranSurahRoute(ref.route);

    if (Option.isNone(surahNumber)) {
      return Option.none();
    }

    const surah = yield* Effect.option(getSurah(surahNumber.value));

    if (Option.isNone(surah)) {
      return Option.none();
    }

    const reference = yield* getNakafaAgentQuranReference({
      from_verse: 1,
      locale: ref.locale,
      surah: surah.value.number,
      to_verse: surah.value.numberOfVerses,
    });

    if (Option.isNone(reference)) {
      return Option.none();
    }

    return Option.some(
      NakafaAgentMarkdownSchema.parse({
        ...ref,
        description: reference.value.translation,
        text: [
          `# ${reference.value.name}`,
          "",
          `Source URL: ${reference.value.url}`,
          `Markdown URL: ${reference.value.markdown_url}`,
          "",
          `Translation: ${reference.value.translation}`,
          `Revelation: ${reference.value.revelation}`,
          "",
          "## Verses",
          "",
          ...reference.value.verses.flatMap((verse) => [
            `### Verse ${verse.number}`,
            "",
            verse.arabic,
            "",
            `Transliteration: ${verse.transliteration}`,
            "",
            `Translation: ${verse.translation}`,
            "",
          ]),
        ].join("\n"),
        title: reference.value.name,
      })
    );
  });
}

/** Parses only canonical `quran/{surah}` content routes. */
function parseQuranSurahRoute(route: string) {
  const routeSegments = route.split("/");
  const surahSegment = routeSegments.at(1);

  if (
    routeSegments.length !== 2 ||
    routeSegments.at(0) !== QURAN_ROUTE_SECTION ||
    !surahSegment
  ) {
    return Option.none();
  }

  if (!QURAN_SURAH_PATTERN.test(surahSegment)) {
    return Option.none();
  }

  const surahNumber = Number(surahSegment);

  if (surahNumber.toString() !== surahSegment) {
    return Option.none();
  }

  return Option.some(surahNumber);
}
