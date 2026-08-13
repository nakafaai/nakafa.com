import { readConvexRuntimeQuery } from "@repo/backend/client/runtime";
import { api } from "@repo/backend/convex/_generated/api";
import { NakafaAgentContentIdSchema } from "@repo/contents/_lib/agent/schema/ref";
import type { Locale } from "@repo/utilities/locales";
import { locales } from "@repo/utilities/locales";
import type { FunctionArgs, FunctionReference } from "convex/server";
import { Effect, Option, Schema } from "effect";
import { env } from "@/env";
import { readPublishedApiItem } from "@/lib/content/published";

type ArticleApiPageArgs = FunctionArgs<
  typeof api.contentRelease.article.apiPage
>;
type MaterialApiPageArgs = FunctionArgs<
  typeof api.contentRelease.material.apiPage
>;

interface PublishedApiPage {
  readonly activeReleaseId: string;
  readonly continueCursor: string;
  readonly isDone: boolean;
  readonly page: ReadonlyArray<{
    readonly locale: Locale;
    readonly publicPath: string;
  }>;
}

const INITIAL_CURSOR: string | null = null;
const API_PAGE_SIZE_MIN = 1;
const API_PAGE_SIZE_MAX = 100;
const supportedApiLocales = locales.join(", ");

/** Error copy derived from every canonical locale accepted by the content API. */
export const invalidApiLocaleMessage = `Invalid locale. Supported locales: ${supportedApiLocales}.`;

/** Expected failure while reading Convex content runtime data for API routes. */
class ApiContentRuntimeReadError extends Schema.TaggedError<ApiContentRuntimeReadError>()(
  "ApiContentRuntimeReadError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

/** Maps one signed publication failure into the public API runtime contract. */
function mapPublishedContentError(cause: unknown) {
  return new ApiContentRuntimeReadError({
    cause,
    message: "Unable to read signed content for the public API.",
  });
}

/** Rejects a response when ownership changed between runtime reads. */
const verifyApiReleasePin = Effect.fn("api.content.verifyReleasePin")(
  function* (expectedActiveReleaseId: string) {
    const active = yield* readApiRuntimeQuery(
      api.contentRelease.runtime.active.read,
      {}
    );
    const activeReleaseId = active?.releaseId ?? null;
    if (activeReleaseId !== expectedActiveReleaseId) {
      return yield* new ApiContentRuntimeReadError({
        cause: {
          actualReleaseId: activeReleaseId,
          expectedReleaseId: expectedActiveReleaseId,
        },
        message: "Content ownership changed during the public API read.",
      });
    }
  }
);

/** Validates and narrows a locale segment from an API route. */
export function parseApiLocale(locale: string): Locale | null {
  if (isApiLocale(locale)) {
    return locale;
  }

  return null;
}

/** Checks whether an API path locale is one of the repo-owned locale values. */
function isApiLocale(locale: string): locale is Locale {
  return locales.some((supportedLocale) => supportedLocale === locale);
}

/** Parses API pagination params without allowing unbounded list responses. */
export function parseApiPageParams(searchParams: URLSearchParams) {
  const cursor = searchParams.get("cursor") || INITIAL_CURSOR;
  const rawLimit = searchParams.get("limit");

  if (!rawLimit) {
    return {
      cursor,
      limit: API_PAGE_SIZE_MAX,
    };
  }

  const limit = Number.parseInt(rawLimit, 10);

  if (
    !Number.isInteger(limit) ||
    limit < API_PAGE_SIZE_MIN ||
    limit > API_PAGE_SIZE_MAX
  ) {
    return null;
  }

  return {
    cursor,
    limit,
  };
}

/** Parses a graph-backed content ID accepted by partner graph lookup routes. */
export function parseApiContentId(contentId: string) {
  const parsed = Schema.decodeUnknownOption(NakafaAgentContentIdSchema)(
    contentId
  );

  return Option.getOrNull(parsed);
}

/** Reads one page of article content rows from Convex. */
export function getArticleApiContentPage(args: ArticleApiPageArgs) {
  return hydratePublishedApiPage(
    readApiRuntimeQuery(api.contentRelease.article.apiPage, args),
    "article"
  );
}

/** Reads one page of material content rows from Convex. */
export function getMaterialApiContentPage(args: MaterialApiPageArgs) {
  return hydratePublishedApiPage(
    readApiRuntimeQuery(api.contentRelease.material.apiPage, args),
    "material"
  );
}

/** Hydrates one signed partner page and proves its release stayed active. */
const hydratePublishedApiPage = Effect.fn("api.content.hydratePublishedPage")(
  function* (
    readPage: Effect.Effect<PublishedApiPage, ApiContentRuntimeReadError>,
    family: "article" | "material"
  ) {
    const result = yield* readPage;
    const page = yield* Effect.forEach(
      result.page,
      (entry) =>
        readPublishedApiItem({
          activeReleaseId: result.activeReleaseId,
          family,
          locale: entry.locale,
          publicPath: entry.publicPath,
        }).pipe(Effect.mapError(mapPublishedContentError)),
      { concurrency: 4 }
    );
    yield* verifyApiReleasePin(result.activeReleaseId);
    return {
      continueCursor: result.continueCursor,
      isDone: result.isDone,
      page,
    };
  }
);

/** Reads one current signed reference by stable graph content ID. */
export function getApiContentReferenceByContentId(args: { contentId: string }) {
  return readApiRuntimeQuery(api.contentRelease.reference.read, {
    input: { contentId: args.contentId, kind: "content" },
  });
}

/** Reads one public Convex runtime query through the official client. */
const readApiRuntimeQuery = Effect.fn("api.content.runtimeQuery")(function* <
  Query extends FunctionReference<"query">,
>(query: Query, args: FunctionArgs<Query>) {
  return yield* readConvexRuntimeQuery(
    env.NEXT_PUBLIC_CONVEX_URL,
    query,
    args
  ).pipe(
    Effect.mapError(
      (cause) =>
        new ApiContentRuntimeReadError({
          cause,
          message: `Unable to read API content runtime query: ${cause.query}.`,
        })
    )
  );
});
