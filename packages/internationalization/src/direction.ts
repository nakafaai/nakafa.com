import { Schema } from "effect";

/**
 * The direction in which the text of a locale runs. The `dir` attribute and
 * Base UI's `DirectionProvider` take these two words.
 */
export const TextDirection = Schema.Literals(["ltr", "rtl"]);

export type TextDirection = typeof TextDirection.Type;

/**
 * Reads the direction of the text of one locale tag, such as `en` or `ar`,
 * from the locale data of the platform. No list of right-to-left languages is
 * kept here. The tag must be one the platform parses, which the routing already
 * guarantees for the interface language: any other tag throws the platform's
 * RangeError.
 */
export function textDirection(locale: string): TextDirection {
  return Schema.decodeUnknownSync(TextDirection)(
    new Intl.Locale(locale).getTextInfo().direction
  );
}
