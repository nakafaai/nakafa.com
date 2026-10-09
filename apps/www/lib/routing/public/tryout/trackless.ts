import {
  type AppLocaleCode,
  AppLocaleCodeSchema,
} from "@nakafa/aksara-contracts/locale";
import { Array as Arr, Effect, Option, Schema } from "effect";
import {
  readPublishedTryoutExamPage,
  readPublishedTryoutSectionPage,
} from "@/lib/content/tryout/catalog";
import { temporaryRedirect } from "@/lib/routing/public/redirect";
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
  de: /^aufgabensatz-\d+$/,
  en: /^set-\d+$/,
  id: /^set-\d+$/,
};
const YEAR_TRACK_KEY_PATTERN = /^\d{4}$/;

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
 * Answers a retired track-less set with a temporary redirect to the same set in
 * its newest live year track. A newer year track can replace that track, so
 * the answer must not be permanent.
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
 * section in the newest live year track, for the same reason as its set.
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
