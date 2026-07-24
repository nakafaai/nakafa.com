import { readPublicContent } from "@repo/backend/client/content/read";
import { fetchConvexRuntimeQuery } from "@repo/backend/client/runtime";
import { api } from "@repo/backend/convex/_generated/api";
import { NakafaAgentContentIdSchema } from "@repo/contents/_lib/agent/schema/ref";
import type { Locale } from "@repo/utilities/locales";
import { locales } from "@repo/utilities/locales";
import type { FunctionArgs, FunctionReference } from "convex/server";
import { Effect, Option, Schema } from "effect";
import { env } from "@/env";

type QuranSurahPageArgs = FunctionArgs<
  typeof api.contents.queries.runtime.getQuranSurahPage
>;
type ContentRouteByContentIdArgs = FunctionArgs<
  typeof api.contents.queries.runtime.getContentRouteByContentId
>;

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

/** A signed projection belongs to a different API route family. */
class ApiContentFamilyError extends Schema.TaggedError<ApiContentFamilyError>()(
  "ApiContentFamilyError",
  {
    actual: Schema.Literal("article", "subject-lesson"),
    expected: Schema.Literal("article", "subject-lesson"),
  }
) {}

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

/** Parses a graph-backed content ID accepted by partner graph lookup routes. */
export function parseApiContentId(contentId: string) {
  const parsed = Schema.decodeUnknownOption(NakafaAgentContentIdSchema)(
    contentId
  );

  return Option.getOrNull(parsed);
}

/**
 * Reads one exact signed public body and exposes no executable wire fields.
 */
export const getApiPublishedContent = Effect.fn(
  "api.content.getPublishedContent"
)(function* ({
  expected,
  locale,
  publicPath,
}: {
  expected: "article" | "subject-lesson";
  locale: Locale;
  publicPath: string;
}) {
  const found = yield* readPublicContent(
    {
      siteUrl: env.NEXT_PUBLIC_CONVEX_SITE_URL,
      token: env.CONTENT_RUNTIME_TOKEN,
    },
    { locale, publicPath }
  );
  if (found.projection.kind !== expected) {
    return yield* new ApiContentFamilyError({
      actual: found.projection.kind,
      expected,
    });
  }
  const sourceRevision =
    found.release.manifest.origin.kind === "git"
      ? found.release.manifest.origin.sha
      : null;

  return {
    artifactHash: found.artifact.artifactHash,
    projection: found.projection,
    raw: found.artifact.payload.rawMdx,
    releaseId: found.activeReleaseId,
    sourcePath: found.sourcePath,
    sourceRevision,
  };
});

/** Reads one route-catalog row by stable graph content ID. */
export function getApiContentRouteByContentId(
  args: ContentRouteByContentIdArgs
) {
  return fetchApiRuntimeQuery(
    "getContentRouteByContentId",
    api.contents.queries.runtime.getContentRouteByContentId,
    args
  );
}

/** Reads one Quran surah page from Convex for API responses. */
export function getQuranApiSurahPage(args: QuranSurahPageArgs) {
  return fetchApiRuntimeQuery(
    "getQuranSurahPage",
    api.contents.queries.runtime.getQuranSurahPage,
    args
  );
}

/** Fetches one public Convex runtime query through the official client. */
function fetchApiRuntimeQuery<Query extends FunctionReference<"query">>(
  name: string,
  query: Query,
  args: FunctionArgs<Query>
) {
  return Effect.tryPromise({
    try: () => fetchConvexRuntimeQuery(env.NEXT_PUBLIC_CONVEX_URL, query, args),
    catch: (cause) =>
      new ApiContentRuntimeReadError({
        cause,
        message: `Unable to read API content runtime query: ${name}.`,
      }),
  });
}
