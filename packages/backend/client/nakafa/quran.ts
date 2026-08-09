import {
  decodeNakafaMarkdown,
  decodeNakafaQuranReference,
  parseQuranReferenceOptions,
  toNakafaQuranDataReadError,
} from "@repo/backend/client/nakafa/decode";
import { fetchNakafaRuntimeQuery } from "@repo/backend/client/nakafa/query";
import {
  decodePublishedQuranPage,
  decodePublishedQuranReference,
} from "@repo/backend/client/quran/decode";
import { parseQuranSurahNumber } from "@repo/backend/client/quran/route";
import { api } from "@repo/backend/convex/_generated/api";
import { createNakafaContentRefFromGraphProjection } from "@repo/contents/_lib/agent/refs";
import type { NakafaAgentMarkdown } from "@repo/contents/_lib/agent/schema/read";
import type { NakafaAgentContentRef } from "@repo/contents/_lib/agent/schema/ref";
import { Effect, Option } from "effect";

/** Reads a bounded Quran reference from the active signed publication. */
export function readNakafaQuranReference(convexUrl: string, input: unknown) {
  return Effect.gen(function* () {
    const parsed = yield* parseQuranReferenceOptions(input);
    const result = yield* fetchNakafaRuntimeQuery(
      convexUrl,
      "contentRelease.quran.reference",
      api.contentRelease.quran.reference,
      {
        fromVerse: parsed.from_verse,
        locale: parsed.locale,
        surahNumber: parsed.surah,
        toVerse: parsed.to_verse,
      }
    );
    const reference = yield* decodePublishedQuranReference(result, {
      locale: parsed.locale,
      surahNumber: parsed.surah,
    }).pipe(Effect.mapError(toNakafaQuranDataReadError));
    const ref = createNakafaContentRefFromGraphProjection({
      ...reference.search.graph,
      content_id: reference.search.graph.assetId,
      locale: reference.search.locale,
      route: reference.search.route,
      section: "quran",
    });
    if (Option.isNone(ref)) {
      return Option.none<
        Effect.Effect.Success<ReturnType<typeof decodeNakafaQuranReference>>
      >();
    }

    const decoded = yield* decodeNakafaQuranReference({
      ...ref.value,
      name: reference.surah.name.transliteration,
      revelation: reference.surah.revelation.place,
      translation: reference.surah.name.translation,
      verses: reference.verses.map((verse) => {
        const row = {
          arabic: verse.text.arabic,
          number: verse.number.inSurah,
          translation: verse.translation[parsed.locale].text,
        };
        if (!parsed.include_tafsir || parsed.locale !== "id") {
          return row;
        }
        return { ...row, tafsir: verse.tafsir.id.text };
      }),
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

    const result = yield* fetchNakafaRuntimeQuery(
      convexUrl,
      "contentRelease.quran.page",
      api.contentRelease.quran.page,
      {
        locale: ref.locale,
        surahNumber,
      }
    );
    const page = yield* decodePublishedQuranPage(result, {
      surahNumber,
    }).pipe(Effect.mapError(toNakafaQuranDataReadError));
    const surah = page.surah;
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
        ...page.verses.flatMap((verse) => [
          `### Verse ${verse.number.inSurah}`,
          "",
          verse.text.arabic,
          "",
          `Translation: ${verse.translation[ref.locale].text}`,
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
  readonly name: { readonly transliteration: string };
}) {
  return surah.name.transliteration;
}
