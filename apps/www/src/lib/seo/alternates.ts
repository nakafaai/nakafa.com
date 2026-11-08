import {
  ACTIVE_APP_LOCALE_CODES,
  ActiveAppLocaleCodeSchema,
  AppLocaleCodeSchema,
} from "@nakafa/aksara-contracts/locale";
import { DEFAULT_LOCALE, LOCALES } from "@repo/internationalization/src/locale";
import { withLeadingSlash } from "@repo/utilities/path";
import { Array as Arr, Record as Rec, Schema } from "effect";

const AlternateLanguagePathSchema = Schema.Record(
  Schema.Literals([...ACTIVE_APP_LOCALE_CODES, "x-default"]),
  Schema.optionalKey(Schema.String)
);
const LocalizedAlternatesOptionsSchema = Schema.Struct({
  languages: Schema.optionalKey(AlternateLanguagePathSchema),
});
type LocalizedAlternatesOptions = typeof LocalizedAlternatesOptionsSchema.Type;

/** A localized counterpart as a release names it, in any locale the contract declares. */
const ResolvedAlternateRouteSchema = Schema.Struct({
  appLocale: AppLocaleCodeSchema,
  publicPath: Schema.String,
});
type ResolvedAlternateRoute = typeof ResolvedAlternateRouteSchema.Type;

/** Removes an existing locale prefix before building language alternates. */
function getPathWithoutLocale(canonical: string) {
  for (const locale of ACTIVE_APP_LOCALE_CODES) {
    const prefix = `/${locale}`;

    if (canonical === prefix) {
      return "";
    }

    if (canonical.startsWith(`${prefix}/`)) {
      return canonical.slice(prefix.length);
    }
  }

  return canonical;
}

/** Builds the canonical link and the hreflang alternates of a path. */
export function createLocalizedAlternates(
  path: string,
  options: LocalizedAlternatesOptions = {}
) {
  const canonical = withLeadingSlash(path);
  const pathWithoutLocale = getPathWithoutLocale(canonical);
  const languages =
    options.languages ??
    Rec.fromEntries(
      Arr.map(LOCALES, (locale): readonly [string, string] => [
        locale,
        `/${locale}${pathWithoutLocale}`,
      ])
    );
  const xDefault =
    languages["x-default"] ??
    languages[DEFAULT_LOCALE] ??
    `/${DEFAULT_LOCALE}${pathWithoutLocale}`;

  return {
    canonical,
    languages: {
      ...languages,
      "x-default": xDefault,
    },
  };
}

/**
 * Builds hreflang alternates from already-resolved localized counterparts. A
 * counterpart in a declared locale that Nakafa does not serve yet is no
 * alternate, because no page answers at its address.
 */
export function createResolvedRouteAlternates(
  route: ResolvedAlternateRoute,
  alternates: readonly ResolvedAlternateRoute[],
  options: Omit<LocalizedAlternatesOptions, "languages"> = {}
) {
  const routePath = `/${route.appLocale}/${route.publicPath}`;
  const languages = Rec.fromEntries(
    Arr.flatMap(alternates, ({ appLocale, publicPath }) =>
      Schema.is(ActiveAppLocaleCodeSchema)(appLocale)
        ? [[appLocale, `/${appLocale}/${publicPath}`] as const]
        : []
    )
  );

  return createLocalizedAlternates(routePath, {
    ...options,
    languages: {
      ...languages,
      "x-default": languages[DEFAULT_LOCALE] ?? routePath,
    },
  });
}
