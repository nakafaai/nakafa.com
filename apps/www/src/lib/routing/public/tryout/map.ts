import {
  ACTIVE_APP_LOCALE_CODES,
  type ActiveAppLocaleCode,
} from "@nakafa/aksara-contracts/locale";
import { Array as Arr, Effect, Record as Rec, Schema } from "effect";
import {
  readTryoutCountryPage,
  readTryoutHubPage,
} from "@/components/tryout/catalog/source.server";
import {
  readPublishedTryoutExamPage,
  readPublishedTryoutGroupPage,
} from "@/lib/content/tryout/catalog";
import { readPublishedTryoutLocalizedPath } from "@/lib/content/tryout/path";
import {
  SNBT_EXAM_PATH,
  SOURCE_APP_LOCALE,
  TRYOUT_ROOT,
} from "@/lib/routing/public/tryout/route";

/** One country of the hub, in the hub's order: its code and its page. */
const MapCountry = Schema.Struct({
  countryCode: Schema.String,
  publicPath: Schema.String,
});

/** One group of an exam, in the exam's order: its key, its page and where a link to it lands. */
const MapGroup = Schema.Struct({
  entryPath: Schema.String,
  groupKey: Schema.String,
  publicPath: Schema.String,
});

/** One exam: how its groups are divided, and its groups. */
const MapExam = Schema.Struct({
  exam: Schema.Struct({ groupAxis: Schema.String }),
  groups: Schema.Array(MapGroup),
});

/**
 * What the try-out redirects read of one locale's signed catalog: the hub's
 * countries, every exam's groups, every group's tracks, every path the catalog
 * serves, the section pages, and the locale's spelling of each canonical SNBT
 * path, which is how a retired SNBT URL finds its successor.
 */
const MapLocale = Schema.Struct({
  countries: Schema.Array(MapCountry),
  exams: Schema.Record(Schema.String, MapExam),
  groups: Schema.Record(Schema.String, Schema.Array(Schema.String)),
  localized: Schema.Record(Schema.String, Schema.NullOr(Schema.String)),
  paths: Schema.Array(Schema.String),
  sections: Schema.Array(Schema.String),
});

export type TryoutMapLocale = typeof MapLocale.Type;

/** The try-out route map of every active locale, as the text of its asset. */
export const TryoutMapJson = Schema.fromJsonString(
  Schema.Record(Schema.String, MapLocale)
);

/** The static asset that holds the map: the build writes it, and the Worker reads it. */
export const TRYOUT_MAP_PATH = "/_moved/tryout.json";

/** The segments of a section's path: `try-out/<country>/<exam>/<group>/<track>/<set>/<section>`. */
const SECTION_SEGMENTS = 7;

/** The segments of a set's path, one fewer than its section's. */
const SET_SEGMENTS = 6;

/** Reads one exam's groups and one group's tracks, as the redirects read them. */
const readExams = Effect.fn("www.routing.tryoutMap.exams")(function* (
  appLocale: ActiveAppLocaleCode,
  countryPaths: readonly string[]
) {
  const countries = yield* Effect.forEach(countryPaths, (path) =>
    readTryoutCountryPage(appLocale, path)
  );
  const examPaths = Arr.flatMap(Arr.getSomes(countries), (page) =>
    Arr.map(page.exams, (exam) => exam.publicPath)
  );
  const exams = yield* Effect.forEach(examPaths, (publicPath) =>
    Effect.map(
      readPublishedTryoutExamPage({ appLocale, publicPath }),
      (page) => [publicPath, page] as const
    )
  );
  return Arr.flatMap(exams, ([path, page]) =>
    page === null
      ? []
      : [
          [
            path,
            {
              exam: { groupAxis: page.exam.groupAxis },
              groups: Arr.map(page.groups, (group) => ({
                entryPath: group.entryPath,
                groupKey: group.groupKey,
                publicPath: group.publicPath,
              })),
            },
          ] as const,
        ]
  );
});

