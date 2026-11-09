import type { Ref } from "@confect/core";
import type tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import type { Locale } from "@repo/internationalization/src/locale";
import { readServerTranslator } from "@repo/internationalization/src/translator";
import { Array as Arr, Effect, Option } from "effect";
import {
  buildTryoutCountryOptions,
  buildTryoutGroupOptions,
  offersGroupChoice,
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
import {
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
 * The hub: every country's exam cards and the breadcrumbs. Picking an exam is
 * the first click. A try-out catalog's revision is an authored date, not a
 * commit, so it names no source tree.
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
    const countries = yield* Effect.forEach(page.countries, (country) =>
      Effect.map(
        Effect.forEach(country.exams, (exam) =>
          withExamArtwork(locale, country.countryKey, exam)
        ),
        (exams) => ({ ...country, exams })
      )
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
      page: { countries },
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
      withExamArtwork(input.locale, page.value.country.countryKey, exam)
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

/**
 * The header of a group or a track page: the group choice, its one primary
 * control, when the exam offers one, and the exam's name in the breadcrumb.
 * Without a choice the crumb names the group as well, as in SNBT 2027. The
 * crumb links to the group's track cards only when the group has some.
 */
function readCatalogHeader(
  page: Pick<
    NonNullable<Ref.Returns<typeof tryouts.queries.catalog.getGroupPage>>,
    "exam" | "group" | "groups"
  >
) {
  const offered = offersGroupChoice(page.exam.groupAxis, page.groups);
  const own = Arr.findFirst(
    page.groups,
    (group) => group.publicPath === page.group.publicPath
  );
  const cards = Option.filter(
    own,
    (group) => group.entryPath === group.publicPath
  );
  return {
    examCrumb: {
      label: offered
        ? page.exam.title
        : `${page.exam.title} ${page.group.title}`,
      ...Option.match(cards, {
        onNone: () => ({}),
        onSome: (group) => ({ path: group.publicPath }),
      }),
    },
    groupOptions: offered ? buildTryoutGroupOptions(page.groups) : [],
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
    const groupPath = getTryoutPublicPath({
      country: input.country,
      exam: input.exam,
      group: input.group,
    });
    const [page, head, labels, tTryouts] = yield* Effect.all(
      [
        readTryoutGroupPage(input.locale, groupPath),
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
    if (!page || Option.isNone(head)) {
      return { kind: "notFound" as const };
    }
    // A group's own name is a year, a grade or a Kolleg, so the page names its exam too.
    const name = `${page.exam.title} ${page.group.title}`;
    const header = readCatalogHeader(page);
    return {
      groupOptions: header.groupOptions,
      head: {
        ...head.value,
        title: tTryouts("search-title", { name }),
      },
      kind: "found" as const,
      labels,
      name: header.examCrumb.label,
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
    const trackPath = getTryoutPublicPath({
      country: input.country,
      exam: input.exam,
      group: input.group,
      track: input.track,
    });
    const [page, head, labels, tTryouts] = yield* Effect.all(
      [
        readTryoutTrackPage(input.locale, trackPath),
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
    if (!page || Option.isNone(head)) {
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
    const header = readCatalogHeader(page);
    return {
      examCrumb: header.examCrumb,
      groupOptions: header.groupOptions,
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
