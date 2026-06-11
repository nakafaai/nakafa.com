import type { api } from "@repo/backend/convex/_generated/api";
import { routing } from "@repo/internationalization/src/routing";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { Effect, Schema } from "effect";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { applyContentRuntimeCache } from "@/lib/content/cache";
import {
  getRuntimeContentRoute,
  listRuntimeLatestContentRoutes,
} from "@/lib/content/runtime";

type RuntimeContentSection = FunctionArgs<
  typeof api.contents.queries.runtime.listContentRoutesByPrefix
>["section"];
type LatestContentRoute = FunctionReturnType<
  typeof api.contents.queries.runtime.listLatestContentRoutes
>[number];

/** Expected failure raised when route metadata translations cannot be loaded. */
class TranslationLoadError extends Schema.TaggedError<TranslationLoadError>()(
  "TranslationLoadError",
  {
    locale: Schema.String,
    namespace: Schema.String,
  }
) {}

interface ParamConfig {
  basePath: RuntimeContentSection;
  isDeep?: boolean;
  paramNames: string[];
  slugParam?: string;
}

interface SystemMetadata {
  authors: { name: string }[];
  date: string;
  description?: string;
  title: string;
}

type StaticParam = Record<string, string | string[]>;

const staticParamCandidateLimit = 100;

/** Generates static params from the Convex-backed public route catalog. */
export function getStaticParams(config: ParamConfig): Promise<StaticParam[]> {
  return Effect.runPromise(getStaticParamsEffect(config));
}

/** Builds static params from route catalog paths as a native Effect program. */
function getStaticParamsEffect(config: ParamConfig) {
  return Effect.gen(function* () {
    const routes = yield* getStaticParamRoutes(config);
    const params = new Map<string, StaticParam>();

    for (const route of routes) {
      const param = routeToStaticParam(route, config);

      if (!param) {
        continue;
      }

      params.set(JSON.stringify(param), param);
    }

    return Array.from(params.values());
  }).pipe(Effect.withSpan("www.system.getStaticParams"));
}

/** Reads deliberate latest-content candidates for one static params generator. */
function getStaticParamRoutes(config: ParamConfig) {
  return Effect.gen(function* () {
    const routeGroups = yield* Effect.forEach(
      routing.locales,
      (locale) =>
        listRuntimeLatestContentRoutes({
          limit: staticParamCandidateLimit,
          locale,
          section: config.basePath,
        }),
      { concurrency: routing.locales.length }
    );
    const routes = routeGroups
      .flat()
      .map((route) => getStaticParamRoutePath(route, config));

    return new Set(routes);
  });
}

/** Selects the concrete URL path to prerender from one latest-content row. */
function getStaticParamRoutePath(
  route: LatestContentRoute,
  config: ParamConfig
) {
  if (
    config.basePath === "exercises" &&
    config.isDeep &&
    route.kind === "exercise-question" &&
    route.parentRoute
  ) {
    return `/${route.parentRoute}`;
  }

  return `/${route.route}`;
}

/** Converts one public route into a route-level static params object. */
function routeToStaticParam(route: string, config: ParamConfig) {
  const parts = route.split("/").filter(Boolean);
  const [root] = parts;

  if (root !== config.basePath) {
    return null;
  }

  const segments = parts.slice(1);
  const param: StaticParam = {};

  for (const [index, paramName] of config.paramNames.entries()) {
    if (paramName === config.slugParam && config.isDeep) {
      const slug = segments.slice(index);

      if (slug.length === 0) {
        return null;
      }

      param[paramName] = slug;
      return param;
    }

    const value = segments[index];

    if (!value) {
      return null;
    }

    param[paramName] = value;
  }

  return param;
}

/** Gets SEO metadata from the Convex route catalog with translation fallbacks. */
export function getMetadataFromSlug(
  locale: Locale,
  slug: string[]
): Effect.Effect<SystemMetadata, TranslationLoadError> {
  return Effect.gen(function* () {
    const [tCommon, tMetadata] = yield* Effect.all(
      [
        Effect.tryPromise({
          try: () => getTranslations({ locale, namespace: "Common" }),
          catch: () =>
            new TranslationLoadError({ namespace: "Common", locale }),
        }),
        Effect.tryPromise({
          try: () => getTranslations({ locale, namespace: "Metadata" }),
          catch: () =>
            new TranslationLoadError({ namespace: "Metadata", locale }),
        }),
      ],
      { concurrency: "unbounded" }
    );

    const defaultTitle = tCommon("made-with-love");
    const shortDescription = tMetadata("short-description");
    const defaultMetadata: SystemMetadata = {
      title: defaultTitle,
      description: shortDescription,
      authors: [{ name: "Nakafa" }],
      date: "",
    };

    const route = yield* getRuntimeContentRoute({
      locale,
      route: slug.join("/"),
    }).pipe(Effect.catchAll(() => Effect.succeed(null)));

    if (!route) {
      return defaultMetadata;
    }

    return {
      authors: route.authors,
      date: route.date ? new Date(route.date).toISOString() : "",
      description: route.description ?? shortDescription,
      title: route.title || defaultTitle,
    };
  });
}

/** Resolves metadata inside a Cache Components-safe helper for OG routes. */
export async function getCachedMetadataFromSlug(
  locale: Locale,
  slug: string[]
) {
  "use cache";

  applyContentRuntimeCache();

  return await Effect.runPromise(getMetadataFromSlug(locale, slug));
}
