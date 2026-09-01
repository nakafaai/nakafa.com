import "server-only";

import {
  type AppLocale,
  AppLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import { api } from "@repo/backend/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import type { FunctionArgs } from "convex/server";
import { Effect, Schema } from "effect";
import type { Locale } from "next-intl";
import { loadTryoutQuestion } from "@/components/tryout/content/signed";
import { applyContentRuntimeCache } from "@/lib/content/cache";
import { decodeSourceRevision } from "@/lib/content/published/origin";

type TryoutMetadataKind = FunctionArgs<
  typeof api.tryouts.queries.catalog.getMetadata
>["kind"];

interface TryoutMetadataArgs {
  readonly appLocale: AppLocale;
  readonly kind: TryoutMetadataKind;
  readonly publicPath: string;
}

/** Expected failure while reading one authenticated try-out page. */
class TryoutCatalogReadError extends Schema.TaggedError<TryoutCatalogReadError>()(
  "TryoutCatalogReadError",
  { cause: Schema.Unknown }
) {}

/** Reads and renders the signed question selected for the marketing page. */
export async function readFeaturedTryout(locale: Locale) {
  "use cache";
  applyContentRuntimeCache();

  const featured = await fetchQuery(
    api.tryouts.queries.catalog.getFeaturedQuestion,
    { appLocale: AppLocaleSchema.make(locale) }
  );

  return await Effect.runPromise(
    Effect.gen(function* () {
      const question = yield* loadTryoutQuestion(featured.question);

      return {
        choices: featured.choices,
        question: question.content,
      };
    })
  );
}

/** Reads exact signed route metadata from the tagged content cache. */
export async function readTryoutMetadata(args: TryoutMetadataArgs) {
  "use cache";
  applyContentRuntimeCache();

  return await fetchQuery(api.tryouts.queries.catalog.getMetadata, args);
}

/** Reads the public country-first try-out catalog from the tagged content cache. */
export async function readTryoutHubPage(locale: Locale) {
  "use cache";
  applyContentRuntimeCache();

  const appLocale = AppLocaleSchema.make(locale);
  return await Effect.runPromise(
    Effect.tryPromise({
      catch: (cause) => new TryoutCatalogReadError({ cause }),
      try: () =>
        fetchQuery(api.tryouts.queries.catalog.getHubPage, {
          appLocale,
        }),
    }).pipe(
      Effect.flatMap((page) =>
        decodeSourceRevision(page.sourceRevision, {
          appLocale,
          publicPath: "try-out",
        }).pipe(Effect.map((sourceRevision) => ({ ...page, sourceRevision })))
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
  applyContentRuntimeCache();

  const appLocale = AppLocaleSchema.make(locale);
  return await Effect.runPromise(
    Effect.tryPromise({
      catch: (cause) => new TryoutCatalogReadError({ cause }),
      try: () =>
        fetchQuery(api.tryouts.queries.catalog.getCountryPage, {
          appLocale,
          publicPath,
        }),
    }).pipe(
      Effect.flatMap((page) => {
        if (!page) {
          return Effect.succeed(null);
        }
        return decodeSourceRevision(page.sourceRevision, {
          appLocale,
          publicPath,
        }).pipe(Effect.map((sourceRevision) => ({ ...page, sourceRevision })));
      })
    )
  );
}

/** Reads one public exam page from the tagged content cache. */
export async function readTryoutExamPage(locale: Locale, publicPath: string) {
  "use cache";
  applyContentRuntimeCache();

  return await fetchQuery(api.tryouts.queries.catalog.getExamPage, {
    appLocale: AppLocaleSchema.make(locale),
    publicPath,
  });
}

/** Reads one public track shell from the tagged content cache. */
export async function readTryoutTrackPage(locale: Locale, publicPath: string) {
  "use cache";
  applyContentRuntimeCache();

  return await fetchQuery(api.tryouts.queries.catalog.getTrackPage, {
    appLocale: AppLocaleSchema.make(locale),
    publicPath,
  });
}

/** Reads one public set page from the tagged content cache. */
export async function readTryoutSetPage(locale: Locale, publicPath: string) {
  "use cache";
  applyContentRuntimeCache();

  return await fetchQuery(api.tryouts.queries.catalog.getSetPage, {
    appLocale: AppLocaleSchema.make(locale),
    publicPath,
  });
}

/** Fetches one authenticated set bootstrap without subscribing. */
export const readTryoutSetAttemptPage = Effect.fn(
  "www.tryout.catalog.readSetAttemptPage"
)(function* (
  token: string,
  request: FunctionArgs<
    typeof api.tryouts.queries.attemptPage.getSet
  >["request"]
) {
  return yield* Effect.tryPromise({
    catch: (cause) => new TryoutCatalogReadError({ cause }),
    try: () =>
      fetchQuery(
        api.tryouts.queries.attemptPage.getSet,
        { request },
        { token }
      ),
  });
});

/** Reads one public section page from the tagged content cache. */
export async function readTryoutSectionPage(
  locale: Locale,
  publicPath: string
) {
  "use cache";
  applyContentRuntimeCache();

  return await fetchQuery(api.tryouts.queries.catalog.getSectionPage, {
    appLocale: AppLocaleSchema.make(locale),
    publicPath,
  });
}

/** Fetches one authenticated section bootstrap without subscribing. */
export const readTryoutSectionAttemptPage = Effect.fn(
  "www.tryout.catalog.readSectionAttemptPage"
)(function* (
  token: string,
  request: FunctionArgs<
    typeof api.tryouts.queries.attemptPage.getSection
  >["request"]
) {
  return yield* Effect.tryPromise({
    catch: (cause) => new TryoutCatalogReadError({ cause }),
    try: () =>
      fetchQuery(
        api.tryouts.queries.attemptPage.getSection,
        { request },
        { token }
      ),
  });
});
