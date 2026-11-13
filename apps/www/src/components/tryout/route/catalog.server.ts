import type { Locale } from "@repo/internationalization/src/locale";
import { readServerTranslator } from "@repo/internationalization/src/translator";
import { Array as Arr, Effect, Option } from "effect";
import { readLocaleCountry } from "@/components/tryout/catalog/options";
import {
  readTryoutCountryPage,
  readTryoutGroupPage,
  readTryoutHubPage,
  readTryoutSetList,
  readTryoutTrackPage,
} from "@/components/tryout/catalog/source.server";
import type { CatalogQuery } from "@/components/tryout/catalog/table/query";
import { TRYOUT_SET_PAGE_SIZE } from "@/components/tryout/catalog/table/types";
import {
  readTryoutRouteHead,
  readTryoutRouteLabels,
} from "@/components/tryout/route/metadata.server";
import { getTryoutPublicPath } from "@/components/tryout/route/path";
import type { TrackListRequestSchema } from "@/components/tryout/route/search";
import {
  buildCountryTrail,
  buildTryoutTrail,
} from "@/components/tryout/route/trail";
import { serverHandler } from "@/lib/server/fn";
import {
  getTryoutCountryPageArtwork,
  getTryoutTrackCatalogArtwork,
  resolveTryoutExamArtwork,
} from "@/lib/tryout/artwork";

/** One exam card with the reviewed artwork the catalog names for it, when it has one. */
const withExamArtwork = Effect.fn("www.tryout.route.examArtwork")(function* <
  Exam extends { readonly examKey: string; readonly publicPath: string },
>(locale: Locale, countryKey: string, exam: Exam) {
  const artwork = yield* resolveTryoutExamArtwork({
    appLocale: locale,
    countryKey,
    examKey: exam.examKey,
    publicPath: exam.publicPath,
  });
  return artwork.cardImageSrc
    ? { ...exam, imageSrc: artwork.cardImageSrc }
    : exam;
});

/**
 * The hub's address, which is no page of its own: Indonesia and Germany never
 * share a page, so "Try out" opens one country's page, the locale's own
 * country, else the catalog's first. A learner's last choice goes before this
 * in the sidebar, which links straight to that country.
 */
export const readTryoutHubRoute = Effect.fn("www.tryout.route.readHub")(
  function* (locale: Locale) {
    const page = yield* readTryoutHubPage(locale);
    return Option.match(readLocaleCountry(locale, page.countries), {
      onNone: () => ({ kind: "notFound" as const }),
      onSome: (country) => ({
        entryPath: country.publicPath,
        kind: "entry" as const,
      }),
    });
  }
);

/** A country page: its exam families, each with the artwork the catalog names. */
export const readTryoutCountryRoute = Effect.fn("www.tryout.route.readCountry")(
  function* (input: { readonly country: string; readonly locale: Locale }) {
    const countryPath = getTryoutPublicPath({ country: input.country });
    const [page, hub, head, labels] = yield* Effect.all(
      [
        readTryoutCountryPage(input.locale, countryPath),
        readTryoutHubPage(input.locale),
        readTryoutRouteHead({
          kind: "country",
          locale: input.locale,
          publicPath: countryPath,
        }),
        readTryoutRouteLabels(input.locale),
      ],
      { concurrency: "unbounded" }
    );
    if (Option.isNone(page) || Option.isNone(head)) {
      return { kind: "notFound" as const };
    }
    const exams = yield* Effect.forEach(page.value.exams, (exam) =>
      withExamArtwork(input.locale, page.value.country.countryKey, exam)
    );
    return {
      exams,
      head: {
        ...head.value,
        // The country's own design is its page's social image, and never a card.
        image:
          getTryoutCountryPageArtwork(
            input.locale,
            page.value.country.countryKey
          ) ?? head.value.image,
      },
      kind: "found" as const,
      labels,
      title: page.value.country.title,
      trail: buildCountryTrail(hub.countries, countryPath),
    };
  }
);

/** A group page: its tracks, and the trail of its header. */
export const readTryoutGroupRoute = Effect.fn("www.tryout.route.readGroup")(
  function* (input: {
    readonly country: string;
    readonly exam: string;
    readonly group: string;
    readonly locale: Locale;
  }) {
    const groupPath = getTryoutPublicPath({
      country: input.country,
      exam: input.exam,
      group: input.group,
    });
    const countryPath = getTryoutPublicPath({ country: input.country });
    const [page, countryPage, hub, head, labels, tTryouts] = yield* Effect.all(
      [
        readTryoutGroupPage(input.locale, groupPath),
        readTryoutCountryPage(input.locale, countryPath),
        readTryoutHubPage(input.locale),
        readTryoutRouteHead({
          kind: "group",
          locale: input.locale,
          publicPath: groupPath,
        }),
        readTryoutRouteLabels(input.locale),
        Effect.promise(() =>
          readServerTranslator({ locale: input.locale, namespace: "Tryouts" })
        ),
      ],
      { concurrency: "unbounded" }
    );
    if (!page || Option.isNone(countryPage) || Option.isNone(head)) {
      return { kind: "notFound" as const };
    }
    // A group with one track is never a page: a link to it opens that track's table.
    const own = Arr.findFirst(
      page.groups,
      (group) => group.publicPath === groupPath
    );
    if (Option.isSome(own) && own.value.entryPath !== groupPath) {
      return { entryPath: own.value.entryPath, kind: "entry" as const };
    }
    // A group's own name is a year, a grade or a Kolleg, so the page names its exam too.
    const name = `${page.exam.title} ${page.group.title}`;
    return {
      head: {
        ...head.value,
        title: tTryouts("search-title", { name }),
      },
      kind: "found" as const,
      labels,
      page,
      title: name,
      trail: buildTryoutTrail({
        countries: hub.countries,
        countryPath,
        exams: countryPage.value.exams,
        page,
      }),
    };
  }
);

