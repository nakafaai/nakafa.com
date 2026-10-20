import {
  type Locale,
  LocaleSchema,
} from "@repo/internationalization/src/locale";
import { notFound } from "@tanstack/react-router";
import { Schema } from "effect";

/**
 * Narrows one route locale segment to the public locale set. The router passes
 * locale params as plain strings, so this runtime guard is the one place that
 * turns an unknown locale into a 404 before a page or a loader reads it.
 */
export function getLocaleOrThrow(locale: string): Locale {
  if (Schema.is(LocaleSchema)(locale)) {
    return locale;
  }

  throw notFound();
}
