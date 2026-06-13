import {
  getUnknownErrorMessage,
  NakafaAgentDataReadError,
} from "@repo/contents/_lib/agent/errors";
import { getNakafaAgentExercise } from "@repo/contents/_lib/agent/exercise/read";
import { formatNakafaRouteTitle } from "@repo/contents/_lib/agent/format";
import { getNakafaAgentQuranReference } from "@repo/contents/_lib/agent/quran/read";
import { parseNakafaContentRef } from "@repo/contents/_lib/agent/refs";
import { NakafaAgentMarkdownSchema } from "@repo/contents/_lib/agent/schema/read";
import type { NakafaAgentContentRef } from "@repo/contents/_lib/agent/schema/ref";
import { getContentMetadataWithRaw } from "@repo/contents/_lib/metadata";
import { getSurah } from "@repo/contents/_lib/quran";
import { Effect, Option, Schema } from "effect";

const QURAN_SURAH_PATTERN = /^\d+$/;

interface NakafaMarkdownReaders {
  readonly loadContent?: typeof getContentMetadataWithRaw;
  readonly loadSurah?: typeof getSurah;
  readonly readExercise?: typeof getNakafaAgentExercise;
  readonly readQuran?: typeof getNakafaAgentQuranReference;
}

/** Retrieves full agent-readable markdown by content ID, resource URI, or URL. */
export const getNakafaAgentMarkdown = Effect.fn("NakafaAgent.getMarkdown")(
  function* (input: string, readers: NakafaMarkdownReaders = {}) {
    const ref = parseNakafaContentRef(input);

    if (Option.isNone(ref)) {
      return Option.none();
    }

    if (ref.value.section === "quran") {
      return yield* renderNakafaQuranMarkdown(ref.value, readers);
    }

    if (ref.value.section === "exercises") {
      return yield* renderNakafaExerciseMarkdown(ref.value, readers);
    }

    return yield* renderNakafaMdxMarkdown(ref.value, readers);
  }
);

/** Renders article and subject MDX source as agent markdown. */
function renderNakafaMdxMarkdown(
  ref: NakafaAgentContentRef,
  readers: NakafaMarkdownReaders
) {
  return Effect.gen(function* () {
    const loadContent = readers.loadContent ?? getContentMetadataWithRaw;
    const content = yield* Effect.option(loadContent(ref.locale, ref.route));

    if (Option.isNone(content)) {
      return Option.none();
    }

    const markdown = yield* decodeNakafaAgentMarkdown({
      ...ref,
      description:
        content.value.metadata.description ??
        content.value.metadata.subject ??
        "",
      text: [
        `# ${content.value.metadata.title}`,
        "",
        content.value.raw.trim(),
      ].join("\n"),
      title: content.value.metadata.title,
    });

    return Option.some(markdown);
  });
}

/** Renders an exercise set as agent markdown with answers included. */
function renderNakafaExerciseMarkdown(
  ref: NakafaAgentContentRef,
  readers: NakafaMarkdownReaders
) {
  return Effect.gen(function* () {
    const readExercise = readers.readExercise ?? getNakafaAgentExercise;
    const exercise = yield* readExercise(ref.content_id);

    if (Option.isNone(exercise)) {
      return Option.none();
    }

    const markdown = yield* decodeNakafaAgentMarkdown({
      ...ref,
      description: `${exercise.value.count} exercises`,
      text: [
        `# ${formatNakafaRouteTitle(exercise.value.route, ref.locale)}`,
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
      title: formatNakafaRouteTitle(exercise.value.route, ref.locale),
    });

    return Option.some(markdown);
  });
}

/** Renders a full Quran surah as agent markdown for content retrieval. */
function renderNakafaQuranMarkdown(
  ref: NakafaAgentContentRef,
  readers: NakafaMarkdownReaders
) {
  return Effect.gen(function* () {
    const loadSurah = readers.loadSurah ?? getSurah;
    const readQuran = readers.readQuran ?? getNakafaAgentQuranReference;
    const surahNumber = parseQuranSurahRoute(ref.route);

    if (Option.isNone(surahNumber)) {
      return Option.none();
    }

    const surah = yield* Effect.option(loadSurah(surahNumber.value));

    if (Option.isNone(surah)) {
      return Option.none();
    }

    const reference = yield* readQuran({
      from_verse: 1,
      locale: ref.locale,
      surah: surah.value.number,
      to_verse: surah.value.numberOfVerses,
    });

    if (Option.isNone(reference)) {
      return Option.none();
    }

    const markdown = yield* decodeNakafaAgentMarkdown({
      ...ref,
      description: reference.value.translation,
      text: [
        `# ${reference.value.name}`,
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
    });

    return Option.some(markdown);
  });
}

/** Validates an agent markdown payload without throwing from render flows. */
export function decodeNakafaAgentMarkdown(markdown: unknown) {
  return Effect.try({
    try: () => Schema.decodeUnknownSync(NakafaAgentMarkdownSchema)(markdown),
    catch: (error) =>
      new NakafaAgentDataReadError({
        cause: getUnknownErrorMessage(error),
        message: "Unable to build Nakafa agent markdown.",
      }),
  });
}

/** Parses the surah segment from a validated `quran/{surah}` content route. */
function parseQuranSurahRoute(route: string) {
  const surahSegment = route.split("/").slice(1, 2).join("");

  if (!QURAN_SURAH_PATTERN.test(surahSegment)) {
    return Option.none();
  }

  const surahNumber = Number(surahSegment);

  if (surahNumber.toString() !== surahSegment) {
    return Option.none();
  }

  return Option.some(surahNumber);
}
