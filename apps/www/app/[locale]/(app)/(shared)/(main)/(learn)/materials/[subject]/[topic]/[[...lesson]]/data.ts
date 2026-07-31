import {
  isMaterialLessonRoute,
  readParentMaterialRoute,
} from "@repo/contents/_types/route/content";
import { readNamespaceSegment } from "@repo/contents/_types/route/path";
import type { PublicContentRoute } from "@repo/contents/_types/route/schema";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getPublishedMaterialRoutes } from "@/lib/content/material/catalog";
import {
  readMaterialRoutes,
  readMaterialSource,
} from "@/lib/content/material/shell";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { selectLearningStaticParams } from "@/lib/routing/prerender";

export type MaterialParams =
  PageProps<"/[locale]/materials/[subject]/[topic]/[[...lesson]]">["params"];
export type MaterialRouteParams = Awaited<MaterialParams>;

/** Parses one localized OG slug into concrete material lesson params. */
export function parseMaterialParams(
  locale: Locale,
  slug: readonly string[]
): MaterialRouteParams | null {
  const namespace = readNamespaceSegment("subject", locale);
  if (!namespace || slug[0] !== namespace || slug.length < 4) {
    return null;
  }
  const [, subject, topic, ...lesson] = slug;
  if (!(subject && topic && lesson.length > 0)) {
    return null;
  }
  return { lesson, locale, subject, topic };
}

/** Builds the exact localized path without consulting either content owner. */
export async function readMaterialRequest(params: MaterialParams) {
  const { locale: rawLocale, subject, topic, lesson } = await params;
  const locale = getLocaleOrThrow(rawLocale);
  const namespace = readNamespaceSegment("subject", locale);

  if (!namespace) {
    return { locale, publicPath: undefined };
  }

  const publicPath = [namespace, subject, topic, ...(lesson ?? [])].join("/");

  return { locale, publicPath };
}

/**
 * Resolves localized material params through the contents route projection.
 *
 * The projection owns localized slugs, duplicate checks, and source paths. This
 * route Module only matches the framework params to one decoded row.
 */
export async function readMaterialRoute(params: MaterialParams) {
  const { locale, publicPath } = await readMaterialRequest(params);
  if (!publicPath) {
    return { locale, route: undefined };
  }

  const { route } = readMaterialSource(locale, publicPath);

  return {
    locale,
    route,
  };
}

/**
 * Resolves one public material lesson route or enters the not-found boundary.
 *
 * Topic rows stay projected for card grouping and parent links, but they are
 * not standalone public pages.
 */
export async function resolveMaterialRoute(params: MaterialParams) {
  const { locale, route } = await readMaterialRoute(params);

  if (!(route && isMaterialLessonRoute(route))) {
    notFound();
  }

  return { locale, route };
}

/**
 * Builds static params only for concrete material lesson body rows.
 *
 * Topic rows stay in the projection for internal curriculum grouping
 * cards and lesson pagination. They are not standalone public page hops.
 */
export async function listMaterialStaticParams(rawLocale?: string) {
  const locale = rawLocale ? getLocaleOrThrow(rawLocale) : undefined;
  if (locale) {
    const published = await getPublishedMaterialRoutes(locale);
    if (published.managed) {
      const params = published.routes.map((route) => {
        const [, subject, topic, ...lesson] = route.publicPath.split("/");
        return { lesson, subject, topic };
      });
      return selectLearningStaticParams(params);
    }
  }

  const params = readMaterialRoutes().flatMap((route) => {
    if (locale && route.locale !== locale) {
      return [];
    }
    if (!isMaterialLessonRoute(route)) {
      return [];
    }

    const [, subject, topic, ...lesson] = route.publicPath.split("/");
    return [{ subject, topic, lesson }];
  });

  return selectLearningStaticParams(params);
}

/**
 * Returns the topic route that owns one lesson route.
 *
 * Missing parents are treated like invalid generated route state and mapped to
 * the route-not-found boundary.
 */
export function requireParentMaterialRoute(route: PublicContentRoute) {
  const parent = readParentMaterialRoute(route, readMaterialRoutes());

  if (parent?.kind !== "subject-topic") {
    notFound();
  }

  return parent;
}
