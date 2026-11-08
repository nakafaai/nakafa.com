import type { Locale } from "@repo/internationalization/src/locale";
import { readServerTranslator } from "@repo/internationalization/src/translator";
import { Effect, Option } from "effect";
import {
  buildTryoutCountryOptions,
  buildTryoutExamOptions,
  buildTryoutGroupOptions,
} from "@/components/tryout/catalog/options";
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

/** The exam and group selectors of a group or a track page, from its country's exams and its exam's groups. */
function readSelectors(
  exams: Parameters<typeof buildTryoutExamOptions>[0],
  groups: Parameters<typeof buildTryoutGroupOptions>[0]
) {
  return {
    examOptions: buildTryoutExamOptions(exams),
    groupOptions: buildTryoutGroupOptions(groups),
  };
}

/** A group page: its tracks, and the exam and group selectors of its header. */
export const readTryoutGroupRoute = Effect.fn("www.tryout.route.readGroup")(
  function* (input: {
    readonly country: string;
    readonly exam: string;
    readonly group: string;
    readonly locale: Locale;
  }) {
    const countryPath = getTryoutPublicPath({ country: input.country });
    const groupPath = getTryoutPublicPath({
      country: input.country,
      exam: input.exam,
      group: input.group,
    });
    const [page, countryPage, head, labels, tTryouts] = yield* Effect.all(
      [
        readTryoutGroupPage(input.locale, groupPath),
        readTryoutCountryPage(input.locale, countryPath),
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
    // A group's own name is a year, a grade or a Kolleg, so the page names its exam too.
    const name = `${page.exam.title} ${page.group.title}`;
    return {
      ...readSelectors(countryPage.value.exams, page.groups),
      countryPath,
      head: {
        ...head.value,
        title: tTryouts("search-title", { name }),
      },
      kind: "found" as const,
      labels,
      name,
      page,
    };
  }
);

/** A track page: its title and the exam and group selectors. Its set list is read after it. */
export const readTryoutTrackRoute = Effect.fn("www.tryout.route.readTrack")(
  function* (input: {
    readonly country: string;
    readonly exam: string;
    readonly group: string;
    readonly locale: Locale;
    readonly search: CatalogQuery;
    readonly track: string;
  }) {
    const countryPath = getTryoutPublicPath({ country: input.country });
    const trackPath = getTryoutPublicPath({
      country: input.country,
      exam: input.exam,
      group: input.group,
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
    // A track's own name is a subject or a test, so the page names its exam and group too.
    const exam = `${page.exam.title} ${page.group.title} ${page.track.title}`;
    return {
      ...readSelectors(countryPage.value.exams, page.groups),
      countryPath,
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
