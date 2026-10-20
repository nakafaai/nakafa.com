import {
  decodeLocale,
  type Locale,
} from "@repo/internationalization/src/locale";
import { notFound } from "@tanstack/react-router";
import { Option } from "effect";

/**
 * Narrows one route locale segment to the public locale set. The router passes
 * locale params as plain strings, so a loader calls this to turn an unknown
 * locale into a 404 before it reads anything. It decodes with the same owner
 * as the locale route's parse.
 */
export function getLocaleOrThrow(locale: string): Locale {
  const decoded = decodeLocale(locale);
  if (Option.isSome(decoded)) {
    return decoded.value;
  }

  throw notFound();
}
