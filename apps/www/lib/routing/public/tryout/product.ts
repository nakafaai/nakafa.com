import {
  type AppLocaleCode,
  AppLocaleCodeSchema,
} from "@nakafa/aksara-contracts/locale";
import { Effect, Option, Schema } from "effect";
import { readPublishedTryoutSectionPage } from "@/lib/content/tryout/catalog";
import { readPublishedTryoutLocalizedPath } from "@/lib/content/tryout/path";
import {
  decodeAppLocale,
  readActiveTryoutPath,
  readLocalizedSnbtSet,
  readPathSegments,
  SNBT_EXAM_PATH,
  SNBT_ROUTE,
  SNBT_ROUTE_PATH,
  SOURCE_APP_LOCALE,
  TRYOUT_ROOT,
} from "@/lib/routing/public/tryout/route";
import { readSectionSuccessor } from "@/lib/routing/public/tryout/section";

const PRODUCT_YEAR_SET_PATTERN = /^(\d{4})-(set-\d+)$/;
const RetiredSnbtProductSchema = Schema.Struct({
  appLocale: AppLocaleCodeSchema,
  part: Schema.optionalKey(Schema.String),
  set: Schema.String,
  year: Schema.String,
});
/** One retired SNBT product URL: its year and set, plus its part when it names one. */
export type RetiredSnbtProduct = typeof RetiredSnbtProductSchema.Type;

/** Reads the retired SNBT exam URL `/{l}/try-out/snbt`, which named no country. */
export function readRetiredSnbtExam(
  pathname: string
): Option.Option<AppLocaleCode> {
  const [localeSegment, root, exam, ...rest] = readPathSegments(pathname);
  const appLocale = decodeAppLocale(localeSegment);
  if (
    Option.isNone(appLocale) ||
    root !== TRYOUT_ROOT ||
    exam !== SNBT_ROUTE ||
    rest.length > 0
  ) {
    return Option.none();
  }
  return Option.some(appLocale.value);
}

/** Reads one retired SNBT product URL, `/{l}/try-out/snbt/{year}-{set}`, with an optional `/part/{key}`. */
export function readRetiredSnbtProduct(
  pathname: string
): Option.Option<RetiredSnbtProduct> {
  const [localeSegment, root, exam, yearSet, ...rest] =
    readPathSegments(pathname);
  const appLocale = decodeAppLocale(localeSegment);
  const yearSetMatch =
    yearSet === undefined ? null : PRODUCT_YEAR_SET_PATTERN.exec(yearSet);
  if (
    Option.isNone(appLocale) ||
    root !== TRYOUT_ROOT ||
    exam !== SNBT_ROUTE ||
    yearSetMatch === null
  ) {
    return Option.none();
  }
  const [, year, set] = yearSetMatch;
  if (rest.length === 0) {
    return Option.some({ appLocale: appLocale.value, set, year });
  }
  const [marker, part, ...extra] = rest;
  if (marker !== "part" || part === undefined || extra.length > 0) {
    return Option.none();
  }
  return Option.some({ appLocale: appLocale.value, part, set, year });
}

/** Redirects the retired SNBT exam URL to its localized exam page once that page is live. */
export const readRetiredSnbtExamRedirect = Effect.fn(
  "www.routing.publicHtml.tryoutExamMigration"
)(function* (appLocale: AppLocaleCode) {
  if ((yield* readActiveTryoutPath(appLocale, SNBT_ROUTE_PATH)) !== null) {
    return null;
  }
  const exam = yield* readPublishedTryoutLocalizedPath({
    currentAppLocale: SOURCE_APP_LOCALE,
    publicPath: SNBT_EXAM_PATH,
    targetAppLocale: appLocale,
  });
  return exam === null ? null : `/${appLocale}/${exam}`;
});

/** Redirects a retired SNBT product set to its localized set once that set is live. */
const readRetiredSnbtSetRedirect = Effect.fn(
  "www.routing.publicHtml.tryoutProductSetMigration"
)(function* (product: RetiredSnbtProduct) {
  const { appLocale, set, year } = product;
  if (
    (yield* readActiveTryoutPath(
      appLocale,
      `${SNBT_ROUTE_PATH}/${year}-${set}`
    )) !== null
  ) {
    return null;
  }
  const successor = yield* readLocalizedSnbtSet(appLocale, year, set);
  return successor === null ? null : `/${appLocale}/${successor}`;
});

/** Redirects a retired SNBT product part to its renamed section once that section page is live. */
const readRetiredSnbtPartRedirect = Effect.fn(
  "www.routing.publicHtml.tryoutProductPartMigration"
)(function* (product: RetiredSnbtProduct, part: string) {
  const { appLocale, set, year } = product;
  if (
    (yield* readActiveTryoutPath(
      appLocale,
      `${SNBT_ROUTE_PATH}/${year}-${set}/part/${part}`
    )) !== null
  ) {
    return null;
  }
  const setPath = yield* readLocalizedSnbtSet(appLocale, year, set);
  if (setPath === null) {
    return null;
  }
  const section = readSectionSuccessor(appLocale, part);
  const page = yield* readPublishedTryoutSectionPage({
    appLocale,
    publicPath: `${setPath}/${section}`,
  });
  return page === null ? null : `/${appLocale}/${setPath}/${section}`;
});

/** Redirects one retired SNBT product URL to its set, or to its renamed part section. */
export const readRetiredSnbtProductRedirect = Effect.fn(
  "www.routing.publicHtml.tryoutProductMigration"
)(function* (product: RetiredSnbtProduct) {
  if (product.part === undefined) {
    return yield* readRetiredSnbtSetRedirect(product);
  }
  return yield* readRetiredSnbtPartRedirect(product, product.part);
});
