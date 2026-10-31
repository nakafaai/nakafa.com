import type { Ref } from "@confect/core";
import { HttpClient } from "@confect/js";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { TryoutQuestionBodyText } from "@repo/backend/confect/tryouts/runtime/spec";
import { tryoutMetadataArgsValidator } from "@repo/backend/content/tryout/spec";
import { Effect, Option, Schema } from "effect";
import type { Locale } from "use-intl";
import { queryContentStore } from "@/lib/content/store/query";
import {
  readPublishedTryoutExamPage,
  readPublishedTryoutSectionPage,
} from "@/lib/content/tryout/catalog";
import { httpLayer } from "@/lib/convex/http";

const TryoutMetadataArgsSchema = Schema.Struct({
  appLocale: AppLocaleSchema,
  kind: tryoutMetadataArgsValidator.kind,
  publicPath: Schema.String,
});
type TryoutMetadataArgs = typeof TryoutMetadataArgsSchema.Type;

/** Expected failure while reading one authenticated try-out page. */
class TryoutCatalogReadError extends Schema.TaggedError<TryoutCatalogReadError>()(
  "TryoutCatalogReadError",
  {
    cause: Schema.Unknown,
  }
) {}

/**
 * Reads the question demonstrated on the marketing page, decoded from the JSON text its body crosses
 * the wire as: its prompt, its interaction, and the key the demo answers with. The selection is the
 * same for every request of one release, so the content store holds it once for each release and
 * locale.
 */
export const readFeaturedTryout = Effect.fn("www.tryout.catalog.readFeatured")(
  function* (locale: Locale) {
    const featured = yield* queryContentStore(
      tryouts.queries.catalog.getFeaturedQuestion,
      {
        appLocale: AppLocaleSchema.make(locale),
      }
    );
    return yield* Schema.decodeEffect(TryoutQuestionBodyText)(featured.body);
  }
);

/**
 * Reads exact signed route metadata from the tagged content cache. The `use
 * cache` boundary stays so that the try-out pages prerender and the try-out tag
 * still expires them; behind it the content store answers for the release.
 */
export const readTryoutMetadata = Effect.fn("www.tryout.catalog.readMetadata")(
  function* (args: TryoutMetadataArgs) {
    return yield* queryContentStore(tryouts.queries.catalog.getMetadata, args);
  }
);

/**
 * Reads the public country-first try-out catalog. The content store answers for
 * the release. Its revision is the catalog's authored revision, a date the
 * contract keeps as written, not a commit.
 */
export const readTryoutHubPage = Effect.fn("www.tryout.catalog.readHubPage")(
  function* (locale: Locale) {
    const appLocale = AppLocaleSchema.make(locale);
    return yield* queryContentStore(tryouts.queries.catalog.getHubPage, {
      appLocale,
    }).pipe(Effect.mapError((cause) => new TryoutCatalogReadError({ cause })));
  }
);

/**
 * Reads one public country page. The content store answers for the release, so
 * Convex is asked once for each release, locale and path.
 */
export const readTryoutCountryPage = Effect.fn(
  "www.tryout.catalog.readCountryPage"
)(function* (locale: Locale, publicPath: string) {
  const appLocale = AppLocaleSchema.make(locale);
  const page = yield* queryContentStore(
    tryouts.queries.catalog.getCountryPage,
    {
      appLocale,
      publicPath,
    }
  ).pipe(Effect.mapError((cause) => new TryoutCatalogReadError({ cause })));
  return Option.fromNullishOr(page);
});

/** Reads one public exam page. The content store answers for the release. */
export const readTryoutExamPage = Effect.fn("www.tryout.catalog.readExamPage")(
  function* (locale: Locale, publicPath: string) {
    return yield* readPublishedTryoutExamPage({
      appLocale: AppLocaleSchema.make(locale),
      publicPath,
    });
  }
);

/**
 * Reads one public track shell. The content store answers for the release.
 */
export const readTryoutTrackPage = Effect.fn(
  "www.tryout.catalog.readTrackPage"
)(function* (locale: Locale, publicPath: string) {
  return yield* queryContentStore(tryouts.queries.catalog.getTrackPage, {
    appLocale: AppLocaleSchema.make(locale),
    publicPath,
  });
});

/** Reads the first personalized catalog result after the framework resolves the session. */
export const readTryoutSetList = Effect.fn("www.tryout.catalog.readSetList")(
  function* (
    token: Option.Option<string>,
    args: Ref.Args<typeof tryouts.queries.sets.list>
  ) {
    return yield* Effect.flatMap(HttpClient.HttpClient, (client) =>
      client.query(tryouts.queries.sets.list, args)
    ).pipe(
      Effect.provide(
        httpLayer(
          Option.match(token, {
            onNone: () => ({}),
            onSome: (auth) => ({ auth }),
          })
        )
      ),
      Effect.mapError(
        (cause) =>
          new TryoutCatalogReadError({
            cause,
          })
      )
    );
  }
);

/** Reads one public set page. The content store answers for the release. */
export const readTryoutSetPage = Effect.fn("www.tryout.catalog.readSetPage")(
  function* (locale: Locale, publicPath: string) {
    return yield* queryContentStore(tryouts.queries.catalog.getSetPage, {
      appLocale: AppLocaleSchema.make(locale),
      publicPath,
    });
  }
);

/** Reads one public section page. The content store answers for the release. */
export const readTryoutSectionPage = Effect.fn(
  "www.tryout.catalog.readSectionPage"
)(function* (locale: Locale, publicPath: string) {
  return yield* readPublishedTryoutSectionPage({
    appLocale: AppLocaleSchema.make(locale),
    publicPath,
  });
});
