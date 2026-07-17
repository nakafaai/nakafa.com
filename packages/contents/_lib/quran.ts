import {
  QuranCorpusError,
  SurahNotFoundError,
} from "@repo/contents/_shared/error";
import {
  type Surah,
  SurahMetadataSchema,
  SurahSchema,
} from "@repo/contents/_types/quran";
import { quran } from "@repo/contents/quran/source";
import type { Locale } from "@repo/utilities/locales";
import { Effect, Option, Schema } from "effect";

/** Checks whether a route number can identify Quran data. */
function isPositiveInteger(value: number) {
  return Number.isInteger(value) && value > 0;
}

/**
 * Retrieves a surah by its Quran number.
 *
 * @param id - Surah number from the available Quran data
 * @returns Effect that resolves to the validated surah or fails when missing
 */
export function getSurah(id: number): Effect.Effect<Surah, SurahNotFoundError> {
  return Effect.gen(function* () {
    if (!isPositiveInteger(id)) {
      return yield* Effect.fail(
        new SurahNotFoundError({
          message: "Surah number must be a positive integer.",
          surahNumber: id,
        })
      );
    }

    const surah = quran.find((item) => item.number === id);
    const result = Schema.decodeUnknownOption(SurahSchema)(surah);
    if (Option.isNone(result)) {
      return yield* Effect.fail(
        new SurahNotFoundError({
          message: "Surah was not found.",
          surahNumber: id,
        })
      );
    }

    return result.value;
  });
}

/** Decodes Quran metadata or fails with one typed corpus error. */
const decodeQuranMetadata = Effect.fn("Quran.decodeMetadata")(function* (
  source: unknown
) {
  return yield* Schema.decodeUnknown(Schema.Array(SurahMetadataSchema))(
    source,
    { errors: "all" }
  ).pipe(
    Effect.mapError(
      (cause) =>
        new QuranCorpusError({
          cause,
          message: "Unable to decode the Quran metadata corpus.",
        })
    )
  );
});

/** Reads every metadata row from the canonical Quran corpus. */
export const readQuranMetadata = Effect.fn("Quran.readMetadata")(function* () {
  return yield* decodeQuranMetadata(quran);
});

/**
 * Resolves the localized surah transliteration from the exact locale contract.
 *
 * @param locale - Locale used to select the display name
 * @param name - Surah name payload from Quran data
 * @returns Best available name for the requested locale
 */
export function getSurahName({
  locale,
  name,
}: {
  locale: Locale;
  name: Surah["name"];
}): string {
  return name.transliteration[locale];
}
