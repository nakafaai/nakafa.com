import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { buildContentSearchRef } from "@repo/backend/convex/contents/helpers/search/documents";
import type {
  Locale,
  NakafaSection,
} from "@repo/backend/convex/lib/validators/contents";
import { ConvexError } from "convex/values";

const MAX_SURAH_VERSES = 300;
const MAX_REFERENCE_VERSES = 50;

type QuranSection = Extract<NakafaSection, "quran">;

const QURAN_SECTION: QuranSection = "quran";

/** Lists all synced Quran surahs without verse payloads. */
export async function listQuranSurahsImpl(ctx: QueryCtx) {
  const surahs = await ctx.db.query("quranSurahs").take(115);

  if (surahs.length > 114) {
    throwQuranIntegrityError("Quran surah count exceeds the expected limit.");
  }

  return surahs
    .sort((left, right) => left.number - right.number)
    .map(toQuranSurahMetadata);
}

/** Loads one Quran surah plus adjacent metadata from the runtime model. */
export async function getQuranSurahPageImpl(
  ctx: QueryCtx,
  args: { surah: number }
) {
  const surah = await getSurahByNumber(ctx, args.surah);

  if (!surah) {
    return null;
  }

  const [verses, prevSurah, nextSurah] = await Promise.all([
    getSurahVerses(ctx, surah.number),
    getSurahByNumber(ctx, surah.number - 1),
    getSurahByNumber(ctx, surah.number + 1),
  ]);

  if (verses.length !== surah.numberOfVerses) {
    throwQuranIntegrityError("Quran verse count does not match the surah row.");
  }

  return {
    nextSurah: nextSurah ? toQuranSurahMetadata(nextSurah) : null,
    prevSurah: prevSurah ? toQuranSurahMetadata(prevSurah) : null,
    surahData: {
      ...toQuranSurahMetadata(surah),
      verses: verses.map(toQuranVerse),
    },
  };
}

/** Loads a bounded Quran verse range for agent/API references. */
export async function getQuranReferenceImpl(
  ctx: QueryCtx,
  args: {
    fromVerse: number;
    includeTafsir: boolean;
    locale: Locale;
    surah: number;
    toVerse?: number;
  }
) {
  const firstVerse = args.fromVerse;
  const lastVerse = args.toVerse ?? firstVerse;

  if (firstVerse < 1 || lastVerse < firstVerse) {
    return null;
  }

  if (lastVerse - firstVerse + 1 > MAX_REFERENCE_VERSES) {
    throwQuranIntegrityError("Quran reference range exceeds the safe limit.");
  }

  const surah = await getSurahByNumber(ctx, args.surah);

  if (!surah || lastVerse > surah.numberOfVerses) {
    return null;
  }

  const verses = await ctx.db
    .query("quranVerses")
    .withIndex("by_surahNumber_and_verseNumber", (q) =>
      q
        .eq("surahNumber", args.surah)
        .gte("verseNumber", firstVerse)
        .lte("verseNumber", lastVerse)
    )
    .take(MAX_REFERENCE_VERSES + 1);

  if (verses.length > MAX_REFERENCE_VERSES) {
    throwQuranIntegrityError("Quran reference query exceeded the safe limit.");
  }

  if (verses.length !== lastVerse - firstVerse + 1) {
    return null;
  }

  const route = `quran/${surah.number}`;
  const routeProjection = await getQuranRouteProjection(ctx, {
    locale: args.locale,
    route,
  });

  if (!routeProjection) {
    return null;
  }

  const ref = buildContentSearchRef(routeProjection);

  return {
    alignmentId: ref.alignmentId,
    assetId: ref.assetId,
    conceptId: ref.conceptId,
    content_id: ref.content_id,
    learningObjectId: ref.learningObjectId,
    lensId: ref.lensId,
    locale: ref.locale,
    markdown_url: ref.markdown_url,
    name: getSurahName({ locale: args.locale, name: surah.name }),
    revelation: surah.revelation[args.locale],
    route: ref.route,
    section: QURAN_SECTION,
    translation: surah.name.translation[args.locale],
    url: ref.url,
    verses: verses
      .sort((left, right) => left.verseNumber - right.verseNumber)
      .map((verse) => ({
        arabic: verse.text.arab,
        number: verse.verseNumber,
        ...(args.includeTafsir ? { tafsir: verse.tafsir.id.short } : {}),
        translation: verse.translation[args.locale],
        transliteration: verse.text.transliteration.en,
      })),
  };
}

/** Loads the synced Quran route projection that owns graph identity. */
async function getQuranRouteProjection(
  ctx: QueryCtx,
  args: { locale: Locale; route: string }
) {
  const route = await ctx.db
    .query("contentRoutes")
    .withIndex("by_locale_and_route", (q) =>
      q.eq("locale", args.locale).eq("route", args.route)
    )
    .unique();

  if (!route || route.section !== QURAN_SECTION) {
    return null;
  }

  return route;
}

/** Loads one Quran surah metadata row by its canonical number. */
async function getSurahByNumber(ctx: QueryCtx, surahNumber: number) {
  return await ctx.db
    .query("quranSurahs")
    .withIndex("by_number", (q) => q.eq("number", surahNumber))
    .unique();
}

/** Loads all verses for one surah under the documented Quran verse bound. */
async function getSurahVerses(ctx: QueryCtx, surahNumber: number) {
  const verses = await ctx.db
    .query("quranVerses")
    .withIndex("by_surahNumber", (q) => q.eq("surahNumber", surahNumber))
    .take(MAX_SURAH_VERSES + 1);

  if (verses.length > MAX_SURAH_VERSES) {
    throwQuranIntegrityError("Quran surah exceeds the safe verse limit.");
  }

  return verses.sort((left, right) => left.verseNumber - right.verseNumber);
}

/** Projects a Quran surah row into the public metadata shape. */
function toQuranSurahMetadata(surah: Doc<"quranSurahs">) {
  return {
    name: surah.name,
    number: surah.number,
    numberOfVerses: surah.numberOfVerses,
    preBismillah: surah.preBismillah,
    revelation: surah.revelation,
    sequence: surah.sequence,
  };
}

/** Projects a Quran verse row into the public Quran page shape. */
function toQuranVerse(verse: Doc<"quranVerses">) {
  return {
    audio: verse.audio,
    meta: {
      hizbQuarter: verse.hizbQuarter,
      juz: verse.juz,
      manzil: verse.manzil,
      page: verse.page,
      ruku: verse.ruku,
      sajda: {
        obligatory: verse.sajdaObligatory,
        recommended: verse.sajdaRecommended,
      },
    },
    number: {
      inQuran: verse.quranNumber,
      inSurah: verse.verseNumber,
    },
    tafsir: verse.tafsir,
    text: verse.text,
    translation: verse.translation,
  };
}

/**
 * Resolves the best localized Quran display name from synced metadata.
 */
export function getSurahName({
  locale,
  name,
}: {
  locale: Locale;
  name: Doc<"quranSurahs">["name"];
}) {
  return name.transliteration[locale] ?? name.long;
}

/** Raises a structured integrity failure for impossible Quran runtime states. */
function throwQuranIntegrityError(message: string): never {
  throw new ConvexError({
    code: "QURAN_RUNTIME_INTEGRITY_ERROR",
    message,
  });
}
