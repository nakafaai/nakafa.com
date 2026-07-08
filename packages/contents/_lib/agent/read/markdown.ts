import {
  getUnknownErrorMessage,
  NakafaAgentDataReadError,
} from "@repo/contents/_lib/agent/errors";
import { getNakafaAgentQuranReference } from "@repo/contents/_lib/agent/quran/read";
import { resolveNakafaContentRef } from "@repo/contents/_lib/agent/refs";
import { NakafaAgentMarkdownSchema } from "@repo/contents/_lib/agent/schema/read";
import type { NakafaAgentContentRef } from "@repo/contents/_lib/agent/schema/ref";
import { getContentMetadataWithRaw } from "@repo/contents/_lib/metadata";
import { getSurah } from "@repo/contents/_lib/quran";
import { parseQuranSurahNumberForRoute } from "@repo/contents/_types/graph/projection";
import { Effect, Option, Schema } from "effect";

/** Runtime readers needed to resolve a graph content ref into markdown output. */
interface NakafaMarkdownReaders {
  readonly loadContent?: typeof getContentMetadataWithRaw;
  readonly loadSurah?: typeof getSurah;
  readonly readQuran?: typeof getNakafaAgentQuranReference;
}

/** Retrieves full agent-readable markdown by canonical Nakafa URL projection. */
export const getNakafaAgentMarkdown = Effect.fn("NakafaAgent.getMarkdown")(
  function* (input: string, readers: NakafaMarkdownReaders = {}) {
    const ref = yield* resolveNakafaContentRef(input);

    if (Option.isNone(ref)) {
      return Option.none();
    }

    if (ref.value.section === "quran") {
      return yield* renderNakafaQuranMarkdown(ref.value, readers);
    }

    return yield* renderNakafaMdxMarkdown(ref.value, readers);
  }
);

/** Renders article and lesson material MDX source as agent markdown. */
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

/** Renders a full Quran surah as agent markdown for content retrieval. */
function renderNakafaQuranMarkdown(
  ref: NakafaAgentContentRef,
  readers: NakafaMarkdownReaders
) {
  return Effect.gen(function* () {
    const loadSurah = readers.loadSurah ?? getSurah;
    const readQuran = readers.readQuran ?? getNakafaAgentQuranReference;
    const surahNumber = yield* parseQuranSurahNumberForRoute(ref.route);

    const surah = yield* Effect.option(loadSurah(surahNumber));

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
