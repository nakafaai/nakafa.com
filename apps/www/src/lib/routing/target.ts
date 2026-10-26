import { CURRICULUM_NAMESPACES } from "@nakafa/aksara-contracts/program/curriculum";
import { PATHNAMES } from "@repo/internationalization/src/pathnames";
import { SITE_ORIGIN } from "@repo/seo/origin";

import { Array as Arr, Option, Record as Rec } from "effect";
import type { LinkTarget } from "@/lib/routing/link";
import { LOCALE_ROUTE } from "@/lib/routing/tree";

/**
 * The typed target of one signed Page, which the locale's catch-all page route
 * serves by its public path. The path is the route's splat, and the locale is
 * the one of the page on screen.
 */
function pageTarget(publicPath: string) {
  return {
    from: LOCALE_ROUTE,
    params: { _splat: publicPath },
    to: "/$locale/$",
  } satisfies LinkTarget;
}

/** The typed target of one article, from the category and slug that the catalog verified. */
function articleTarget({
  category,
  slug,
}: {
  readonly category: string;
  readonly slug: string;
}) {
  return {
    from: LOCALE_ROUTE,
    params: { category, slug },
    to: "/$locale/articles/$category/$slug",
  } satisfies LinkTarget;
}

/**
 * The typed target of one curriculum program or of a page inside it. The first
 * public segment after the curriculum namespace names the program, and the rest
 * is the page's splat, which is empty for the program's own page.
 */
export function curriculumTarget({
  curriculum,
  path,
}: {
  readonly curriculum: string;
  readonly path: readonly string[];
}) {
  return {
    from: LOCALE_ROUTE,
    params: { _splat: Arr.join(path, "/"), curriculum },
    to: "/$locale/curricula/$curriculum/$",
  } satisfies LinkTarget;
}

/** The typed target of one article category's page, which the route names by its route slug. */
export function articleCategoryTarget(route: string) {
  return {
    from: LOCALE_ROUTE,
    params: { category: route },
    to: "/$locale/articles/$category",
  } satisfies LinkTarget;
}

/** The locale's landing page, the one a visitor reaches from the app's own links. */
export const LANDING_TARGET = {
  from: LOCALE_ROUTE,
  to: "/$locale",
} satisfies LinkTarget;

/** The home page of the signed-in account, which the app's breadcrumbs start from. */
export const HOME_TARGET = {
  from: LOCALE_ROUTE,
  to: "/$locale/home",
} satisfies LinkTarget;

/** The search page of the app. */
export const SEARCH_TARGET = {
  from: LOCALE_ROUTE,
  to: "/$locale/search",
} satisfies LinkTarget;

/** The try-out catalog, the first page of every try-out path. */
export const TRYOUT_TARGET = {
  from: LOCALE_ROUTE,
  to: "/$locale/try-out",
} satisfies LinkTarget;

/** The Quran index, which the Quran breadcrumb starts from. */
export const QURAN_TARGET = {
  from: LOCALE_ROUTE,
  to: "/$locale/quran",
} satisfies LinkTarget;

/** The curriculum index, which the subject breadcrumb starts from. */
export const CURRICULA_TARGET = {
  from: LOCALE_ROUTE,
  to: "/$locale/curricula",
} satisfies LinkTarget;

/** The namespaces of the curriculum in every locale, which the route map spells. */
const CURRICULUM_NAMESPACE_LIST: readonly string[] = Rec.values(
  CURRICULUM_NAMESPACES
);

/** Whether a public path's first segment is the curriculum namespace of a locale. */
function isCurriculumNamespace(namespace: string | undefined): boolean {
  return Option.exists(Option.fromNullishOr(namespace), (value) =>
    Arr.contains(CURRICULUM_NAMESPACE_LIST, value)
  );
}

/** Whether a public path's first segment is the materials namespace of a locale. */
function isMaterialNamespace(namespace: string | undefined): boolean {
  return Option.exists(Option.fromNullishOr(namespace), (value) =>
    Arr.contains(MATERIAL_NAMESPACES, value)
  );
}

/** The spelling of the materials namespace in every locale, which the route map owns. */
const MATERIAL_NAMESPACES: readonly string[] = Arr.flatMap(
  Rec.values(PATHNAMES["/materials/[subject]/[topic]/[[...lesson]]"]),
  (template) => Option.toArray(Option.fromNullishOr(template.split("/")[1]))
);

