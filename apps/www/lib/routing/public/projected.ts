import {
  APP_LOCALE_CODES,
  type AppLocale,
  AppLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import { api } from "@repo/backend/convex/_generated/api";
import { PUBLIC_ROUTE_SURFACES } from "@repo/contents/_types/route/surface";
import type { routing } from "@repo/internationalization/src/routing";
import { Effect } from "effect";
import { hasLocale } from "next-intl";
import { matchesPreviewRoute } from "@/lib/content/preview/route";
import { readPublishedProgramPath } from "@/lib/content/program/path";
import { readActiveContentIdentity } from "@/lib/content/published/active";
import { readActiveContentRoute } from "@/lib/content/published/route";
import { readRuntimeQuery } from "@/lib/content/runtime/query";

interface ProjectedHtmlRouteInput {
  readonly hasAttemptCapability: boolean;
  readonly pathname: string;
}

/** Resolves one material HTML route against a single active release snapshot. */
const readProjectedMaterialRouteRejection = Effect.fn(
  "www.routing.publicHtml.materialRejection"
)(function* (
  locale: (typeof routing.locales)[number],
  appLocale: AppLocale,
  publicPath: string
) {
  const identity = yield* readActiveContentIdentity();
  const activeReleaseId = identity?.releaseId ?? null;
  const ownership = yield* readActiveContentRoute({
    activeReleaseId,
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
  const [rawLocale, namespace, ...pathSegments] = pathname
    .split("/")
    .filter(Boolean);

  if (!(namespace && hasLocale(APP_LOCALE_CODES, rawLocale))) {
    return null;
  }

  const locale = rawLocale;

  const surface = PUBLIC_ROUTE_SURFACES.find(
    (item) => item.routeSlugs[locale] === namespace
  );

  if (!surface) {
    return null;
  }

  if (
    pathSegments.length === 0 &&
    (surface.key === "curriculum" || surface.key === "tryout")
  ) {
    return null;
  }

  const publicPath = [namespace, ...pathSegments].join("/");
  const appLocale = AppLocaleSchema.make(locale);
  if (yield* matchesPreviewRoute({ appLocale, publicPath })) {
    return null;
  }

  if (surface.key === "subject") {
    return yield* readProjectedMaterialRouteRejection(
      locale,
      appLocale,
      publicPath
    );
  }
  if (surface.key === "curriculum") {
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
  const reference = yield* readRuntimeQuery(api.contentRelease.reference.read, {
    input: {
      appLocale,
      kind: "route",
      publicPath,
    },
  });
  return reference ? null : locale;
});