/** Reads the track paths of every group of the locale's exams. */
const readGroups = Effect.fn("www.routing.tryoutMap.groups")(function* (
  appLocale: ActiveAppLocaleCode,
  groupPaths: readonly string[]
) {
  const groups = yield* Effect.forEach(groupPaths, (publicPath) =>
    Effect.map(
      readPublishedTryoutGroupPage({ appLocale, publicPath }),
      (page) => [publicPath, page] as const
    )
  );
  return Arr.flatMap(groups, ([path, page]) =>
    page === null
      ? []
      : [[path, Arr.map(page.tracks, (track) => track.publicPath)] as const]
  );
});

/**
 * Reads the map of one locale. `pagePaths` are the try-out pages that the build
 * prerenders for it, without the locale: its countries, groups, tracks, sets and
 * sections; the exams come from the countries' pages. `snbtPaths` are the
 * canonical SNBT exam and sets, which the locale's spelling is read for.
 */
const readLocaleMap = Effect.fn("www.routing.tryoutMap.locale")(function* (
  appLocale: ActiveAppLocaleCode,
  pagePaths: readonly string[],
  snbtPaths: readonly string[]
) {
  const { countries } = yield* readTryoutHubPage(appLocale);
  const exams = yield* readExams(
    appLocale,
    Arr.map(countries, (country) => country.publicPath)
  );
  const groupPaths = Arr.flatMap(exams, ([, exam]) =>
    Arr.map(exam.groups, (group) => group.publicPath)
  );
  const groups = yield* readGroups(appLocale, groupPaths);
  const localized = yield* Effect.forEach(snbtPaths, (publicPath) =>
    Effect.map(
      readPublishedTryoutLocalizedPath({
        currentAppLocale: SOURCE_APP_LOCALE,
        publicPath,
        targetAppLocale: appLocale,
      }),
      (path) => [publicPath, path] as const
    )
  );
  const examPaths = Arr.map(exams, ([path]) => path);
  return {
    countries: Arr.map(countries, ({ countryCode, publicPath }) => ({
      countryCode,
      publicPath,
    })),
    exams: Rec.fromEntries(exams),
    groups: Rec.fromEntries(groups),
    localized: Rec.fromEntries(localized),
    paths: Arr.dedupe([...examPaths, ...groupPaths, ...pagePaths]),
    sections: Arr.filter(
      pagePaths,
      (path) => path.split("/").length === SECTION_SEGMENTS
    ),
  };
});

/** The try-out pages of one locale among the prerendered paths, without the locale. */
function readLocalePages(locale: string, staticPaths: readonly string[]) {
  const prefix = `/${locale}/${TRYOUT_ROOT}/`;
  return Arr.flatMap(staticPaths, (path) =>
    path.startsWith(prefix) ? [path.slice(locale.length + 2)] : []
  );
}

/**
 * Reads the try-out route map of every active locale from the signed catalog, and
 * encodes it as the text of its asset (`TRYOUT_MAP_PATH`). The build reads each
 * page once here, so a retired try-out URL costs the Worker one asset read
 * instead of the catalog reads its redirect needs.
 */
export const readTryoutMap = Effect.fn("www.routing.tryoutMap")(function* (
  staticPaths: readonly string[]
) {
  const snbtPaths = [
    SNBT_EXAM_PATH,
    ...Arr.filter(
      readLocalePages(SOURCE_APP_LOCALE, staticPaths),
      (path) =>
        path.startsWith(`${SNBT_EXAM_PATH}/`) &&
        path.split("/").length === SET_SEGMENTS
    ),
  ];
  const locales = yield* Effect.forEach(ACTIVE_APP_LOCALE_CODES, (locale) =>
    Effect.map(
      readLocaleMap(locale, readLocalePages(locale, staticPaths), snbtPaths),
      (map) => [locale, map] as const
    )
  );
  return {
    path: TRYOUT_MAP_PATH.slice(1),
    text: yield* Schema.encodeEffect(TryoutMapJson)(Rec.fromEntries(locales)),
  };
});
