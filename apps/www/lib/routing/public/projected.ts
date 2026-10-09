import { HttpClient } from "@confect/js";
import {
  APP_LOCALE_CODES,
  type AppLocale,
  AppLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import contentRelease from "@repo/backend/confect/_generated/refs/contentRelease";
import { PUBLIC_ROUTE_SURFACES } from "@repo/contents/route/surface";
import type { routing } from "@repo/internationalization/src/routing";
import { Array as Arr, Effect, Option, Schema } from "effect";
import { hasLocale } from "next-intl";
import { matchesPreviewRoute } from "@/lib/content/preview/route";
import { readPublishedProgramPath } from "@/lib/content/program/path";
import { readActiveContentRoute } from "@/lib/content/published/route";
import { httpLayer } from "@/lib/convex/http";

const ProjectedHtmlRouteInputSchema = Schema.Struct({
  hasAttemptCapability: Schema.Boolean,
  pathname: Schema.String,
});
type ProjectedHtmlRouteInput = typeof ProjectedHtmlRouteInputSchema.Type;

/** Resolves one material HTML route against a single active release snapshot. */
const readProjectedMaterialRouteRejection = Effect.fn(
  "www.routing.publicHtml.materialRejection"
)(function* (
  locale: (typeof routing.locales)[number],
  appLocale: AppLocale,
  publicPath: string
) {
  const ownership = yield* readActiveContentRoute({
    appLocale,
    family: "material",
    publicPath,
  });
  if (ownership.kind === "found") {
    return null;
  }
  return locale;
});

/**
 * Reads projected HTML routes that must return a hard 404 when absent.
 *
 * AFDocs checks fabricated URLs for soft 404s. The exact Convex lookup keeps
 * that guarantee without rebuilding the complete content projection per
 * request.
 *
 * @see https://afdocs.dev/checks/url-stability
 */
export const readProjectedHtmlRouteRejection = Effect.fn(
  "www.routing.publicHtml.projectedRejection"
)(function* ({ hasAttemptCapability, pathname }: ProjectedHtmlRouteInput) {
  const [rawLocale, namespace, ...pathSegments] = Arr.filter(
    pathname.split("/"),
    Boolean
  );
  if (!(namespace && hasLocale(APP_LOCALE_CODES, rawLocale))) {
    return null;
  }
  const locale = rawLocale;
  const surface = Arr.findFirst(
    PUBLIC_ROUTE_SURFACES,
    (item) => item.routeSlugs[locale] === namespace
  );
  if (Option.isNone(surface)) {
    return null;
  }
  if (
    pathSegments.length === 0 &&
    (surface.value.key === "curriculum" || surface.value.key === "tryout")
  ) {
    return null;
  }
  const publicPath = Arr.join([namespace, ...pathSegments], "/");
  const appLocale = AppLocaleSchema.make(locale);
  if (
    yield* matchesPreviewRoute({
      appLocale,
      publicPath,
    })
  ) {
    return null;
  }
  if (surface.value.key === "subject") {
    return yield* readProjectedMaterialRouteRejection(
      locale,
      appLocale,
      publicPath
    );
  }
  if (surface.value.key === "curriculum") {
    const ownership = yield* readPublishedProgramPath(locale, publicPath);
    if (!ownership.managed) {
      return locale;
    }
    return ownership.route?.sitemap ? null : locale;
  }
  if (
    hasAttemptCapability &&
    (pathSegments.length === 4 || pathSegments.length === 5)
  ) {
    return null;
  }
  const reference = yield* Effect.flatMap(HttpClient.HttpClient, (client) =>
    client.query(contentRelease.reference.read, {
      input: {
        appLocale,
        kind: "route",
        publicPath,
      },
    })
  ).pipe(Effect.provide(httpLayer()));
  return reference ? null : locale;
});
