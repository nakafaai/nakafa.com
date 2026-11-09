import type { ActiveAppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { Array as Arr, Effect, Option } from "effect";
import {
  readPublishedTryoutCountryPage,
  readPublishedTryoutExamPage,
  readPublishedTryoutGroupPage,
} from "@/lib/content/tryout/catalog";
import { readPublishedTryoutLocalizedPath } from "@/lib/content/tryout/path";
import {
  permanentRedirect,
  temporaryRedirect,
} from "@/lib/routing/public/redirect";
import {
  decodeAppLocale,
  readActiveTryoutPath,
  readPathSegments,
  SNBT_EXAM_PATH,
  SOURCE_APP_LOCALE,
  TRYOUT_ROOT,
} from "@/lib/routing/public/tryout/route";
import { readSectionSuccessor } from "@/lib/routing/public/tryout/section";

/**
 * Reads the one track of a group, none when the group is not live or holds
 * more than one track, because then a path without its track names no page.
 */
export const readSoleTrack = Effect.fn(
  "www.routing.publicHtml.tryoutSoleTrack"
)(function* (appLocale: ActiveAppLocaleCode, groupPath: string) {
  const page = yield* readPublishedTryoutGroupPage({
    appLocale,
    publicPath: groupPath,
  });
  if (page === null || page.tracks.length !== 1) {
    return Option.none();
  }
  return Arr.head(page.tracks);
});

/**
 * Localizes the canonical SNBT set of one year, in the year's one track, or
 * returns null when that set is not live.
 */
export const readLocalizedSnbtSet = Effect.fn(
  "www.routing.publicHtml.tryoutSetLocalization"
)(function* (appLocale: ActiveAppLocaleCode, year: string, set: string) {
  const track = yield* readSoleTrack(
    SOURCE_APP_LOCALE,
    `${SNBT_EXAM_PATH}/${year}`
  );
  if (Option.isNone(track)) {
    return null;
  }
  return yield* readPublishedTryoutLocalizedPath({
    currentAppLocale: SOURCE_APP_LOCALE,
    publicPath: `${track.value.publicPath}/${set}`,
    targetAppLocale: appLocale,
  });
});

/** One try-out URL below an exam: its locale, its exam path, and the segments after the exam. */
function readExamRoute(pathname: string) {
  const [localeSegment, root, country, exam, ...rest] =
    readPathSegments(pathname);
  const appLocale = decodeAppLocale(localeSegment);
  if (
    Option.isNone(appLocale) ||
    root !== TRYOUT_ROOT ||
    country === undefined ||
    exam === undefined
  ) {
    return Option.none();
  }
  return Option.some({
    appLocale: appLocale.value,
    examPath: `${TRYOUT_ROOT}/${country}/${exam}`,
    rest,
  });
}

/**
 * Answers an exam's own address with a temporary redirect to its entry, its
 * first group's entry, where a link to the exam lands: an exam has no page of
 * its own, and a newer group can come first, so the answer must not be
 * permanent.
 */
const readExamEntryRedirect = Effect.fn(
  "www.routing.publicHtml.tryoutExamEntry"
)(function* (appLocale: ActiveAppLocaleCode, examPath: string) {
  const exam = yield* readPublishedTryoutExamPage({
    appLocale,
    publicPath: examPath,
  });
  const group = Option.flatMap(Option.fromNullishOr(exam), (page) =>
    Arr.head(page.groups)
  );
  return Option.match(group, {
    onNone: () => null,
    onSome: (first) => temporaryRedirect(`/${appLocale}/${first.entryPath}`),
  });
});

/**
 * Answers a group's own address with a temporary redirect to its entry when
 * the group holds a single track, a level with one option that is never a page
 * of its own. A second track makes it a page again, so the answer is temporary.
 */
const readGroupEntryRedirect = Effect.fn(
  "www.routing.publicHtml.tryoutGroupEntry"
)(function* (appLocale: ActiveAppLocaleCode, examPath: string, path: string) {
  const exam = yield* readPublishedTryoutExamPage({
    appLocale,
    publicPath: examPath,
  });
  const group = Arr.findFirst(
    exam?.groups ?? [],
    (row) => row.publicPath === path
  );
  return Option.match(group, {
    onNone: () => null,
    onSome: (own) =>
      own.entryPath === own.publicPath
        ? null
        : temporaryRedirect(`/${appLocale}/${own.entryPath}`),
  });
});

/**
 * Answers a country's own address with a temporary redirect to its entry when
 * the country holds a single exam, which is then never a page of its own.
 */
export const readCountryEntryRedirect = Effect.fn(
  "www.routing.publicHtml.tryoutCountryEntry"
)(function* (pathname: string) {
  const [localeSegment, root, country, ...rest] = readPathSegments(pathname);
  const appLocale = decodeAppLocale(localeSegment);
  if (
    Option.isNone(appLocale) ||
    root !== TRYOUT_ROOT ||
    country === undefined ||
    rest.length > 0
  ) {
    return null;
  }
  const publicPath = `${TRYOUT_ROOT}/${country}`;
  const page = yield* readPublishedTryoutCountryPage({
    appLocale: appLocale.value,
    publicPath,
  });
  return page === null || page.entryPath === publicPath
    ? null
    : temporaryRedirect(`/${appLocale.value}/${page.entryPath}`);
});

/**
 * Answers a set path that names its group but not its track, as SNBT's
 * `2027/set-1` did before UTBK became its track, with a permanent redirect to
 * the same set in the group's one track, its section renamed when it was.
 */
const readTracklessGroupRedirect = Effect.fn(
  "www.routing.publicHtml.tryoutTracklessGroup"
)(function* (input: {
  readonly appLocale: ActiveAppLocaleCode;
  readonly groupPath: string;
  readonly section: string | undefined;
  readonly set: string;
}) {
  const track = yield* readSoleTrack(input.appLocale, input.groupPath);
  if (Option.isNone(track)) {
    return null;
  }
  const successor = Arr.join(
    [
      track.value.publicPath,
      input.set,
      ...(input.section === undefined
        ? []
        : [readSectionSuccessor(input.appLocale, input.section)]),
    ],
    "/"
  );
  const live = yield* readActiveTryoutPath(input.appLocale, successor);
  return live === null
    ? null
    : permanentRedirect(`/${input.appLocale}/${successor}`);
});

/**
 * Answers a path that names a track straight under its exam, as TKA's
 * `tka/matematika-wajib` did before its grades, with a permanent redirect to
 * the same page under the track's group.
 */
const readUngroupedTrackRedirect = Effect.fn(
  "www.routing.publicHtml.tryoutUngroupedTrack"
)(function* (input: {
  readonly appLocale: ActiveAppLocaleCode;
  readonly below: readonly string[];
  readonly examPath: string;
  readonly segment: string;
}) {
  const { appLocale, below, examPath, segment } = input;
  const exam = yield* readPublishedTryoutExamPage({
    appLocale,
    publicPath: examPath,
  });
  if (exam === null) {
    return null;
  }
  const pages = yield* Effect.forEach(exam.groups, (group) =>
    readPublishedTryoutGroupPage({ appLocale, publicPath: group.publicPath })
  );
  const track = Arr.findFirst(
    Arr.flatMap(pages, (page) => (page === null ? [] : page.tracks)),
    (row) => row.publicPath.endsWith(`/${segment}`)
  );
  if (Option.isNone(track)) {
    return null;
  }
  const successor = Arr.join([track.value.publicPath, ...below], "/");
  const live = yield* readActiveTryoutPath(appLocale, successor);
  return live === null ? null : permanentRedirect(`/${appLocale}/${successor}`);
});

/**
 * Resolves a try-out URL of the catalog before its exams were divided into
 * groups, and an exam's own address. A URL the signed catalog serves is left
 * alone, and a successor is answered only when the catalog serves it.
 */
export const readGroupRedirect = Effect.fn(
  "www.routing.publicHtml.tryoutGroupMigration"
)(function* (pathname: string) {
  const route = readExamRoute(pathname);
  if (Option.isNone(route)) {
    return null;
  }
  const { appLocale, examPath, rest } = route.value;
  const [segment, set, section, ...extra] = rest;
  if (segment === undefined) {
    return yield* readExamEntryRedirect(appLocale, examPath);
  }
  if (extra.length > 0) {
    return null;
  }
  const path = Arr.join([examPath, ...rest], "/");
  if ((yield* readActiveTryoutPath(appLocale, path)) !== null) {
    return set === undefined
      ? yield* readGroupEntryRedirect(appLocale, examPath, path)
      : null;
  }
  const groupPath = `${examPath}/${segment}`;
  if (
    set !== undefined &&
    (yield* readActiveTryoutPath(appLocale, groupPath)) !== null
  ) {
    return yield* readTracklessGroupRedirect({
      appLocale,
      groupPath,
      section,
      set,
    });
  }
  return yield* readUngroupedTrackRedirect({
    appLocale,
    below: Arr.drop(rest, 1),
    examPath,
    segment,
  });
});
