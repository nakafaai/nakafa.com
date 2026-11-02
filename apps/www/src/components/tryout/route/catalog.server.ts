import type { Locale } from "@repo/internationalization/src/locale";
import { readServerTranslator } from "@repo/internationalization/src/translator";
import { Effect, Option } from "effect";
import {
  buildTryoutCountryOptions,
  buildTryoutExamOptions,
} from "@/components/tryout/catalog/options";
import {
  readTryoutCountryPage,
  readTryoutExamPage,
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
import { getAppSocialArtwork } from "@/lib/og/app";
import { createBreadcrumbItems } from "@/lib/seo/breadcrumbs";
import { serverHandler } from "@/lib/server/fn";
import { resolveTryoutExamArtwork } from "@/lib/tryout/artwork";

/**
 * The hub: the country-first catalog and its breadcrumbs. A try-out catalog's
 * revision is an authored date, not a commit, so it names no source tree.
 */
export const readTryoutHubRoute = Effect.fn("www.tryout.route.readHub")(
  function* (locale: Locale) {
    const [page, labels, tTryouts] = yield* Effect.all(
      [
        readTryoutHubPage(locale),
        readTryoutRouteLabels(locale),
        Effect.promise(() =>
          readServerTranslator({ locale, namespace: "Tryouts" })
        ),
      ],
      { concurrency: "unbounded" }
    );
    return {
      breadcrumbs: createBreadcrumbItems(locale, [
        { name: labels.home, path: "" },
        { name: labels.tryOut, path: "/try-out" },
      ]),
      description: tTryouts("metadata-description"),
      image: getAppSocialArtwork({
        key: "try-out",
        locale,
        publicPath: "try-out",
      }),
      labels,
      page,
      title: tTryouts("hub-search-title"),
    };
  }
);

/** A country page: its exam families, each with the artwork the catalog names. */
export const readTryoutCountryRoute = Effect.fn("www.tryout.route.readCountry")(
  function* (input: { readonly country: string; readonly locale: Locale }) {
    const countryPath = getTryoutPublicPath({ country: input.country });
    const [page, hub, head, labels, tTryouts] = yield* Effect.all(
      [
        readTryoutCountryPage(input.locale, countryPath),
        readTryoutHubPage(input.locale),
        readTryoutRouteHead({
          kind: "country",
          locale: input.locale,
          publicPath: countryPath,
        }),
        readTryoutRouteLabels(input.locale),
        Effect.promise(() =>
          readServerTranslator({ locale: input.locale, namespace: "Tryouts" })
        ),
      ],
      { concurrency: "unbounded" }
    );
    if (Option.isNone(page) || Option.isNone(head)) {
      return { kind: "notFound" as const };
    }
    const exams = yield* Effect.forEach(page.value.exams, (exam) =>
      resolveTryoutExamArtwork({
        appLocale: input.locale,
        countryKey: page.value.country.countryKey,
        examKey: exam.examKey,
        publicPath: exam.publicPath,
      }).pipe(
        Effect.map((artwork) =>
          artwork.cardImageSrc
            ? { ...exam, imageSrc: artwork.cardImageSrc }
            : exam
        )
      )
    );
    return {
      countryOptions: buildTryoutCountryOptions(hub.countries),
      countryPath,
      exams,
      head: head.value,
      kind: "found" as const,
      labels,
      selectorLabel: tTryouts("country-selector-label"),
    };
  }
);

/** An exam page: its tracks and the exam selector of its country. */
export const readTryoutExamRoute = Effect.fn("www.tryout.route.readExam")(
  function* (input: {
    readonly country: string;
    readonly exam: string;
    readonly locale: Locale;
  }) {
    const countryPath = getTryoutPublicPath({ country: input.country });
    const examPath = getTryoutPublicPath({
      country: input.country,
      exam: input.exam,
    });
    const [page, countryPage, head, labels, tTryouts] = yield* Effect.all(
      [
        readTryoutExamPage(input.locale, examPath),
        readTryoutCountryPage(input.locale, countryPath),
        readTryoutRouteHead({
          kind: "exam",
          locale: input.locale,
          publicPath: examPath,
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
    return {
      countryPath: getTryoutPublicPath({ country: input.country }),
      exam: page,
      examOptions: buildTryoutExamOptions(countryPage.value.exams),
      examPath,
      head: head.value,
      kind: "found" as const,
      labels,
      selectorLabel: tTryouts("exam-selector-label"),
    };
  }
);

/** A track page: its title and the exam selector. Its set list is read after it. */
export const readTryoutTrackRoute = Effect.fn("www.tryout.route.readTrack")(
  function* (input: {
    readonly country: string;
    readonly exam: string;
    readonly locale: Locale;
    readonly search: CatalogQuery;
    readonly track: string;
  }) {
    const countryPath = getTryoutPublicPath({ country: input.country });
    const examPath = getTryoutPublicPath({
      country: input.country,
      exam: input.exam,
    });
    const trackPath = getTryoutPublicPath({
      country: input.country,
      exam: input.exam,
      track: input.track,
    });
    const [page, countryPage, head, labels, tTryouts] = yield* Effect.all(
      [
        readTryoutTrackPage(input.locale, trackPath),
        readTryoutCountryPage(input.locale, countryPath),
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
    if (!page || Option.isNone(countryPage) || Option.isNone(head)) {
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
    const exam = `${page.exam.title} ${page.track.title}`;
    return {
      countryPath: getTryoutPublicPath({ country: input.country }),
      examOptions: buildTryoutExamOptions(countryPage.value.exams),
      examPath,
      // Every exam has a Year 2027, so the page names its exam too.
      head: {
        ...head.value,
        description:
          page.track.description ??
          tTryouts("track-metadata-description", { exam }),
        title: tTryouts("search-title", { name: exam }),
      },
      kind: "found" as const,
      labels,
      list,
      page,
      selectorLabel: tTryouts("exam-selector-label"),
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

/** One exam page, or the not-found decision when the catalog has none. */
export const readTryoutExamHandler = serverHandler(readTryoutExamRoute);

/** One track page, or the not-found decision when the catalog has none. */
export const readTryoutTrackHandler = serverHandler(readTryoutTrackRoute);

/** The set list of one track, as every visitor reads it. */
export const readTryoutTrackListHandler = serverHandler(readTryoutTrackSetList);
