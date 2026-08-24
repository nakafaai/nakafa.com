import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import type { QuranRuntimeVerse } from "@nakafa/aksara-contracts/quran/snapshot/row";
import {
  decodeAgentInput,
  decodeAgentOutput,
} from "@repo/backend/agent/decode";
import { readAgentQuery } from "@repo/backend/agent/query";
import {
  decodeAgentQuranCatalog,
  decodeAgentQuranReference as decodeSignedQuranReference,
} from "@repo/backend/agent/quran/publication";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import type { readQuranSurahs } from "@repo/backend/convex/contentRelease/quran/catalog";
import type { readQuranReference } from "@repo/backend/convex/contentRelease/quran/reference";
import { NAKAFA_AGENT_MAX_QURAN_REFERENCE_VERSES } from "@repo/contents/_lib/agent/constants";
import {
  NakafaAgentDataReadError,
  NakafaAgentInputError,
} from "@repo/contents/_lib/agent/errors";
import { createNakafaContentRefFromGraphProjection } from "@repo/contents/_lib/agent/refs";
import {
  NakafaAgentQuranReferenceOptionsSchema,
  NakafaAgentQuranReferenceSchema,
} from "@repo/contents/_lib/agent/schema/quran";
import { makeFunctionReference } from "convex/server";
import { Effect, Option, type Schema } from "effect";

const quranCatalogReference = makeFunctionReference<
  "query",
  Record<string, never>,
  Effect.Success<ReturnType<typeof readQuranSurahs>>
>("contentRelease/quran:surahs");

const quranReference = makeFunctionReference<
  "query",
  {
    readonly appLocale: AppLocaleCode;
    readonly fromVerse: number;
    readonly surahNumber: number;
    readonly toVerse?: number;
  },
  Effect.Success<ReturnType<typeof readQuranReference>>
>("contentRelease/quran:reference");

/** Reads one reviewed translation matching the selected application locale. */
const readTranslation = Effect.fn("agent.quran.readTranslation")(function* (
  verse: QuranRuntimeVerse,
  appLocale: AppLocaleCode
) {
  const localized = verse.translations.find(
    (translation) => translation.appLocale === appLocale
  );
  if (!localized) {
    return yield* new NakafaAgentDataReadError({
      cause: `Signed Quran verse ${verse.number.inQuran} has no ${appLocale} translation.`,
      message: "Unable to read signed Nakafa Quran reference.",
    });
  }
  return localized.value;
});

/** Reads an optional reviewed Indonesian tafsir. */
function findTafsir(verse: QuranRuntimeVerse) {
  return verse.tafsir.find(
    (interpretation) => interpretation.appLocale === "id"
  );
}

/** Returns one bounded signed Quran reference without leaving Convex. */
export const getNakafaQuranReference = Effect.fn(
  "agent.getNakafaQuranReference"
)(function* (ctx: ActionCtx, input: unknown) {
  const parsed = yield* decodeAgentInput(
    NakafaAgentQuranReferenceOptionsSchema,
    input,
    "Invalid Nakafa Quran reference options."
  );
  const lastVerse = parsed.to_verse ?? parsed.from_verse;
  yield* validateRequestedRange(parsed.from_verse, lastVerse);

  const catalogResult = yield* readAgentQuery(
    ctx,
    quranCatalogReference,
    {},
    "Unable to read the signed Nakafa Quran catalog."
  );
  const catalog = yield* decodeAgentQuranCatalog(catalogResult);
  const surah = catalog.surahs.find(
    (candidate) => candidate.number === parsed.surah
  );
  if (!surah) {
    return Option.none<
      Schema.Schema.Type<typeof NakafaAgentQuranReferenceSchema>
    >();
  }
  if (lastVerse > surah.numberOfVerses) {
    return yield* invalidRange(
      `Surah ${parsed.surah} ends at verse ${surah.numberOfVerses}.`
    );
  }

  const result = yield* readAgentQuery(
    ctx,
    quranReference,
    {
      appLocale: parsed.locale,
      fromVerse: parsed.from_verse,
      surahNumber: parsed.surah,
      toVerse: parsed.to_verse,
    },
    "Unable to read the signed Nakafa Quran reference."
  );
  const reference = yield* decodeSignedQuranReference(result, {
    appLocale: parsed.locale,
    surahNumber: parsed.surah,
  });
  const ref = createNakafaContentRefFromGraphProjection({
    ...reference.search.graph,
    content_id: reference.search.graph.assetId,
    locale: reference.search.appLocale,
    route: reference.search.route,
    section: "quran",
  });
  if (Option.isNone(ref)) {
    return Option.none<
      Schema.Schema.Type<typeof NakafaAgentQuranReferenceSchema>
    >();
  }

  const verses = yield* Effect.forEach(reference.verses, (verse) =>
    Effect.gen(function* () {
      const translation = yield* readTranslation(verse, parsed.locale);
      const row = {
        arabic: verse.text.arabic,
        number: verse.number.inSurah,
        translation: translation.text,
      };
      if (!(parsed.include_tafsir && parsed.locale === "id")) {
        return row;
      }
      const tafsir = findTafsir(verse);
      if (!tafsir) {
        return yield* new NakafaAgentDataReadError({
          cause: `Signed Quran verse ${verse.number.inQuran} has no Indonesian tafsir.`,
          message: "Unable to read signed Nakafa Quran reference.",
        });
      }
      return { ...row, tafsir: tafsir.text };
    })
  );
  const decoded = yield* decodeAgentOutput(
    NakafaAgentQuranReferenceSchema,
    {
      ...ref.value,
      name: reference.surah.name.transliteration,
      revelation: reference.surah.revelation.place,
      translation: reference.surah.name.translation,
      verses,
    },
    "Unable to build Nakafa Quran reference."
  );
  return Option.some(decoded);
});

/** Enforces the public agent range contract before reading publication rows. */
function validateRequestedRange(fromVerse: number, toVerse: number) {
  if (toVerse < fromVerse) {
    return invalidRange(
      "to_verse must be greater than or equal to from_verse."
    );
  }
  if (toVerse - fromVerse + 1 > NAKAFA_AGENT_MAX_QURAN_REFERENCE_VERSES) {
    return invalidRange(
      `Request at most ${NAKAFA_AGENT_MAX_QURAN_REFERENCE_VERSES} verses at a time.`
    );
  }
  return Effect.void;
}

/** Creates one actionable typed range error. */
function invalidRange(cause: string) {
  return new NakafaAgentInputError({
    cause,
    message: "Invalid Quran verse range.",
  });
}