/** The article index, which the article breadcrumb starts from. */
export const ARTICLES_TARGET = {
  from: LOCALE_ROUTE,
  to: "/$locale/articles",
} satisfies LinkTarget;

/**
 * The typed target of one curriculum public path, such as `curriculum/merdeka`
 * or `curriculum/merdeka/class-11/mathematics`. The first segment is the
 * curriculum namespace of a locale, the second the program, and the rest the
 * page inside it. A path outside the curriculum namespace has no target.
 */
export function curriculumPublicPathTarget(
  publicPath: string
): Option.Option<LinkTarget> {
  const [namespace, curriculum, ...path] = publicPath.split("/");
  if (!isCurriculumNamespace(namespace)) {
    return Option.none();
  }
  if (!curriculum) {
    return Option.some(CURRICULA_TARGET);
  }
  return Option.some(curriculumTarget({ curriculum, path }));
}

/**
 * The typed target of one material public path, such as
 * `subjects/mathematics/algebra/lesson`. The first segment is the materials
 * namespace of a locale, the second the subject, the third the topic, and the rest
 * the lesson, which the catch-all route takes as its splat. The optional context
 * hint rides in the search of the route. A path outside the namespace has no target.
 */
function materialPublicPathTarget(
  publicPath: string,
  context?: string
): Option.Option<LinkTarget> {
  const [, subject, topic, ...lesson] = publicPath.split("/");
  if (!(subject && topic)) {
    return Option.none();
  }
  const search = context === undefined ? {} : { ctx: context };
  return Option.some({
    from: LOCALE_ROUTE,
    params: { _splat: Arr.join(lesson, "/"), subject, topic },
    search,
    to: "/$locale/materials/$subject/$topic/$",
  } satisfies LinkTarget);
}

/**
 * The typed target of any signed public path of the content: an article, a
 * curriculum page, a material, a Quran surah, or a signed Page, which the Page
 * route serves as its catch-all. The empty path and a malformed article, Quran
 * or curriculum shape name no page, so they have no target. A material takes
 * the context hint of its curriculum, and the other paths ignore it.
 */
export function publicPathTarget(
  publicPath: string,
  context?: string
): Option.Option<LinkTarget> {
  if (publicPath === "") {
    return Option.none();
  }
  const [namespace, first, second, ...rest] = publicPath.split("/");
  if (namespace === "articles") {
    if (!first) {
      return Option.some(ARTICLES_TARGET);
    }
    if (second === undefined) {
      return Option.some(articleCategoryTarget(first));
    }
    return rest.length === 0 && second
      ? Option.some(articleTarget({ category: first, slug: second }))
      : Option.none();
  }
  if (namespace === "quran") {
    if (!first) {
      return Option.some(QURAN_TARGET);
    }
    return second === undefined
      ? Option.some({
          from: LOCALE_ROUTE,
          params: { surah: first },
          to: "/$locale/quran/$surah",
        } satisfies LinkTarget)
      : Option.none();
  }
  if (isCurriculumNamespace(namespace)) {
    return curriculumPublicPathTarget(publicPath);
  }
  if (isMaterialNamespace(namespace)) {
    return materialPublicPathTarget(publicPath, context);
  }
  return Option.some(pageTarget(publicPath));
}

/**
 * The typed target of an app address that a backend query returns, such as
 * `/subjects/mathematics/algebra/functions?ctx=...`: the signed public path in the
 * locale the query read, with no locale segment, and the material context hint in
 * its query. The link keeps the locale of the page on screen. An address that
 * names no page has no target.
 */
export function addressTarget(address: string): Option.Option<LinkTarget> {
  const url = new URL(address, SITE_ORIGIN);
  const context = url.searchParams.get("ctx") ?? undefined;
  return publicPathTarget(url.pathname.slice(1), context);
}

/** The typed target of one Quran surah, which the Quran route names by its number. */
export function quranSurahTarget(surah: number) {
  return {
    from: LOCALE_ROUTE,
    params: { surah: String(surah) },
    to: "/$locale/quran/$surah",
  } satisfies LinkTarget;
}

/** The pricing page of the locale, which the footer and the marketing pages link to. */
export const PRICING_TARGET = {
  from: LOCALE_ROUTE,
  to: "/$locale/pricing",
} satisfies LinkTarget;
