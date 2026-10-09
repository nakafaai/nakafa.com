import {
  type AppLocaleCode,
  AppLocaleCodeSchema,
} from "@nakafa/aksara-contracts/locale";
import { Array as Arr, Effect, HashMap, Option, Schema } from "effect";
import {
  readPublishedTryoutExamPage,
  readPublishedTryoutSectionPage,
} from "@/lib/content/tryout/page";
import { readPublishedTryoutLocalizedPath } from "@/lib/content/tryout/path";

const TRYOUT_ROOT = "try-out";
const SNBT_ROUTE = "snbt";
const SNBT_ROUTE_PATH = `${TRYOUT_ROOT}/${SNBT_ROUTE}`;
/** Canonical SNBT exam path. Every app locale localizes it through the signed catalog. */
export const SNBT_EXAM_PATH = "try-out/indonesia/snbt";
/** Locale whose signed paths anchor the localized successors of retired SNBT URLs. */
export const SOURCE_APP_LOCALE = "en";
const PRODUCT_YEAR_SET_PATTERN = /^(\d{4})-(set-\d+)$/;
const SET_KEY_PATTERN = /^set-\d+$/;
const YEAR_TRACK_KEY_PATTERN = /^\d{4}$/;
const decodeAppLocale = Schema.decodeUnknownOption(AppLocaleCodeSchema);

/**
 * UTBK-SNBT section route segments retired when the sections took their
 * official names, mapped to their successors in each app locale.
 */
const RETIRED_SNBT_SECTIONS = {
  de: HashMap.make(
    ["allgemeines-logisches-denken", "allgemeines-schlussfolgern"],
    ["allgemeinwissen", "allgemeines-wissen-und-verstaendnis"],
    ["englische-sprache", "lesekompetenz-in-englischer-sprache"],
    ["indonesische-sprache", "lesekompetenz-in-indonesischer-sprache"],
    ["lese-und-schreibkompetenz", "leseverstaendnis-und-schreiben"]
  ),
  en: HashMap.make(
    ["english-language", "literacy-in-english"],
    ["general-knowledge", "general-knowledge-and-understanding"],
    ["indonesian-language", "literacy-in-indonesian"],
    ["reading-and-writing-skills", "reading-comprehension-and-writing"]
  ),
  id: HashMap.make(
    ["bahasa-indonesia", "literasi-dalam-bahasa-indonesia"],
    ["bahasa-inggris", "literasi-dalam-bahasa-inggris"],
    ["literasi-membaca-menulis", "pemahaman-bacaan-dan-menulis"],
    ["pengetahuan-umum", "pengetahuan-dan-pemahaman-umum"]
  ),
};

type RetiredSectionLocale = keyof typeof RETIRED_SNBT_SECTIONS;

function isRetiredSectionLocale(
  locale: string | undefined
): locale is RetiredSectionLocale {
  return locale !== undefined && Object.hasOwn(RETIRED_SNBT_SECTIONS, locale);
}

const RetiredSnbtProductSchema = Schema.Struct({
  appLocale: AppLocaleCodeSchema,
  part: Schema.optionalKey(Schema.String),
  set: Schema.String,
  year: Schema.String,
});
/** One retired SNBT product URL: its year and set, plus its part when it names one. */
export type RetiredSnbtProduct = typeof RetiredSnbtProductSchema.Type;

const TracklessSetRouteSchema = Schema.Struct({
  appLocale: AppLocaleCodeSchema,
  country: Schema.String,
  exam: Schema.String,
  section: Schema.optionalKey(Schema.String),
  set: Schema.String,
});
/** One retired try-out URL that names a set without its track, with the section after it when present. */
type TracklessSetRoute = typeof TracklessSetRouteSchema.Type;

/** Splits one public pathname into its non-empty segments. */
function readPathSegments(pathname: string) {
  return Arr.filter(pathname.split("/"), (segment) => segment !== "");
}

