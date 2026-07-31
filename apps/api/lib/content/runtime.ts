import { fetchConvexRuntimeQuery } from "@repo/backend/client/runtime";
import { api } from "@repo/backend/convex/_generated/api";
import { NakafaAgentContentIdSchema } from "@repo/contents/_lib/agent/schema/ref";
import type { Locale } from "@repo/utilities/locales";
import { locales } from "@repo/utilities/locales";
import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "convex/server";
import { Effect, Option, Schema } from "effect";
import { env } from "@/env";
import {
  readPublishedMaterialApiItem,
  readPublishedMaterialGraphRoute,
} from "@/lib/content/material";

type RuntimeContentRoutePage = FunctionReturnType<
  typeof api.contents.queries.runtime.listContentRoutesByPrefix
>;
type RuntimeContentSection = FunctionArgs<
  typeof api.contents.queries.runtime.listContentRoutesByPrefix
>["section"];
type ArticleApiPageArgs = FunctionArgs<
  typeof api.contents.queries.runtime.listArticleApiContentPage
>;
type MaterialApiPageArgs = FunctionArgs<
  typeof api.contentRelease.material.apiPage
>;
type MaterialApiRouteArgs = FunctionArgs<
  typeof api.contentRelease.material.apiRoute
>;
type QuranSurahPageArgs = FunctionArgs<
  typeof api.contents.queries.runtime.getQuranSurahPage
>;
type ContentRouteByContentIdArgs = FunctionArgs<
  typeof api.contents.queries.runtime.getContentRouteByContentId
>;

const PAGE_SIZE = 100;
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

/** Maps one signed material failure into the public API runtime contract. */
function mapPublishedMaterialError(cause: unknown) {
  return new ApiContentRuntimeReadError({
    cause,
    message: "Unable to read signed material content for the public API.",
  });
}

/** Rejects a source fallback when ownership changed between runtime reads. */
const verifyApiReleasePin = Effect.fn("api.content.verifyReleasePin")(
  function* (expectedActiveReleaseId: string | null) {
    const active = yield* fetchApiRuntimeQuery(
      "activeContentRelease",
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
  return fetchApiRuntimeQuery(
    "listArticleApiContentPage",
    api.contents.queries.runtime.listArticleApiContentPage,
    args
  );
}

/** Reads one page of material content rows from Convex. */
export function getMaterialApiContentPage(args: MaterialApiPageArgs) {
  return fetchApiRuntimeQuery(
    "materialApiPage",
    api.contentRelease.material.apiPage,
    args
  ).pipe(
    Effect.flatMap((result) =>
      Effect.forEach(
        result.page,
        (entry) => {
          if (entry.kind === "source") {
            return Effect.succeed(entry.item);
          }
          if (result.activeReleaseId === null) {
            return Effect.fail(
              new ApiContentRuntimeReadError({
                cause: "missing active release",
                message: "Published material API entry has no active release.",
              })
            );
          }
          return readPublishedMaterialApiItem({
            activeReleaseId: result.activeReleaseId,
            locale: entry.locale,
            publicPath: entry.publicPath,
          }).pipe(Effect.mapError(mapPublishedMaterialError));
        },
        { concurrency: 4 }
      ).pipe(
        Effect.map((page) => ({
          continueCursor: result.continueCursor,
          isDone: result.isDone,
          page,
        }))
      )
    )
  );
}

/** Reads one ownership-aware route by stable graph content ID. */
export function getApiContentRouteByContentId(
  args: ContentRouteByContentIdArgs
) {
  const materialInput: MaterialApiRouteArgs = {
    input: { contentId: args.contentId, kind: "content" },
  };
  return fetchApiRuntimeQuery(
    "materialApiRoute",
    api.contentRelease.material.apiRoute,
    materialInput
  ).pipe(
    Effect.flatMap((material) => {
      if (!material.managed) {
        return Effect.gen(function* () {
          const route = yield* fetchApiRuntimeQuery(
            "getContentRouteByContentId",
            api.contents.queries.runtime.getContentRouteByContentId,
            args
          );
          yield* verifyApiReleasePin(material.activeReleaseId);
          return route;
        });
      }
      if (!material.route) {
        return Effect.succeed(null);
      }
      if (material.activeReleaseId === null || material.syncedAt === null) {
        return Effect.fail(
          new ApiContentRuntimeReadError({
            cause: "incomplete exact material identity",
            message: "Published material graph route is incomplete.",
          })
        );
      }
      return readPublishedMaterialGraphRoute({
        activeReleaseId: material.activeReleaseId,
        locale: material.route.locale,
        publicPath: material.route.publicPath,
        syncedAt: material.syncedAt,
      }).pipe(Effect.mapError(mapPublishedMaterialError));
    })
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

/** Lists one bounded static API params page for one synced content section. */
export async function listApiStaticParams({
  prefix,
  section,
}: {
  prefix: string;
  section: RuntimeContentSection;
}) {
  const params: Array<{ locale: Locale; slug: string[] }> = [];
  const localePages = await Effect.runPromise(
    Effect.forEach(
      locales,
      (locale) =>
        getContentRoutePage({ locale, prefix, section }).pipe(
          Effect.map((routePage) => ({ locale, routePage }))
        ),
      { concurrency: "unbounded" }
    )
  );

  for (const { locale, routePage } of localePages) {
    for (const route of routePage.page) {
      params.push({
        locale,
        slug: route.route.slice(prefix.length).split("/").filter(Boolean),
      });
    }
  }

  return params;
}

/** Reads one bounded route page matching a locale, section, and prefix. */
function getContentRoutePage({
  locale,
  prefix,
  section,
}: {
  locale: Locale;
  prefix: string;
  section: RuntimeContentSection;
}): Effect.Effect<RuntimeContentRoutePage, ApiContentRuntimeReadError> {
  return fetchApiRuntimeQuery(
    "listContentRoutesByPrefix",
    api.contents.queries.runtime.listContentRoutesByPrefix,
    {
      cursor: INITIAL_CURSOR,
      limit: PAGE_SIZE,
      locale,
      prefix,
      section,
    }
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
