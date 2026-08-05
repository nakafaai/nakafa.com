import type { GitCommitShaSchema } from "@nakafa/aksara-contracts/ids";
import {
  CURRICULUM_NAMESPACES,
  isRenderableCurriculumLevel,
  type CurriculumRoute as PublishedCurriculumRoute,
} from "@nakafa/aksara-contracts/program/curriculum";
import type { LearningProgram as PublishedLearningProgram } from "@nakafa/aksara-contracts/program/spec";
import type { MaterialList } from "@repo/contents/_types/curriculum/material";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { groupCurriculumChildren } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/curricula/[curriculum]/[[...path]]/data";
import { getPublishedMaterialCards } from "@/lib/content/program/cards";
import {
  getPublishedProgramCatalog,
  getPublishedProgramRoutes,
} from "@/lib/content/program/catalog";
import { getPublishedProgramRoute } from "@/lib/content/program/route";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { selectLearningStaticParams } from "@/lib/routing/prerender";

type CurriculumParams =
  PageProps<"/[locale]/curricula/[curriculum]/[[...path]]">["params"];
type CurriculumStaticParam = Omit<Awaited<CurriculumParams>, "locale">;

/** Route shape consumed by the shared curriculum presentation. */
export type CurriculumViewRoute = PublishedCurriculumRoute;

/** Program shape consumed by the shared curriculum presentation. */
export type CurriculumViewProgram = PublishedLearningProgram;

/** One root curriculum card and its signed program metadata. */
export interface CurriculumCatalogEntry {
  readonly program: CurriculumViewProgram;
  readonly route: CurriculumViewRoute;
}

/** Complete signed curriculum catalog selected for one locale. */
export interface CurriculumCatalogModel {
  readonly entries: readonly CurriculumCatalogEntry[];
  readonly sourceRevision: null | typeof GitCommitShaSchema.Type;
}

/** Complete presentation data for one signed curriculum route. */
export interface CurriculumRouteModel {
  readonly alternates: readonly CurriculumViewRoute[];
  readonly ancestors: readonly CurriculumViewRoute[];
  readonly childGroups: readonly {
    readonly children: readonly CurriculumViewRoute[];
    readonly key: string;
    readonly title?: string;
  }[];
  readonly childRoutes: readonly CurriculumViewRoute[];
  readonly locale: Locale;
  readonly materialCards: MaterialList;
  readonly program: CurriculumViewProgram;
  readonly route: CurriculumViewRoute;
  readonly sourcePath: string;
  readonly sourceRevision: null | typeof GitCommitShaSchema.Type;
}

/** Checks whether one signed route owns a learner-renderable page. */
export function isRenderableCurriculumView(route: CurriculumViewRoute) {
  return isRenderableCurriculumLevel(route.level) && route.sitemap;
}

/** Lists a bounded static-param subset from the signed route catalog. */
export async function listRuntimeCurriculumStaticParams(rawLocale: string) {
  const locale = getLocaleOrThrow(rawLocale);
  const catalog = await getPublishedProgramRoutes(locale);
  const params: CurriculumStaticParam[] = [];
  for (const route of catalog.routes) {
    if (!isRenderableCurriculumView(route)) {
      continue;
    }
    const [, curriculum, ...path] = route.publicPath.split("/");
    params.push(path.length > 0 ? { curriculum, path } : { curriculum });
  }
  return selectLearningStaticParams(params);
}

/** Resolves one route through the signed Aksara owner. */
export async function resolveRuntimeCurriculumRoute(
  params: CurriculumParams
): Promise<CurriculumRouteModel> {
  const resolved = await params;
  const locale = getLocaleOrThrow(resolved.locale);
  const publicPath = [
    CURRICULUM_NAMESPACES[locale],
    resolved.curriculum,
    ...(resolved.path ?? []),
  ].join("/");
  const published = await getPublishedProgramRoute(locale, publicPath);
  const { program, route } = published;
  if (!(program && route && isRenderableCurriculumView(route))) {
    notFound();
  }

  const childRoutes = published.children.filter(isRenderableCurriculumView);
  const materialCards = await getPublishedMaterialCards({
    contexts: published.contexts,
    groups: published.groups,
    locale,
    materials: published.materials,
    route,
  });
  return {
    alternates: published.alternates.filter(isRenderableCurriculumView),
    ancestors: published.ancestors.filter(isRenderableCurriculumView),
    childGroups: groupCurriculumChildren(childRoutes),
    childRoutes,
    locale,
    materialCards,
    program,
    route,
    sourcePath: route.sourcePath,
    sourceRevision: published.sourceRevision,
  };
}

/** Reads root curriculum cards from the signed Aksara catalog. */
export async function readRuntimeCurriculumCatalog(
  locale: Locale
): Promise<CurriculumCatalogModel> {
  const published = await getPublishedProgramCatalog(locale);
  return {
    entries: published.entries.filter(({ route }) =>
      isRenderableCurriculumView(route)
    ),
    sourceRevision: published.sourceRevision,
  };
}

/** Builds localized selector options from the signed catalog. */
export function readRuntimeCurriculumOptions(
  catalog: CurriculumCatalogModel,
  locale: Locale
) {
  return catalog.entries.map(({ program, route }) => ({
    countryCode: program.provider.homeCountry,
    href: `/${locale}/${route.publicPath}`,
    programKey: route.programKey,
    publicSlug: program.translations[locale].publicSlug,
    title: route.title,
    value: route.publicPath,
  }));
}

/** Builds the immediate parent link for one resolved curriculum route. */
export function readRuntimeCurriculumHeader(model: CurriculumRouteModel) {
  const parent = model.ancestors.at(-1);
  if (!parent) {
    return;
  }
  return {
    href: `/${model.locale}/${parent.publicPath}`,
    label: parent.title,
  };
}

/** Builds visible and structured breadcrumb entries from resolved ancestors. */
export function readRuntimeCurriculumBreadcrumbs(
  homeLabel: string,
  model: CurriculumRouteModel
) {
  return [
    { name: homeLabel, path: "" },
    ...model.ancestors.map((ancestor) => ({
      name: ancestor.title,
      path: `/${ancestor.publicPath}`,
    })),
    { name: model.route.title, path: `/${model.route.publicPath}` },
  ];
}

/** Builds the right-sidebar header from one resolved curriculum route. */
export function readRuntimeCurriculumToc(model: CurriculumRouteModel) {
  const parent = model.ancestors.at(-1);
  return {
    ...(parent ? { description: parent.title } : {}),
    href: `/${model.locale}/${model.route.publicPath}`,
    title: model.route.title,
  };
}
