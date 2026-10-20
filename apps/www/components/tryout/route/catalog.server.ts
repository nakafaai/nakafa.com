import "@tanstack/react-start/server-only";

import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import type { tryoutMetadataArgsValidator } from "@repo/backend/content/tryout/spec";
import { LocalizedPath } from "@repo/internationalization/src/alternates";
import type { Locale } from "@repo/internationalization/src/locale";
import { readServerTranslator } from "@repo/internationalization/src/translator";
import { Effect, Option, Schema } from "effect";
import {
  buildTryoutCountryOptions,
  buildTryoutExamOptions,
} from "@/components/tryout/catalog/options";
import {
  readTryoutCountryPage,
  readTryoutExamPage,
  readTryoutHubPage,
  readTryoutMetadata,
  readTryoutSetList,
  readTryoutTrackPage,
} from "@/components/tryout/catalog/server";
import { readCatalogQuery } from "@/components/tryout/catalog/table/query";
import { TRYOUT_SET_PAGE_SIZE } from "@/components/tryout/catalog/table/types";
import { getTryoutHref } from "@/components/tryout/route/path";
import { keepPersonalResponse } from "@/components/tryout/route/response.server";
import type { TrackListRequestSchema } from "@/components/tryout/route/search";
import { readRequestToken } from "@/components/tryout/route/token.server";
import { getAksaraTreeUrl } from "@/lib/content/repository";
import { getAppSocialArtwork } from "@/lib/og/app";
import { createBreadcrumbItems } from "@/lib/seo/breadcrumbs";
import { getOgUrl } from "@/lib/seo/social";
import { serverHandler } from "@/lib/server/fn";
import { resolveTryoutExamArtwork } from "@/lib/tryout/artwork";

/** The catalog kinds whose published route carries its own title and social image. */
type TryoutRouteKind = typeof tryoutMetadataArgsValidator.kind.Type;

/** The head facts of one published try-out route, as its page builds them. */
const TryoutRouteHeadSchema = Schema.Struct({
  canonicalPath: LocalizedPath,
  description: Schema.String,
  image: Schema.String,
  indexable: Schema.Boolean,
  title: Schema.String,
});

type TryoutRouteHead = typeof TryoutRouteHeadSchema.Type;

/** The catalog labels that one try-out page names, read in its locale. */
const TryoutRouteLabelsSchema = Schema.Struct({
  home: Schema.String,
  more: Schema.String,
  tryOut: Schema.String,
  tryOutShort: Schema.String,
});
type TryoutRouteLabels = typeof TryoutRouteLabelsSchema.Type;

/**
 * Reads the head facts of one published try-out route. The catalog decides the
 * title and the social image. A route the catalog does not publish, or an exam
 * without the social image identity it needs, has no page, so the reader says
 * so with none.
 */
export const readTryoutRouteHead = Effect.fn("www.tryout.route.readHead")(
  function* (input: {
    readonly kind: TryoutRouteKind;
    readonly locale: Locale;
    readonly publicPath: string;
  }) {
    const appLocale = AppLocaleSchema.make(input.locale);
    const [published, tTryouts] = yield* Effect.all([
      readTryoutMetadata({
        appLocale,
        kind: input.kind,
        publicPath: input.publicPath,
      }),
      Effect.promise(() =>
        readServerTranslator({ locale: input.locale, namespace: "Tryouts" })
      ),
    ]);
    const source = published.route;
    if (!source) {
      return Option.none<TryoutRouteHead>();
    }
    if (input.kind !== "exam") {
      return Option.some<TryoutRouteHead>({
        canonicalPath: `/${input.locale}/${source.publicPath}`,
        description: source.description ?? tTryouts("metadata-description"),
        image: getOgUrl(input.locale, source.publicPath),
        indexable: true,
        title: source.title,
      });
    }
    if (!source.socialImageIdentity) {
      return Option.none<TryoutRouteHead>();
    }
    const artwork = yield* resolveTryoutExamArtwork({
      ...source.socialImageIdentity,
      appLocale,
      publicPath: source.publicPath,
    });
    return Option.some<TryoutRouteHead>({
      canonicalPath: `/${input.locale}/${source.publicPath}`,
      description: source.description ?? tTryouts("metadata-description"),
      image: artwork.socialImageSrc,
      indexable: true,
      title: source.title,
    });
  }
);

/** The labels of a catalog page, read once for its locale. */
const readTryoutRouteLabels = Effect.fn("www.tryout.route.readLabels")(
  function* (locale: Locale) {
    const tCommon = yield* Effect.promise(() =>
      readServerTranslator({ locale, namespace: "Common" })
    );
    return {
      home: tCommon("home"),
      more: tCommon("more"),
      tryOut: tCommon("try-out"),
      tryOutShort: tCommon("try-out-short"),
    } satisfies TryoutRouteLabels;
  }
);

