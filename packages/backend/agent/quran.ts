import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import type { QuranRuntimeVerse } from "@nakafa/aksara-contracts/quran/snapshot/row";
import {
  decodeAgentInput,
  decodeAgentOutput,
} from "@repo/backend/agent/decode";
import { readAgentQuery } from "@repo/backend/agent/query";
import {
  decodePublishedQuranCatalog,
  decodePublishedQuranReference,
  type QuranPublicationError,
} from "@repo/backend/client/quran/decode";
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
  const catalog = yield* decodePublishedQuranCatalog(catalogResult).pipe(
    Effect.mapError(quranReadError)
  );
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
  const reference = yield* decodePublishedQuranReference(result, {
    appLocale: parsed.locale,
    surahNumber: parsed.surah,
  }).pipe(Effect.mapError(quranReadError));
  const ref = createNakafaContentRefFromGraphProjection({
    ...reference.search.graph,
    content_id: reference.search.graph.assetId,
    locale: reference.search.appLocale,
    route: reference.search.route,
    section: "quran",
  });
  if (Option.isNone(ref)) {
    return yield* new NakafaAgentDataReadError({
      cause: "The signed Quran reference has an invalid graph identity.",
      message: "Unable to read signed Nakafa Quran reference.",
    });
  }

  const verses = yield* Effect.forEach(reference.verses, (verse) =>
    projectVerse(verse, parsed.locale, parsed.include_tafsir)
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

/** Projects one signed verse into the public locale contract. */
const projectVerse = Effect.fn("agent.quran.projectVerse")(function* (
  verse: QuranRuntimeVerse,
  appLocale: AppLocaleCode,
  includeTafsir: boolean
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
  const row = {
    arabic: verse.text.arabic,
    number: verse.number.inSurah,
    translation: localized.value.text,
  };
  if (!(includeTafsir && appLocale === "id")) {
    return row;
  }
  const tafsir = verse.tafsir.find(
    (interpretation) => interpretation.appLocale === "id"
  );
  if (!tafsir) {
    return yield* new NakafaAgentDataReadError({
      cause: `Signed Quran verse ${verse.number.inQuran} has no Indonesian tafsir.`,
      message: "Unable to read signed Nakafa Quran reference.",
    });
  }
  return { ...row, tafsir: tafsir.text };
});

/** Enforces the public range contract before reading publication rows. */
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

/** Maps signed Quran failures into the public agent error contract. */
function quranReadError(error: QuranPublicationError) {
  return new NakafaAgentDataReadError({
    cause: error.reason,
    message: `Unable to read signed Nakafa Quran ${error.operation}.`,
  });
}
