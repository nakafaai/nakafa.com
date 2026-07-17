import {
  decodeNakafaMarkdown,
  decodeNakafaQuranReference,
  parseQuranReferenceOptions,
} from "@repo/backend/client/nakafa/decode";
import { fetchNakafaRuntimeQuery } from "@repo/backend/client/nakafa/query";
import type { RuntimeQuranSurah } from "@repo/backend/client/nakafa/types";
import { api } from "@repo/backend/convex/_generated/api";
import type { NakafaAgentMarkdown } from "@repo/contents/_lib/agent/schema/read";
import type { NakafaAgentContentRef } from "@repo/contents/_lib/agent/schema/ref";
import { getQuranSurahNumberForRoute } from "@repo/contents/_types/graph/projection";
import type { Locale } from "@repo/utilities/locales";
import { Effect, Option } from "effect";

/** Reads a bounded Quran reference from Convex runtime rows. */
export function readNakafaQuranReference(convexUrl: string, input: unknown) {
  return Effect.gen(function* () {
    const parsed = yield* parseQuranReferenceOptions(input);
    const reference = yield* fetchNakafaRuntimeQuery(
      convexUrl,
      "getQuranReference",
      api.contents.queries.runtime.getQuranReference,
      {
        fromVerse: parsed.from_verse,
        includeTafsir: parsed.include_tafsir,
        locale: parsed.locale,
        surah: parsed.surah,
        toVerse: parsed.to_verse,
      }
    );

    if (!reference) {
      return Option.none();
    }

    const decoded = yield* decodeNakafaQuranReference(reference);
    return Option.some(decoded);
  });
}

/** Renders one synced Quran surah as full agent markdown. */
export function readQuranMarkdown(
  convexUrl: string,
  ref: NakafaAgentContentRef
) {
  return Effect.gen(function* () {
    const surahNumber = getQuranSurahNumberForRoute(ref.route, ref.locale);

    if (surahNumber === null) {
      return Option.none<NakafaAgentMarkdown>();
    }

    const page = yield* fetchNakafaRuntimeQuery(
      convexUrl,
      "getQuranSurahPage",
      api.contents.queries.runtime.getQuranSurahPage,
      {
        surah: surahNumber,
      }
    );

    if (!page) {
      return Option.none<NakafaAgentMarkdown>();
    }

    const surah = page.surahData;
    const title = getSurahName({ locale: ref.locale, surah });
    const translation = surah.name.translation[ref.locale];
    const markdown = yield* decodeNakafaMarkdown({
      ...ref,
      description: translation,
      text: [
        `# ${title}`,
        "",
        `Translation: ${translation}`,
        `Revelation: ${surah.revelation[ref.locale]}`,
        "",
        "## Verses",
        "",
        ...surah.verses.flatMap((verse) => [
          `### Verse ${verse.number.inSurah}`,
          "",
          verse.text.arab,
          "",
          `Transliteration: ${verse.text.transliteration.en}`,
          "",
          `Translation: ${verse.translation[ref.locale]}`,
          "",
        ]),
      ].join("\n"),
      title,
    });

    return Option.some(markdown);
  });
}

/** Returns the locale-aware display name for one synced Quran surah. */
export function getSurahName({
  locale,
  surah,
}: {
  locale: Locale;
  surah: Pick<RuntimeQuranSurah, "name">;
}) {
  return surah.name.transliteration[locale];
}