/**
 * The Aksara source tree of one catalog path at its revision. A catalog without
 * a revision names no source, so the link is absent.
 */
function readAksaraSourceUrl<
  Revision extends Parameters<typeof getAksaraTreeUrl>[0]["revision"],
>(path: string, sourceRevision: Revision | null | undefined) {
  return Option.fromNullishOr(sourceRevision).pipe(
    Option.map((revision) => getAksaraTreeUrl({ path, revision })),
    Option.getOrUndefined
  );
}

/** The hub: the country-first catalog, its breadcrumbs and its source tree. */
export const readTryoutHubRoute = Effect.fn("www.tryout.route.readHub")(
  function* (locale: Locale) {
    const [page, labels, tTryouts] = yield* Effect.all([
      readTryoutHubPage(locale),
      readTryoutRouteLabels(locale),
      Effect.promise(() =>
        readServerTranslator({ locale, namespace: "Tryouts" })
      ),
    ]);
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
      sourceUrl: readAksaraSourceUrl(
        "packages/corpus/tryout",
        page.sourceRevision
      ),
    };
  }
);

/** A country page: its exam families, each with the artwork the catalog names. */
export const readTryoutCountryRoute = Effect.fn("www.tryout.route.readCountry")(
  function* (input: { readonly country: string; readonly locale: Locale }) {
    const countryPath = getTryoutHref({ country: input.country }).slice(1);
    const [page, hub, head, labels, tTryouts] = yield* Effect.all([
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
    ]);
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
      actionLabel: tTryouts("open-exam-cta"),
      countryOptions: buildTryoutCountryOptions(input.locale, hub.countries),
      countryPath,
      exams,
      head: head.value,
      kind: "found" as const,
      labels,
      selectorLabel: tTryouts("country-selector-label"),
      sourceUrl: readAksaraSourceUrl(
        `packages/corpus/tryout/${input.country}`,
        page.value.sourceRevision
      ),
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
    const countryPath = getTryoutHref({ country: input.country }).slice(1);
    const examPath = getTryoutHref({
      country: input.country,
      exam: input.exam,
    }).slice(1);
    const [page, countryPage, head, labels, tTryouts] = yield* Effect.all([
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
    ]);
    if (!page || Option.isNone(countryPage) || Option.isNone(head)) {
      return { kind: "notFound" as const };
    }
    return {
      countryHref: getTryoutHref({ country: input.country }),
      exam: page,
      examOptions: buildTryoutExamOptions(
        input.locale,
        countryPage.value.exams
      ),
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
    readonly track: string;
  }) {
    const countryPath = getTryoutHref({ country: input.country }).slice(1);
    const examPath = getTryoutHref({
      country: input.country,
      exam: input.exam,
    }).slice(1);
    const trackPath = getTryoutHref({
      country: input.country,
      exam: input.exam,
      track: input.track,
    }).slice(1);
    const [page, countryPage, head, labels, tTryouts] = yield* Effect.all([
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
    ]);
    if (!page || Option.isNone(countryPage) || Option.isNone(head)) {
      return { kind: "notFound" as const };
    }
    return {
      countryHref: getTryoutHref({ country: input.country }),
      examHref: getTryoutHref({ country: input.country, exam: input.exam }),
      examOptions: buildTryoutExamOptions(
        input.locale,
        countryPage.value.exams
      ),
      examPath,
      head: head.value,
      kind: "found" as const,
      labels,
      page,
      selectorLabel: tTryouts("exam-selector-label"),
    };
  }
);

/**
 * The learner's own set list of one track, filtered and sorted by the catalog
 * query of the address. It is personal progress, so it is read per request and
 * never cached, and the track page streams it after its heading.
 */
export const readTryoutTrackSetList = Effect.fn(
  "www.tryout.route.readTrackSetList"
)(function* (input: typeof TrackListRequestSchema.Type) {
  yield* keepPersonalResponse;
  const token = yield* readRequestToken();
  const selection = readCatalogQuery(input.search);
  const args = {
    countryKey: input.track.countryKey,
    examKey: input.track.examKey,
    filter: selection.status,
    locale: input.locale,
    paginationOpts: { cursor: null, numItems: TRYOUT_SET_PAGE_SIZE },
    sort: { direction: selection.direction, field: selection.sort },
    trackKey: input.track.trackKey,
  };
  const result = yield* readTryoutSetList(token, args);
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

/** The learner's set list of one track, read per request and never cached. */
export const readTryoutTrackListHandler = serverHandler(readTryoutTrackSetList);
