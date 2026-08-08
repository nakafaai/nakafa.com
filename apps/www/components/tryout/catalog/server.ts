import "server-only";

import { api } from "@repo/backend/convex/_generated/api";
import { fetchQuery, preloadQuery } from "convex/nextjs";
import type { FunctionArgs } from "convex/server";
import { Effect, Schema } from "effect";
import type { Locale } from "next-intl";
import { loadSignedTryoutContent } from "@/components/tryout/content/signed";
import { applyContentRuntimeCache } from "@/lib/content/cache";
import { decodeSourceRevision } from "@/lib/content/published/origin";

type TryoutMetadataArgs = FunctionArgs<
  typeof api.tryouts.queries.catalog.getMetadata
>;

/** Expected failure while reading one authenticated frozen section route. */
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
    { locale }
  );

  return await Effect.runPromise(
    Effect.gen(function* () {
      const rendered = yield* loadSignedTryoutContent({
        answers: [],
        questions: [featured.question],
      });
      const question = rendered.questions[0];
      if (!question) {
        return yield* new TryoutCatalogReadError({
          cause: "The featured try-out question did not render.",
        });
      }

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

  return await Effect.runPromise(
    Effect.tryPromise({
      catch: (cause) => new TryoutCatalogReadError({ cause }),
      try: () =>
        fetchQuery(api.tryouts.queries.catalog.getHubPage, {
          locale,
        }),
    }).pipe(
      Effect.flatMap((page) =>
        decodeSourceRevision(page.sourceRevision, {
          locale,
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

  return await Effect.runPromise(
    Effect.tryPromise({
      catch: (cause) => new TryoutCatalogReadError({ cause }),
      try: () =>
        fetchQuery(api.tryouts.queries.catalog.getCountryPage, {
          locale,
          publicPath,
        }),
    }).pipe(
      Effect.flatMap((page) => {
        if (!page) {
          return Effect.succeed(null);
        }
        return decodeSourceRevision(page.sourceRevision, {
          locale,
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
    locale,
    publicPath,
  });
}

/** Reads one public track shell from the tagged content cache. */
export async function readTryoutTrackPage(locale: Locale, publicPath: string) {
  "use cache";
  applyContentRuntimeCache();

  return await fetchQuery(api.tryouts.queries.catalog.getTrackPage, {
    locale,
    publicPath,
  });
}

/** Reads one public set page from the tagged content cache. */
export async function readTryoutSetPage(locale: Locale, publicPath: string) {
  "use cache";
  applyContentRuntimeCache();

  return await fetchQuery(api.tryouts.queries.catalog.getSetPage, {
    locale,
    publicPath,
  });
}

/** Reads one set route from the current user's exact immutable attempt. */
export const readTryoutAttemptSetRoute = Effect.fn(
  "www.tryout.catalog.readAttemptSetRoute"
)(function* (
  token: string,
  locale: Locale,
  publicPath: string,
  attemptId?: string
) {
  return yield* Effect.tryPromise({
    catch: (cause) => new TryoutCatalogReadError({ cause }),
    try: () =>
      fetchQuery(
        api.tryouts.queries.retained.getAttemptSetRoute,
        {
          attemptId,
          locale,
          publicPath,
        },
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
    locale,
    publicPath,
  });
}

/** Reads one route from the current user's immutable attempt snapshot. */
export const readTryoutAttemptSectionRoute = Effect.fn(
  "www.tryout.catalog.readAttemptSectionRoute"
)(function* (
  token: string,
  locale: Locale,
  publicPath: string,
  attemptId?: string
) {
  return yield* Effect.tryPromise({
    catch: (cause) => new TryoutCatalogReadError({ cause }),
    try: () =>
      fetchQuery(
        api.tryouts.queries.retained.getAttemptSectionRoute,
        {
          attemptId,
          locale,
          publicPath,
        },
        { token }
      ),
  });
});

/** Preloads one reactive attempt and section runtime with the current JWT. */
export const preloadTryoutSectionState = Effect.fn(
  "www.tryout.catalog.preloadSectionState"
)(function* (
  token: string,
  args: FunctionArgs<typeof api.tryouts.queries.runtime.getSectionState>
) {
  return yield* Effect.tryPromise({
    catch: (cause) => new TryoutCatalogReadError({ cause }),
    try: () =>
      preloadQuery(api.tryouts.queries.runtime.getSectionState, args, {
        token,
      }),
  });
});

/** Preloads one reactive set attempt and direct-entry runtime with the current JWT. */
export const preloadTryoutSetState = Effect.fn(
  "www.tryout.catalog.preloadSetState"
)(function* (
  token: string,
  args: FunctionArgs<typeof api.tryouts.queries.runtime.getSetState>
) {
  return yield* Effect.tryPromise({
    catch: (cause) => new TryoutCatalogReadError({ cause }),
    try: () =>
      preloadQuery(api.tryouts.queries.runtime.getSetState, args, {
        token,
      }),
  });
});
