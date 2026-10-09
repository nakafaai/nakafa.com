import type { Ref } from "@confect/core";
import { HttpClient } from "@confect/js";
import "server-only";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { tryoutMetadataArgsValidator } from "@repo/backend/content/tryout/spec";
import { Effect, Schema } from "effect";
import type { Locale } from "next-intl";
import { loadTryoutQuestion } from "@/components/tryout/content/signed";
import { applyContentCache } from "@/lib/content/cache";
import { decodeSourceRevision } from "@/lib/content/published/origin";
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

/** Reads and renders the signed question selected for the marketing page. */
export async function readFeaturedTryout(locale: Locale) {
  "use cache";

  applyContentCache("tryout");
  const featured = await Effect.runPromise(
    Effect.flatMap(HttpClient.HttpClient, (client) =>
      client.query(tryouts.queries.catalog.getFeaturedQuestion, {
        appLocale: AppLocaleSchema.make(locale),
      })
    ).pipe(Effect.provide(httpLayer()), Effect.withTracerTiming(false))
  );
  return await Effect.runPromise(
    Effect.gen(function* () {
      const question = yield* loadTryoutQuestion(featured.question);
      return {
        question: question.content,
        response: featured.response,
      };
    })
  );
}

/** Reads exact signed route metadata from the tagged content cache. */
export async function readTryoutMetadata(args: TryoutMetadataArgs) {
  "use cache";

  applyContentCache("tryout");
  return await Effect.runPromise(
    Effect.flatMap(HttpClient.HttpClient, (client) =>
      client.query(tryouts.queries.catalog.getMetadata, args)
    ).pipe(Effect.provide(httpLayer()), Effect.withTracerTiming(false))
  );
}

/** Reads the public country-first try-out catalog from the tagged content cache. */
export async function readTryoutHubPage(locale: Locale) {
  "use cache";

  applyContentCache("tryout");
  const appLocale = AppLocaleSchema.make(locale);
  return await Effect.runPromise(
    Effect.flatMap(HttpClient.HttpClient, (client) =>
      client.query(tryouts.queries.catalog.getHubPage, {
        appLocale,
      })
    ).pipe(
      Effect.provide(httpLayer()),
      Effect.withTracerTiming(false),
      Effect.mapError(
        (cause) =>
          new TryoutCatalogReadError({
            cause,
          })
      ),
      Effect.flatMap((page) =>
        decodeSourceRevision(page.sourceRevision, {
          appLocale,
          publicPath: "try-out",
        }).pipe(
          Effect.map((sourceRevision) => ({
            ...page,
            sourceRevision,
          }))
        )
      )
    )
  );
}

/** Reads one public country page from the tagged content cache. */
export async function readTryoutCountryPage(
  locale: Locale,
  publicPath: string
) {
  "use cache";

  applyContentCache("tryout");
  const appLocale = AppLocaleSchema.make(locale);
  return await Effect.runPromise(
    Effect.flatMap(HttpClient.HttpClient, (client) =>
      client.query(tryouts.queries.catalog.getCountryPage, {
        appLocale,
        publicPath,
      })
    ).pipe(
      Effect.provide(httpLayer()),
      Effect.withTracerTiming(false),
      Effect.mapError(
        (cause) =>
          new TryoutCatalogReadError({
            cause,
          })
      ),
      Effect.flatMap((page) => {
        if (!page) {
          return Effect.succeed(null);
        }
        return decodeSourceRevision(page.sourceRevision, {
          appLocale,
          publicPath,
        }).pipe(
          Effect.map((sourceRevision) => ({
            ...page,
            sourceRevision,
          }))
        );
      })
    )
  );
}

/** Reads one public exam page from the tagged content cache. */
export async function readTryoutExamPage(locale: Locale, publicPath: string) {
  "use cache";

  applyContentCache("tryout");
  return await Effect.runPromise(
    readPublishedTryoutExamPage({
      appLocale: AppLocaleSchema.make(locale),
      publicPath,
    }).pipe(Effect.withTracerTiming(false))
  );
}

/** Reads one public track shell from the tagged content cache. */
export async function readTryoutTrackPage(locale: Locale, publicPath: string) {
  "use cache";

  applyContentCache("tryout");
  return await Effect.runPromise(
    Effect.flatMap(HttpClient.HttpClient, (client) =>
      client.query(tryouts.queries.catalog.getTrackPage, {
        appLocale: AppLocaleSchema.make(locale),
        publicPath,
      })
    ).pipe(Effect.provide(httpLayer()), Effect.withTracerTiming(false))
  );
}

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

/** Reads one public set page from the tagged content cache. */
export async function readTryoutSetPage(locale: Locale, publicPath: string) {
  "use cache";

  applyContentCache("tryout");
  return await Effect.runPromise(
    Effect.flatMap(HttpClient.HttpClient, (client) =>
      client.query(tryouts.queries.catalog.getSetPage, {
        appLocale: AppLocaleSchema.make(locale),
        publicPath,
      })
    ).pipe(Effect.provide(httpLayer()), Effect.withTracerTiming(false))
  );
}

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

/** Reads one public section page from the tagged content cache. */
export async function readTryoutSectionPage(
  locale: Locale,
  publicPath: string
) {
  "use cache";

  applyContentCache("tryout");
  return await Effect.runPromise(
    readPublishedTryoutSectionPage({
      appLocale: AppLocaleSchema.make(locale),
      publicPath,
    }).pipe(Effect.withTracerTiming(false))
  );
}

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
