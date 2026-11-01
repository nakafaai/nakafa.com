import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import type { tryoutMetadataArgsValidator } from "@repo/backend/content/tryout/spec";
import { LocalizedPath } from "@repo/internationalization/src/alternates";
import type { Locale } from "@repo/internationalization/src/locale";
import { readServerTranslator } from "@repo/internationalization/src/translator";
import { Array as Arr, Effect, Option, Schema } from "effect";
import { readTryoutMetadata } from "@/components/tryout/catalog/source.server";
import { createResolvedRouteAlternates } from "@/lib/seo/alternates";
import { createBreadcrumbItems } from "@/lib/seo/breadcrumbs";
import { HeadAlternate, toHeadAlternates } from "@/lib/seo/head";
import { getOgUrl } from "@/lib/seo/social";
import { resolveTryoutExamArtwork } from "@/lib/tryout/artwork";

/** The catalog kinds whose published route carries its own title and social image. */
type TryoutRouteKind = typeof tryoutMetadataArgsValidator.kind.Type;

/**
 * The head facts of one published try-out route, as its page builds them. A route's slug can differ
 * from one locale to the next, as `general-reasoning` is `penalaran-umum` in Indonesian, so its
 * language links are the addresses the catalog holds for the same node in each locale.
 */
const TryoutRouteHeadSchema = Schema.Struct({
  alternates: Schema.Array(HeadAlternate),
  breadcrumbs: Schema.Array(
    Schema.Struct({
      "@type": Schema.Literal("ListItem"),
      item: Schema.String,
      name: Schema.String,
      position: Schema.Int,
    })
  ),
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
  tryOut: Schema.String,
  tryOutShort: Schema.String,
});
type TryoutRouteLabels = typeof TryoutRouteLabelsSchema.Type;

/** The catalog kinds of a route's ancestors, from the top of a `try-out/...` path. */
const ANCESTOR_KINDS = ["country", "exam", "track", "set"] as const;

/** How many segments a route's path holds above its first ancestor and below its last. */
const OWN_SEGMENTS = 2;

/**
 * The breadcrumb that a search result shows for a route: home, the hub, then each
 * ancestor by the title the catalog publishes, down to the route itself.
 */
const readTryoutBreadcrumbs = Effect.fn("www.tryout.route.readBreadcrumbs")(
  function* (input: {
    readonly locale: Locale;
    readonly publicPath: string;
    readonly title: string;
  }) {
    const appLocale = AppLocaleSchema.make(input.locale);
    const segments = input.publicPath.split("/");
    const labels = yield* readTryoutRouteLabels(input.locale);
    const ancestors = yield* Effect.forEach(
      Arr.take(ANCESTOR_KINDS, segments.length - OWN_SEGMENTS),
      (kind, index) =>
        readTryoutMetadata({
          appLocale,
          kind,
          publicPath: Arr.join(Arr.take(segments, index + OWN_SEGMENTS), "/"),
        })
    );
    return createBreadcrumbItems(input.locale, [
      { name: labels.home, path: "" },
      { name: labels.tryOut, path: "/try-out" },
      ...Arr.flatMap(ancestors, ({ route }) =>
        route ? [{ name: route.title, path: `/${route.publicPath}` }] : []
      ),
      { name: input.title, path: `/${input.publicPath}` },
    ]);
  }
);

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
    const [published, tTryouts] = yield* Effect.all(
      [
        readTryoutMetadata({
          appLocale,
          kind: input.kind,
          publicPath: input.publicPath,
        }),
        Effect.promise(() =>
          readServerTranslator({ locale: input.locale, namespace: "Tryouts" })
        ),
      ],
      { concurrency: "unbounded" }
    );
    const source = published.route;
    if (!source) {
      return Option.none<TryoutRouteHead>();
    }
    const alternates = toHeadAlternates(
      createResolvedRouteAlternates(
        { appLocale, publicPath: source.publicPath },
        source.alternates
      )
    );
    const breadcrumbs = yield* readTryoutBreadcrumbs({
      locale: input.locale,
      publicPath: source.publicPath,
      title: source.title,
    });
    if (input.kind !== "exam") {
      return Option.some<TryoutRouteHead>({
        alternates,
        breadcrumbs,
        canonicalPath: `/${input.locale}/${source.publicPath}`,
        description: source.description ?? tTryouts("metadata-description"),
        image: getOgUrl(input.locale, source.publicPath),
        indexable: true,
        title: tTryouts("search-title", { name: source.title }),
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
      alternates,
      breadcrumbs,
      canonicalPath: `/${input.locale}/${source.publicPath}`,
      description: source.description ?? tTryouts("metadata-description"),
      image: artwork.socialImageSrc,
      indexable: true,
      title: tTryouts("search-title", { name: source.title }),
    });
  }
);

/** The labels of a catalog page, read once for its locale. */
export const readTryoutRouteLabels = Effect.fn("www.tryout.route.readLabels")(
  function* (locale: Locale) {
    const tCommon = yield* Effect.promise(() =>
      readServerTranslator({ locale, namespace: "Common" })
    );
    return {
      home: tCommon("home"),
      tryOut: tCommon("try-out"),
      tryOutShort: tCommon("try-out-short"),
    } satisfies TryoutRouteLabels;
  }
);
