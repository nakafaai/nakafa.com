import { projectNakafaQuranReference } from "@repo/backend/agent/quran/projection";
import {
  decodeNakafaMarkdown,
  parseQuranReferenceOptions,
  toNakafaQuranDataReadError,
} from "@repo/backend/client/nakafa/decode";
import { readNakafaRuntimeQuery } from "@repo/backend/client/nakafa/query";
import {
  decodePublishedQuranMarkdown,
  renderQuranReadingSourcesMarkdown,
  renderQuranTafsirAccessMarkdown,
} from "@repo/backend/client/quran/markdown";
import { renderQuranTranslationMarkdown } from "@repo/backend/client/quran/notes";
import {
  decodePublishedQuranReference,
  type PublishedQuranReference,
} from "@repo/backend/client/quran/reference";
import { parseQuranSurahNumber } from "@repo/backend/client/quran/route";
import { api } from "@repo/backend/convex/_generated/api";
import { createNakafaContentRefFromGraphProjection } from "@repo/contents/_lib/agent/refs";
import type { NakafaAgentMarkdown } from "@repo/contents/_lib/agent/schema/read";
import type { NakafaAgentContentRef } from "@repo/contents/_lib/agent/schema/ref";
import { Effect, Option } from "effect";

type ParsedQuranReferenceOptions = Effect.Success<
  ReturnType<typeof parseQuranReferenceOptions>
>;

/** Reads one bounded source-grounded Quran passage. */
export const readNakafaQuranReference = Effect.fn("NakafaQuran.readReference")(
  function* (convexUrl: string, input: unknown) {
    const parsed = yield* parseQuranReferenceOptions(input);
    const result = yield* readNakafaRuntimeQuery(
      convexUrl,
      api.contentRelease.quran.passage,
      referenceArgs(parsed)
    );
    const reference = yield* decodePublishedQuranReference(result, {
      appLocale: parsed.locale,
      surahNumber: parsed.surah,
    }).pipe(Effect.mapError(toNakafaQuranDataReadError));
    const identity = projectReferenceIdentity(reference.search, parsed);
    if (Option.isNone(identity)) {
      return Option.none();
    }
    return Option.some(
      yield* projectNakafaQuranReference({
        ...identity.value,
        reference,
      })
    );
  }
);

/** Builds the shared public identity from one verified reference search row. */
function projectReferenceIdentity(
  search: PublishedQuranReference["search"],
  parsed: ParsedQuranReferenceOptions
) {
  const ref = createNakafaContentRefFromGraphProjection({
    ...search.graph,
    content_id: search.graph.assetId,
    locale: search.appLocale,
    route: search.route,
    section: "quran",
  });
  return Option.map(ref, (value) => ({
    appLocale: parsed.locale,
    includeTafsir: parsed.include_tafsir,
    ref: value,
  }));
}

/** Projects decoded public options into the direct Convex query shape. */
function referenceArgs(input: ParsedQuranReferenceOptions) {
  return {
    appLocale: input.locale,
    fromVerse: input.from_verse,
    surahNumber: input.surah,
    toVerse: input.to_verse,
  };
}

/** Reads one complete signed Quran markdown projection. */
const readQuranMarkdownPublication = Effect.fn(
  "NakafaQuran.readMarkdownPublication"
)(function* (
  convexUrl: string,
  appLocale: NakafaAgentContentRef["locale"],
  surahNumber: number
) {
  const result = yield* readNakafaRuntimeQuery(
    convexUrl,
    api.contentRelease.quran.prose,
    { appLocale, surahNumber }
  );
  return yield* decodePublishedQuranMarkdown(result, {
    appLocale,
    surahNumber,
  });
});

/** Renders one signed Quran surah as full agent markdown. */
export const readQuranMarkdown = Effect.fn("NakafaQuran.readMarkdown")(
  function* (convexUrl: string, ref: NakafaAgentContentRef) {
    const [section, value, extra] = ref.route.split("/");
    const surahNumber = parseQuranSurahNumber(value);
    if (section !== "quran" || extra !== undefined || surahNumber === null) {
      return Option.none<NakafaAgentMarkdown>();
    }
    const publication = yield* readQuranMarkdownPublication(
      convexUrl,
      ref.locale,
      surahNumber
    ).pipe(
      Effect.catchTag("QuranPublicationError", (error) =>
        Effect.fail(toNakafaQuranDataReadError(error))
      )
    );
    const surah = publication.surah;
    const title = getSurahName(surah);
    const meaning = surah.name.meaning[ref.locale];
    const metadata = [
      `# ${title}`,
      "",
      `Meaning: ${meaning}`,
      `Revelation: ${surah.revelation.place}`,
      "",
      ...renderQuranReadingSourcesMarkdown(publication.sources),
      ...renderQuranTafsirAccessMarkdown(publication.tafsirAccess),
      "## Verses",
      "",
    ];
    const preBismillah =
      publication.preBismillah === null
        ? []
        : [
            publication.preBismillah.arabic,
            "",
            ...renderQuranTranslationMarkdown(
              publication.preBismillah.translation
            ),
            "",
          ];
    const markdown = yield* decodeNakafaMarkdown({
      ...ref,
      description: meaning,
      text: [
        ...metadata,
        ...preBismillah,
        ...publication.verses.flatMap((verse) => [
          `### Verse ${verse.number.inSurah}`,
          "",
          verse.arabic,
          "",
          ...renderQuranTranslationMarkdown(verse.translation),
          "",
        ]),
      ].join("\n"),
      title,
    });
    return Option.some(markdown);
  }
);

/** Returns the source-authenticated transliterated surah name. */
export function getSurahName(surah: {
  readonly name: {
    readonly transliteration: string;
  };
}) {
  return surah.name.transliteration;
}
