import type { Locale } from "@repo/utilities/locales";

interface LocalizedSource {
  readonly locale: Locale;
  readonly sourcePath: string;
}

/** Builds the locale-qualified identity used by stale content inspection. */
export function getLocalizedSourceKey(locale: Locale, sourcePath: string) {
  return `${locale}:${sourcePath}`;
}

/** Returns whether an exact localized source row is still authored. */
export function hasLocalizedSourceKey(
  keys: ReadonlySet<string>,
  source: LocalizedSource
) {
  return keys.has(getLocalizedSourceKey(source.locale, source.sourcePath));
}
