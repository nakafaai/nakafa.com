import {
  APP_LOCALE_CODES,
  AppLocaleCodeSchema,
} from "@nakafa/aksara-contracts/locale";
import { routing } from "@repo/internationalization/src/routing";
import { Record as Rec, Schema } from "effect";

const AlternateLanguagePathSchema = Schema.Record(
  Schema.Literals([...APP_LOCALE_CODES, "x-default"]),
  Schema.optionalKey(Schema.String)
);
const AlternateTypePathSchema = Schema.Record(Schema.String, Schema.String);
const LocalizedAlternatesOptionsSchema = Schema.Struct({
  languages: Schema.optionalKey(AlternateLanguagePathSchema),
  types: Schema.optionalKey(AlternateTypePathSchema),
});
type LocalizedAlternatesOptions = typeof LocalizedAlternatesOptionsSchema.Type;

const ResolvedAlternateRouteSchema = Schema.Struct({
  appLocale: AppLocaleCodeSchema,
  publicPath: Schema.String,
});
type ResolvedAlternateRoute = typeof ResolvedAlternateRouteSchema.Type;

/** Removes an existing locale prefix before building language alternates. */
function getPathWithoutLocale(canonical: string) {
  for (const locale of APP_LOCALE_CODES) {
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

/** Builds canonical, hreflang, x-default, and optional typed alternates. */
export function createLocalizedAlternates(
  path: string,
  options: LocalizedAlternatesOptions = {}
) {
  const canonical = path.startsWith("/") ? path : `/${path}`;
  const pathWithoutLocale = getPathWithoutLocale(canonical);
  const languages =
    options.languages ??
    Rec.fromEntries(
      routing.locales.map((locale) => [
        locale,
        `/${locale}${pathWithoutLocale}`,
      ])
    );
  const typeAlternates = options.types ? { types: options.types } : {};
  const xDefault =
    languages["x-default"] ??
    languages[routing.defaultLocale] ??
    `/${routing.defaultLocale}${pathWithoutLocale}`;

  return {
    canonical,
    languages: {
      ...languages,
      "x-default": xDefault,
    },
    ...typeAlternates,
  };
}

/** Builds hreflang alternates from already-resolved localized counterparts. */
export function createResolvedRouteAlternates(
  route: ResolvedAlternateRoute,
  alternates: readonly ResolvedAlternateRoute[],
  options: Omit<LocalizedAlternatesOptions, "languages"> = {}
) {
  const routePath = `/${route.appLocale}/${route.publicPath}`;
  const languages = Rec.fromEntries(
    alternates.map(
      (alternate): readonly [ResolvedAlternateRoute["appLocale"], string] => [
        alternate.appLocale,
        `/${alternate.appLocale}/${alternate.publicPath}`,
      ]
    )
  );

  return createLocalizedAlternates(routePath, {
    ...options,
    languages: {
      ...languages,
      "x-default": languages[routing.defaultLocale] ?? routePath,
    },
  });
}
