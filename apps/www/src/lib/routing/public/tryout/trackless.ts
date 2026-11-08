import {
  type AppLocaleCode,
  AppLocaleCodeSchema,
} from "@nakafa/aksara-contracts/locale";
import { Array as Arr, Effect, Option, Order, Schema } from "effect";
import {
  readPublishedTryoutExamPage,
  readPublishedTryoutSectionPage,
} from "@/lib/content/tryout/catalog";
import { temporaryRedirect } from "@/lib/routing/public/redirect";
import { readSoleTrack } from "@/lib/routing/public/tryout/group";
import {
  decodeAppLocale,
  readActiveTryoutPath,
  readPathSegments,
  TRYOUT_ROOT,
} from "@/lib/routing/public/tryout/route";
import { readSectionSuccessor } from "@/lib/routing/public/tryout/section";

/**
 * The set segment that each app locale publishes for a set. German names its
 * sets `aufgabensatz-N`; English and Indonesian name them `set-N`.
 */
const TRACKLESS_SET_PATTERNS: Record<AppLocaleCode, RegExp> = {
  de: /^aufgabensatz-\d+$/u,
  en: /^set-\d+$/u,
  id: /^set-\d+$/u,
};
const YEAR_GROUP_KEY_PATTERN = /^\d{4}$/u;

const TracklessSetRouteSchema = Schema.Struct({
  appLocale: AppLocaleCodeSchema,
  country: Schema.String,
  exam: Schema.String,
  section: Schema.optionalKey(Schema.String),
  set: Schema.String,
});
/** One retired try-out URL that names a set without its track, with the section after it when present. */
type TracklessSetRoute = typeof TracklessSetRouteSchema.Type;

/** Reads a retired track-less set URL, with the section that may follow its set. */
export function readTracklessSetRoute(
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
    !TRACKLESS_SET_PATTERNS[appLocale.value].test(set) ||
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

/**
 * Reads the track of the one newest year group whose signed set is live: a year
 * group holds one track, its year's test. Two live groups of the same newest year
 * leave the set ambiguous, so no track is chosen.
 */
const readNewestServingTrack = Effect.fn(
  "www.routing.publicHtml.tryoutNewestTrack"
)(function* (appLocale: AppLocaleCode, examPath: string, set: string) {
  const exam = yield* readPublishedTryoutExamPage({
    appLocale,
    publicPath: examPath,
  });
  if (exam === null || exam.exam.groupAxis !== "year") {
    return null;
  }
  const years = Arr.filter(exam.groups, ({ groupKey }) =>
    YEAR_GROUP_KEY_PATTERN.test(groupKey)
  );
  const serving = Arr.getSomes(
    yield* Effect.forEach(years, (group) =>
      Effect.gen(function* () {
        const track = yield* readSoleTrack(appLocale, group.publicPath);
        if (Option.isNone(track)) {
          return Option.none();
        }
        const path = yield* readActiveTryoutPath(
          appLocale,
          `${track.value.publicPath}/${set}`
        );
        return path === null
          ? Option.none()
          : Option.some({ groupKey: group.groupKey, track: track.value });
      })
    )
  );
  if (serving.length === 0) {
    return null;
  }
  const newestYear = Arr.reduce(serving, "", (newest, { groupKey }) =>
    Order.max(Order.String)(newest, groupKey)
  );
  const newest = Arr.filter(serving, ({ groupKey }) => groupKey === newestYear);
  if (newest.length !== 1) {
    return null;
  }
  return Option.getOrNull(Option.map(Arr.head(newest), ({ track }) => track));
});

/**
 * Answers a retired track-less set with a temporary redirect to the same set in
 * the track of its newest live year. A newer year can replace that year, so the
 * answer must not be permanent.
 */
const readTracklessSetRedirect = Effect.fn(
  "www.routing.publicHtml.tryoutTracklessSetMigration"
)(function* (route: TracklessSetRoute) {
  const { appLocale, country, exam, set } = route;
  const examPath = `${TRYOUT_ROOT}/${country}/${exam}`;
  if ((yield* readActiveTryoutPath(appLocale, `${examPath}/${set}`)) !== null) {
    return null;
  }
  const track = yield* readNewestServingTrack(appLocale, examPath, set);
  return track === null
    ? null
    : temporaryRedirect(`/${appLocale}/${track.publicPath}/${set}`);
});

/**
 * Answers a retired track-less section with a temporary redirect to its renamed
 * section in the track of the newest live year, for the same reason as its set.
 */
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
    : temporaryRedirect(
        `/${appLocale}/${track.publicPath}/${set}/${successor}`
      );
});

/** Answers one retired track-less URL, a set or a section, with a temporary redirect. */
export const readTracklessRouteRedirect = Effect.fn(
  "www.routing.publicHtml.tryoutTracklessMigration"
)(function* (route: TracklessSetRoute) {
  if (route.section === undefined) {
    return yield* readTracklessSetRedirect(route);
  }
  return yield* readTracklessSectionRedirect(route, route.section);
});