/** A track page: its title and the trail of its header, with its group's tracks. Its set list is read after it. */
export const readTryoutTrackRoute = Effect.fn("www.tryout.route.readTrack")(
  function* (input: {
    readonly country: string;
    readonly exam: string;
    readonly group: string;
    readonly locale: Locale;
    readonly search: CatalogQuery;
    readonly track: string;
  }) {
    const trackPath = getTryoutPublicPath({
      country: input.country,
      exam: input.exam,
      group: input.group,
      track: input.track,
    });
    const groupPath = getTryoutPublicPath({
      country: input.country,
      exam: input.exam,
      group: input.group,
    });
    const countryPath = getTryoutPublicPath({ country: input.country });
    const [page, group, countryPage, hub, head, labels, tTryouts] =
      yield* Effect.all(
        [
          readTryoutTrackPage(input.locale, trackPath),
          readTryoutGroupPage(input.locale, groupPath),
          readTryoutCountryPage(input.locale, countryPath),
          readTryoutHubPage(input.locale),
          readTryoutRouteHead({
            kind: "track",
            locale: input.locale,
            publicPath: trackPath,
          }),
          readTryoutRouteLabels(input.locale),
          Effect.promise(() =>
            readServerTranslator({ locale: input.locale, namespace: "Tryouts" })
          ),
        ],
        { concurrency: "unbounded" }
      );
    if (!(page && group) || Option.isNone(countryPage) || Option.isNone(head)) {
      return { kind: "notFound" as const };
    }
    // The set list needs the track's keys, so it follows the page here, on the
    // server beside the database, rather than in a second request from the browser.
    const list = yield* readTryoutTrackSetList({
      locale: input.locale,
      search: input.search,
      track: {
        countryKey: page.country.countryKey,
        examKey: page.exam.examKey,
        trackKey: page.track.trackKey,
      },
    });
    // A track's own name is a subject or a test, so the page names its exam and group too.
    const exam = `${page.exam.title} ${page.group.title} ${page.track.title}`;
    return {
      head: {
        ...head.value,
        description:
          page.track.description ??
          tTryouts("track-metadata-description", { exam }),
        // A track with reviewed artwork shares it, as its card in the exam's list shows it.
        image:
          getTryoutTrackCatalogArtwork(input.locale, {
            countryKey: page.country.countryKey,
            examKey: page.exam.examKey,
            trackKey: page.track.trackKey,
          }) ?? head.value.image,
        title: tTryouts("search-title", { name: exam }),
      },
      kind: "found" as const,
      labels,
      list,
      page,
      trail: buildTryoutTrail({
        countries: hub.countries,
        countryPath,
        exams: countryPage.value.exams,
        page: { ...page, tracks: group.tracks },
        trackPath,
      }),
    };
  }
);

/**
 * The set list of one track as every visitor reads it, filtered and sorted by the
 * catalog query of the address. A learner's table reads its own rows from Convex in
 * the browser, so this answer holds no one's progress.
 */
export const readTryoutTrackSetList = Effect.fn(
  "www.tryout.route.readTrackSetList"
)(function* (input: typeof TrackListRequestSchema.Type) {
  const args = {
    countryKey: input.track.countryKey,
    examKey: input.track.examKey,
    filter: input.search.status,
    locale: input.locale,
    paginationOpts: {
      cursor: null,
      numItems: input.numItems ?? TRYOUT_SET_PAGE_SIZE,
    },
    sort: { direction: input.search.direction, field: input.search.sort },
    trackKey: input.track.trackKey,
  };
  const result = yield* readTryoutSetList(args);
  return { args, result };
});

/** The hub page of one locale, read on the server for a loader. */
export const readTryoutHubHandler = serverHandler(
  ({ locale }: { readonly locale: Locale }) => readTryoutHubRoute(locale)
);

/** One country page, or the not-found decision when the catalog has none. */
export const readTryoutCountryHandler = serverHandler(readTryoutCountryRoute);

/** One group page, or the not-found decision when the catalog has none. */
export const readTryoutGroupHandler = serverHandler(readTryoutGroupRoute);

/** One track page, or the not-found decision when the catalog has none. */
export const readTryoutTrackHandler = serverHandler(readTryoutTrackRoute);

/** The set list of one track, as every visitor reads it. */
export const readTryoutTrackListHandler = serverHandler(readTryoutTrackSetList);