/** Reads one retired SNBT section URL as its retired and successor routes. */
function readRetiredSnbtSection(pathname: string) {
  const [appLocale, root, country, exam, track, set, section, ...rest] =
    pathname.split("/").filter(Boolean);
  if (
    !(
      isRetiredSectionLocale(appLocale) &&
      root === TRYOUT_ROOT &&
      exam === SNBT_ROUTE &&
      country &&
      track &&
      set &&
      section &&
      rest.length === 0
    )
  ) {
    return null;
  }
  const successor = HashMap.get(RETIRED_SNBT_SECTIONS[appLocale], section);
  if (Option.isNone(successor)) {
    return null;
  }
  const setPath = [root, country, exam, track, set].join("/");
  return {
    appLocale,
    previousPath: `${setPath}/${section}`,
    successorPath: `${setPath}/${successor.value}`,
  };
}

/** Reads the retired SNBT exam URL `/{l}/try-out/snbt`, which named no country. */
function readRetiredSnbtExam(pathname: string): Option.Option<AppLocaleCode> {
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

/** Reads a retired track-less set URL, with the section that may follow its set. */
function readTracklessSetRoute(
  pathname: string
): Option.Option<TracklessSetRoute> {
  const [localeSegment, root, country, exam, set, ...rest] =
    readPathSegments(pathname);
  const appLocale = decodeAppLocale(localeSegment);
  if (
    Option.isNone(appLocale) ||
    root !== TRYOUT_ROOT ||
    country === undefined ||
    exam === undefined ||
    set === undefined ||
    !SET_KEY_PATTERN.test(set) ||
    rest.length > 1
  ) {
    return Option.none();
  }
  const [section] = rest;
  return Option.some({
    appLocale: appLocale.value,
    country,
    exam,
    set,
    ...(section === undefined ? {} : { section }),
  });
}

/** Reads whether the active signed catalog serves one exact route in its own locale. */
function readActiveTryoutPath(appLocale: AppLocaleCode, path: string) {
  return readPublishedTryoutLocalizedPath({
    currentAppLocale: appLocale,
    publicPath: path,
    targetAppLocale: appLocale,
  });
}

/** Localizes the canonical SNBT set of one year, or returns null when that set is not live. */
const readLocalizedSnbtSet = Effect.fn(
  "www.routing.publicHtml.tryoutSetLocalization"
)(function* (appLocale: AppLocaleCode, year: string, set: string) {
  return yield* readPublishedTryoutLocalizedPath({
    currentAppLocale: SOURCE_APP_LOCALE,
    publicPath: `${SNBT_EXAM_PATH}/${year}/${set}`,
    targetAppLocale: appLocale,
  });
});

/** Applies the retired section rename map of one locale and keeps every other key. */
function readSectionSuccessor(appLocale: AppLocaleCode, section: string) {
  return Option.getOrElse(
    HashMap.get(RETIRED_SNBT_SECTIONS[appLocale], section),
    () => section
  );
}

/** Matches a track whose route key is a four-digit year. */
function isYearTrack(track: {
  readonly trackKey: string;
  readonly trackKind: string;
}) {
  return (
    track.trackKind === "year" && YEAR_TRACK_KEY_PATTERN.test(track.trackKey)
  );
}

/**
 * Reads the one newest year track whose signed set is live. Two live tracks
 * of the same newest year leave the set ambiguous, so no track is chosen.
 */
const readNewestServingTrack = Effect.fn(
  "www.routing.publicHtml.tryoutNewestTrack"
)(function* (appLocale: AppLocaleCode, examPath: string, set: string) {
  const exam = yield* readPublishedTryoutExamPage({
    appLocale,
    publicPath: examPath,
  });
  if (exam === null) {
    return null;
  }
  const servingTracks = yield* Effect.filter(
    Arr.filter(exam.tracks, isYearTrack),
    (track) =>
      readActiveTryoutPath(appLocale, `${track.publicPath}/${set}`).pipe(
        Effect.map((path) => path !== null)
      )
  );
  if (servingTracks.length === 0) {
    return null;
  }
  const newestYear = Arr.reduce(servingTracks, "", (newest, track) =>
    track.trackKey > newest ? track.trackKey : newest
  );
  const newestTracks = Arr.filter(
    servingTracks,
    (track) => track.trackKey === newestYear
  );
  if (newestTracks.length !== 1) {
    return null;
  }
  return Option.getOrNull(Arr.head(newestTracks));
});

/**
 * Resolves a retired SNBT section URL to its successor, only once the active
 * signed catalog has dropped the retired route and serves the successor.
 */
const readRetiredSectionRedirect = Effect.fn(
  "www.routing.publicHtml.tryoutSectionMigration"
)(function* (pathname: string) {
  const retired = readRetiredSnbtSection(pathname);
  if (!retired) {
    return null;
  }
  const [previous, successor] = yield* Effect.all(
    [
      readActiveTryoutPath(retired.appLocale, retired.previousPath),
      readActiveTryoutPath(retired.appLocale, retired.successorPath),
    ],
    { concurrency: 2 }
  );
  if (previous !== null || successor === null) {
    return null;
  }
  return `/${retired.appLocale}/${successor}`;
});

/** Redirects the retired SNBT exam URL to its localized exam page once that page is live. */
const readRetiredSnbtExamRedirect = Effect.fn(
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

/** Redirects a retired track-less set to the same set in its newest live year track. */
const readTracklessSetRedirect = Effect.fn(
  "www.routing.publicHtml.tryoutTracklessSetMigration"
)(function* (route: TracklessSetRoute) {
  const { appLocale, country, exam, set } = route;
  const examPath = `${TRYOUT_ROOT}/${country}/${exam}`;
  if ((yield* readActiveTryoutPath(appLocale, `${examPath}/${set}`)) !== null) {
    return null;
  }
  const track = yield* readNewestServingTrack(appLocale, examPath, set);
  return track === null ? null : `/${appLocale}/${track.publicPath}/${set}`;
});

/** Redirects a retired track-less section to its renamed section in the newest live year track. */
const readTracklessSectionRedirect = Effect.fn(
  "www.routing.publicHtml.tryoutTracklessSectionMigration"
)(function* (route: TracklessSetRoute, section: string) {
  const { appLocale, country, exam, set } = route;
  const examPath = `${TRYOUT_ROOT}/${country}/${exam}`;
  if (
    (yield* readActiveTryoutPath(
      appLocale,
      `${examPath}/${set}/${section}`
    )) !== null
  ) {
    return null;
  }
  const track = yield* readNewestServingTrack(appLocale, examPath, set);
  if (track === null) {
    return null;
  }
  const successor = readSectionSuccessor(appLocale, section);
  const page = yield* readPublishedTryoutSectionPage({
    appLocale,
    publicPath: `${track.publicPath}/${set}/${successor}`,
  });
  return page === null
    ? null
    : `/${appLocale}/${track.publicPath}/${set}/${successor}`;
});

const readRetiredSnbtProductRedirect = Effect.fn(
  "www.routing.publicHtml.tryoutProductMigration"
)(function* (product: RetiredSnbtProduct) {
  if (product.part === undefined) {
    return yield* readRetiredSnbtSetRedirect(product);
  }
  return yield* readRetiredSnbtPartRedirect(product, product.part);
});

const readTracklessRouteRedirect = Effect.fn(
  "www.routing.publicHtml.tryoutTracklessMigration"
)(function* (route: TracklessSetRoute) {
  if (route.section === undefined) {
    return yield* readTracklessSetRedirect(route);
  }
  return yield* readTracklessSectionRedirect(route, route.section);
});

/**
 * Resolves one retired try-out URL to its live successor. Each rule keeps the
 * retired path absent and the successor live, so a redirect never lands on a
 * page that the signed catalog does not serve.
 */
export const readTryoutRedirect = Effect.fn(
  "www.routing.publicHtml.tryoutRedirect"
)(function* (pathname: string) {
  const sectionRedirect = yield* readRetiredSectionRedirect(pathname);
  if (sectionRedirect !== null) {
    return sectionRedirect;
  }
  const exam = readRetiredSnbtExam(pathname);
  if (Option.isSome(exam)) {
    return yield* readRetiredSnbtExamRedirect(exam.value);
  }
  const product = readRetiredSnbtProduct(pathname);
  if (Option.isSome(product)) {
    return yield* readRetiredSnbtProductRedirect(product.value);
  }
  const trackless = readTracklessSetRoute(pathname);
  if (Option.isSome(trackless)) {
    return yield* readTracklessRouteRedirect(trackless.value);
  }
  return null;
});
