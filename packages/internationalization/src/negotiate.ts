import { readCookie } from "@repo/internationalization/src/cookie";
import {
  DEFAULT_LOCALE,
  decodeLocale,
  LOCALE_COOKIE,
  type Locale,
} from "@repo/internationalization/src/locale";
import { Array as Arr, Option, Order, Schema } from "effect";

/** One language range of an Accept-Language header, with its quality value. */
const LanguageRange = Schema.Struct({
  quality: Schema.Finite,
  tag: Schema.String,
});

type LanguageRange = typeof LanguageRange.Type;

/**
 * Reads one entry of an Accept-Language header, such as `id-ID;q=0.9`. A
 * missing quality is 1. A quality that is not a number refuses the language,
 * so it counts as 0, like `q=0`.
 */
function readLanguageRange(entry: string): LanguageRange {
  const [tag, ...parameters] = entry.split(";");
  const quality = Arr.reduce(parameters, 1, (current, parameter) => {
    const [name, value] = parameter.split("=");
    if (name.trim() !== "q") {
      return current;
    }
    // `Number` ignores surrounding spaces, and reads a missing value as NaN.
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  });
  return LanguageRange.make({ quality, tag: tag.trim().toLowerCase() });
}

/**
 * The language ranges of an Accept-Language header, best first. A range with a
 * quality of zero or less refuses its language, so it is dropped. Ranges of
 * equal quality keep the order of the header.
 */
function readLanguageRanges(header: string): readonly LanguageRange[] {
  const byQuality = Order.mapInput(
    Order.Number,
    (range: LanguageRange) => -range.quality
  );
  return Arr.sort(byQuality)(
    Arr.filter(
      Arr.map(header.split(","), readLanguageRange),
      (range) => range.quality > 0
    )
  );
}

/** The public locale that a language tag names by its primary subtag, or none. */
function readTagLocale(tag: string): Option.Option<Locale> {
  return Option.flatMap(Arr.get(tag.split("-"), 0), decodeLocale);
}

/** The first public locale in an Accept-Language header, by quality, or none. */
function readAcceptedLocale(
  acceptLanguage: string | null
): Option.Option<Locale> {
  if (acceptLanguage === null) {
    return Option.none();
  }
  return Arr.findFirst(readLanguageRanges(acceptLanguage), (range) =>
    readTagLocale(range.tag)
  );
}

/**
 * Chooses the locale of a request: the valid `NAKAFA_LOCALE` cookie first, then
 * the first Accept-Language range that names a public locale, then the default.
 * An invalid cookie value and an unknown language are skipped, so they never
 * change the answer.
 */
export function negotiateLocale(headers: Headers): Locale {
  return readCookie(headers, LOCALE_COOKIE).pipe(
    Option.flatMap(decodeLocale),
    Option.orElse(() => readAcceptedLocale(headers.get("accept-language"))),
    Option.getOrElse(() => DEFAULT_LOCALE)
  );
}
