import {
  projectNakafaQuranReferenceV1,
  projectNakafaQuranReferenceV2,
} from "@repo/backend/agent/quran/projection";
import {
  decodeNakafaMarkdown,
  parseQuranReferenceOptions,
  toNakafaQuranDataReadError,
} from "@repo/backend/client/nakafa/decode";
import { readNakafaRuntimeQuery } from "@repo/backend/client/nakafa/query";
import {
  decodePublishedQuranReference,
  type PublishedQuranReference,
} from "@repo/backend/client/quran/decode";
import { decodePublishedQuranMarkdown } from "@repo/backend/client/quran/markdown";
import { parseQuranSurahNumber } from "@repo/backend/client/quran/route";
import { decodePublishedQuranReferenceV2 } from "@repo/backend/client/quran/v2/reference";
import { api } from "@repo/backend/convex/_generated/api";
import { createNakafaContentRefFromGraphProjection } from "@repo/contents/_lib/agent/refs";
import type { NakafaAgentMarkdown } from "@repo/contents/_lib/agent/schema/read";
import type { NakafaAgentContentRef } from "@repo/contents/_lib/agent/schema/ref";
import { Effect, Option } from "effect";

type ParsedQuranReferenceOptions = Effect.Success<
  ReturnType<typeof parseQuranReferenceOptions>
>;

/** Reads a bounded Quran reference through the immutable V1 projection. */
export const readNakafaQuranReference = Effect.fn("NakafaQuran.readReference")(
  function* (convexUrl: string, input: unknown) {
    const parsed = yield* parseQuranReferenceOptions(input);
    const result = yield* readNakafaRuntimeQuery(
      convexUrl,
      api.contentRelease.quran.reference,
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
      yield* projectNakafaQuranReferenceV1({
        ...identity.value,
        reference,
      })
    );
  }
);

/** Reads a bounded Quran reference through the explicit V2 projection. */
export const readNakafaQuranReferenceV2 = Effect.fn(
  "NakafaQuran.readReferenceV2"
)(function* (convexUrl: string, input: unknown) {
  const parsed = yield* parseQuranReferenceOptions(input);
  const result = yield* readNakafaRuntimeQuery(
    convexUrl,
    api.contentRelease.quran.referenceV2,
    referenceArgs(parsed)
  );
  const reference = yield* decodePublishedQuranReferenceV2(result, {
    appLocale: parsed.locale,
    surahNumber: parsed.surah,
  }).pipe(Effect.mapError(toNakafaQuranDataReadError));
  const identity = projectReferenceIdentity(reference.search, parsed);
  if (Option.isNone(identity)) {
    return Option.none();
  }
  return Option.some(
    yield* projectNakafaQuranReferenceV2({
      ...identity.value,
      reference,
    })
  );
});

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
/** Renders one signed Quran surah as full agent markdown. */
export const readQuranMarkdown = Effect.fn("NakafaQuran.readMarkdown")(
  function* (convexUrl: string, ref: NakafaAgentContentRef) {
    const [section, value, extra] = ref.route.split("/");
    const surahNumber = parseQuranSurahNumber(value);
    if (section !== "quran" || extra !== undefined || surahNumber === null) {
      return Option.none<NakafaAgentMarkdown>();
    }
    const result = yield* readNakafaRuntimeQuery(
      convexUrl,
      api.contentRelease.quran.markdown,
      {
        appLocale: ref.locale,
        surahNumber,
      }
    );
    const publication = yield* decodePublishedQuranMarkdown(result, {
      appLocale: ref.locale,
      surahNumber,
    }).pipe(Effect.mapError(toNakafaQuranDataReadError));
    const surah = publication.surah;
    const title = getSurahName(surah);
    const translation = surah.name.translation;
    const markdown = yield* decodeNakafaMarkdown({
      ...ref,
      description: translation,
      text: [
        `# ${title}`,
        "",
        `Translation: ${translation}`,
        `Revelation: ${surah.revelation.place}`,
        "",
        "## Verses",
        "",
        ...publication.verses.flatMap((verse) => [
          `### Verse ${verse.number.inSurah}`,
          "",
          verse.arabic,
          "",
          `Translation: ${verse.translation.text}`,
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
