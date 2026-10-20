import type { Ref } from "@confect/core";
import { HttpClient } from "@confect/js";
import "@tanstack/react-start/server-only";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { tryoutMetadataArgsValidator } from "@repo/backend/content/tryout/spec";
import { renderServerComponent } from "@tanstack/react-start/rsc";
import { Effect, Option, Schema } from "effect";
import type { Locale } from "use-intl";
import { loadTryoutQuestion } from "@/components/tryout/content/signed";
import { decodeSourceRevision } from "@/lib/content/published/origin";
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
 * Reads and renders the signed question selected for the marketing page. The
 * selection is the same for every request of one release, so the content store
 * holds it once for each release and locale. The signed body is verified and
 * rendered again on each call, because nothing caches the rendered tree.
 */
export async function readFeaturedTryout(locale: Locale) {
  const featured = await Effect.runPromise(
    queryContentStore(tryouts.queries.catalog.getFeaturedQuestion, {
      appLocale: AppLocaleSchema.make(locale),
    }).pipe(Effect.withTracerTiming(false))
  );
  return await Effect.runPromise(
    Effect.gen(function* () {
      const question = yield* loadTryoutQuestion(featured.question);
      // The question is a server component tree, so it crosses to the page as Flight data.
      const content = yield* Effect.promise(() =>
        renderServerComponent(question.content)
      );
      return {
        question: content,
        response: featured.response,
      };
    })
  );
}

/**
 * Reads exact signed route metadata from the tagged content cache. The `use
 * cache` boundary stays so that the try-out pages prerender and the try-out tag
 * still expires them; behind it the content store answers for the release.
 */
export const readTryoutMetadata = Effect.fn("www.tryout.catalog.readMetadata")(
  function* (args: TryoutMetadataArgs) {
    return yield* queryContentStore(
      tryouts.queries.catalog.getMetadata,
      args
    ).pipe(Effect.withTracerTiming(false));
  }
);

/**
 * Reads the public country-first try-out catalog. The content store answers for
 * the release.
 */
export const readTryoutHubPage = Effect.fn("www.tryout.catalog.readHubPage")(
  function* (locale: Locale) {
    const appLocale = AppLocaleSchema.make(locale);
    const page = yield* queryContentStore(tryouts.queries.catalog.getHubPage, {
      appLocale,
    }).pipe(
      Effect.withTracerTiming(false),
      Effect.mapError((cause) => new TryoutCatalogReadError({ cause }))
    );
    const sourceRevision = yield* decodeSourceRevision(page.sourceRevision, {
      appLocale,
      publicPath: "try-out",
    });
    return { ...page, sourceRevision };
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
  ).pipe(
    Effect.withTracerTiming(false),
    Effect.mapError((cause) => new TryoutCatalogReadError({ cause }))
  );
  if (!page) {
    return Option.none();
  }
  const sourceRevision = yield* decodeSourceRevision(page.sourceRevision, {
    appLocale,
    publicPath,
  });
  return Option.some({ ...page, sourceRevision });
});

/** Reads one public exam page. The content store answers for the release. */
export const readTryoutExamPage = Effect.fn("www.tryout.catalog.readExamPage")(
  function* (locale: Locale, publicPath: string) {
    return yield* readPublishedTryoutExamPage({
      appLocale: AppLocaleSchema.make(locale),
      publicPath,
    }).pipe(Effect.withTracerTiming(false));
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
  }).pipe(Effect.withTracerTiming(false));
});

/** Reads the first personalized catalog result after the framework resolves the session. */
export const readTryoutSetList = Effect.fn("www.tryout.catalog.readSetList")(
  function* (
    token: string | undefined,
    args: Ref.Args<typeof tryouts.queries.sets.list>
  ) {
    return yield* Effect.flatMap(HttpClient.HttpClient, (client) =>
      client.query(tryouts.queries.sets.list, args)
    ).pipe(
      Effect.provide(
        httpLayer(
          token
            ? {
                auth: token,
              }
            : {}
        )
      ),
      Effect.withTracerTiming(false),
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
    }).pipe(Effect.withTracerTiming(false));
  }
);

/** Fetches one authenticated set bootstrap without subscribing. */
export const readTryoutSetAttemptPage = Effect.fn(
  "www.tryout.catalog.readSetAttemptPage"
)(function* (
  token: string,
  request: Ref.Args<typeof tryouts.queries.attemptPage.getSet>["request"]
) {
  return yield* Effect.flatMap(HttpClient.HttpClient, (client) =>
    client.query(tryouts.queries.attemptPage.getSet, {
      request,
    })
  ).pipe(
    Effect.provide(
      httpLayer({
        auth: token,
      })
    ),
    Effect.withTracerTiming(false),
    Effect.mapError(
      (cause) =>
        new TryoutCatalogReadError({
          cause,
        })
    )
  );
});

/** Reads one public section page. The content store answers for the release. */
export const readTryoutSectionPage = Effect.fn(
  "www.tryout.catalog.readSectionPage"
)(function* (locale: Locale, publicPath: string) {
  return yield* readPublishedTryoutSectionPage({
    appLocale: AppLocaleSchema.make(locale),
    publicPath,
  }).pipe(Effect.withTracerTiming(false));
});

/** Fetches one authenticated section bootstrap without subscribing. */
export const readTryoutSectionAttemptPage = Effect.fn(
  "www.tryout.catalog.readSectionAttemptPage"
)(function* (
  token: string,
  request: Ref.Args<typeof tryouts.queries.attemptPage.getSection>["request"]
) {
  return yield* Effect.flatMap(HttpClient.HttpClient, (client) =>
    client.query(tryouts.queries.attemptPage.getSection, {
      request,
    })
  ).pipe(
    Effect.provide(
      httpLayer({
        auth: token,
      })
    ),
    Effect.withTracerTiming(false),
    Effect.mapError(
      (cause) =>
        new TryoutCatalogReadError({
          cause,
        })
    )
  );
});
