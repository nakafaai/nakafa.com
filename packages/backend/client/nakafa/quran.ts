import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import type { QuranRuntimeVerse } from "@nakafa/aksara-contracts/quran/snapshot/row";
import {
  decodeNakafaMarkdown,
  decodeNakafaQuranReference,
  parseQuranReferenceOptions,
  toNakafaQuranDataReadError,
} from "@repo/backend/client/nakafa/decode";
import { readNakafaRuntimeQuery } from "@repo/backend/client/nakafa/query";
import {
  decodePublishedQuranReference,
  QuranPublicationError,
} from "@repo/backend/client/quran/decode";
import { decodePublishedQuranMarkdown } from "@repo/backend/client/quran/markdown";
import { parseQuranSurahNumber } from "@repo/backend/client/quran/route";
import { api } from "@repo/backend/convex/_generated/api";
import { createNakafaContentRefFromGraphProjection } from "@repo/contents/_lib/agent/refs";
import type { NakafaAgentMarkdown } from "@repo/contents/_lib/agent/schema/read";
import type { NakafaAgentContentRef } from "@repo/contents/_lib/agent/schema/ref";
import { Effect, Option } from "effect";

/** Reads the exact reviewed translation selected by one application locale. */
const readPublishedQuranTranslation = Effect.fn("NakafaQuran.readTranslation")(
  function* (verse: QuranRuntimeVerse, appLocale: AppLocaleCode) {
    const localized = verse.translations.find(
      (translation) => translation.appLocale === appLocale
    );
    if (!localized) {
      return yield* new QuranPublicationError({
        operation: "reference",
        reason: `Signed Quran verse ${verse.number.inQuran} has no ${appLocale} translation.`,
      });
    }
    return localized.value;
  }
);
/** Reads optional reviewed Indonesian tafsir without inventing another locale. */
function findPublishedQuranTafsir(verse: QuranRuntimeVerse) {
  return verse.tafsir.find(
    (interpretation) => interpretation.appLocale === "id"
  );
}
/** Reads a bounded Quran reference from the active signed publication. */
export function readNakafaQuranReference(convexUrl: string, input: unknown) {
  return Effect.gen(function* () {
    const parsed = yield* parseQuranReferenceOptions(input);
    const result = yield* readNakafaRuntimeQuery(
      convexUrl,
      api.contentRelease.quran.reference,
      {
        fromVerse: parsed.from_verse,
        appLocale: parsed.locale,
        surahNumber: parsed.surah,
        toVerse: parsed.to_verse,
      }
    );
    const reference = yield* decodePublishedQuranReference(result, {
      appLocale: parsed.locale,
      surahNumber: parsed.surah,
    }).pipe(Effect.mapError(toNakafaQuranDataReadError));
    const ref = createNakafaContentRefFromGraphProjection({
      ...reference.search.graph,
      content_id: reference.search.graph.assetId,
      locale: reference.search.appLocale,
      route: reference.search.route,
      section: "quran",
    });
    if (Option.isNone(ref)) {
      return Option.none<
        Effect.Success<ReturnType<typeof decodeNakafaQuranReference>>
      >();
    }
    const verses = yield* Effect.forEach(reference.verses, (verse) =>
      Effect.gen(function* () {
        const translation = yield* readPublishedQuranTranslation(
          verse,
          parsed.locale
        );
        const row = {
          arabic: verse.text.arabic,
          number: verse.number.inSurah,
          translation: translation.text,
        };
        if (!(parsed.include_tafsir && parsed.locale === "id")) {
          return row;
        }
        const tafsir = findPublishedQuranTafsir(verse);
        if (!tafsir) {
          return yield* new QuranPublicationError({
            operation: "reference",
            reason: `Signed Quran verse ${verse.number.inQuran} has no Indonesian tafsir.`,
          });
        }
        return { ...row, tafsir: tafsir.text };
      })
    ).pipe(Effect.mapError(toNakafaQuranDataReadError));
    const decoded = yield* decodeNakafaQuranReference({
      ...ref.value,
      name: reference.surah.name.transliteration,
      revelation: reference.surah.revelation.place,
      translation: reference.surah.name.translation,
      verses,
    });
    return Option.some(decoded);
  });
}
/** Renders one signed Quran surah as full agent markdown. */
export function readQuranMarkdown(
  convexUrl: string,
  ref: NakafaAgentContentRef
) {
  return Effect.gen(function* () {
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
  });
}
/** Returns the source-authenticated transliterated surah name. */
export function getSurahName(surah: {
  readonly name: {
    readonly transliteration: string;
  };
}) {
  return surah.name.transliteration;
}
