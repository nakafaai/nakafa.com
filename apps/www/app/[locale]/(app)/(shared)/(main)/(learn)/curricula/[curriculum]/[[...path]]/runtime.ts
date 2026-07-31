import type { GitCommitShaSchema } from "@nakafa/aksara-contracts/ids";
import {
  CURRICULUM_NAMESPACES,
  isRenderableCurriculumLevel,
  type CurriculumRoute as PublishedCurriculumRoute,
} from "@nakafa/aksara-contracts/program/curriculum";
import type { LearningProgram as PublishedLearningProgram } from "@nakafa/aksara-contracts/program/spec";
import type { MaterialList } from "@repo/contents/_types/curriculum/material";
import { findLearningProgramByKey } from "@repo/contents/_types/program/catalog";
import { readCurriculumAncestors } from "@repo/contents/_types/route/curriculum";
import {
  readCurriculumMaterialCards,
  readCurriculumMaterialPaths,
} from "@repo/contents/_types/route/curriculum/card";
import { InvalidPublicRouteSourceError } from "@repo/contents/_types/route/error";
import type { PublicCurriculumRoute } from "@repo/contents/_types/route/schema";
import { Either } from "effect";
import { identity } from "effect/Function";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import {
  groupCurriculumChildren,
  listCurriculumStaticParams as listSourceStaticParams,
  readCurriculumRoutes,
  readMaterialRoutes as readSourceMaterialRoutes,
  readCurriculumRootRoutes as readSourceRootRoutes,
  readCurriculumRouteModel as readSourceRouteModel,
  resolveCurriculumRoute as resolveSourceRoute,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/curricula/[curriculum]/[[...path]]/data";
import { getPublishedMaterialShell } from "@/lib/content/material/route";
import { expandMaterialCandidates } from "@/lib/content/material/shell";
import {
  readMaterialSourceCandidates,
  reconcileMaterialCurriculumRoutes,
  reconcileMaterialSourceRoutes,
} from "@/lib/content/material/source";
import { getPublishedMaterialCards } from "@/lib/content/program/cards";
import {
  getPublishedProgramCatalog,
  getPublishedProgramRoutes,
} from "@/lib/content/program/catalog";
import { getPublishedProgramRoute } from "@/lib/content/program/route";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { isSamePublicRouteIdentity } from "@/lib/routing/locale/identity";
import { selectLearningStaticParams } from "@/lib/routing/prerender";

type CurriculumParams =
  PageProps<"/[locale]/curricula/[curriculum]/[[...path]]">["params"];
type CurriculumStaticParam = Omit<Awaited<CurriculumParams>, "locale">;
type SourceLearningProgram = NonNullable<
  ReturnType<typeof findLearningProgramByKey>
>;

/** Route shape accepted by the shared curriculum presentation. */
export type CurriculumViewRoute =
  | PublicCurriculumRoute
  | PublishedCurriculumRoute;

/** Program shape accepted by the shared curriculum presentation. */
export type CurriculumViewProgram =
  | PublishedLearningProgram
  | SourceLearningProgram;

/** One root curriculum card and its source-owned program metadata. */
export interface CurriculumCatalogEntry {
  readonly program: CurriculumViewProgram;
  readonly route: CurriculumViewRoute;
}

/** Exclusive published or source catalog selected for one locale. */
export interface CurriculumCatalogModel {
  readonly entries: readonly CurriculumCatalogEntry[];
  readonly managed: boolean;
  readonly sourceRevision: null | typeof GitCommitShaSchema.Type;
}

/** Complete presentation data for one exclusive curriculum route owner. */
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
  readonly managed: boolean;
  readonly materialCards: MaterialList;
  readonly program: CurriculumViewProgram;
  readonly route: CurriculumViewRoute;
  readonly sourcePath: string;
  readonly sourceRevision: null | typeof GitCommitShaSchema.Type;
}

/** Checks whether one projected route owns a learner-renderable page. */
export function isRenderableCurriculumView(route: CurriculumViewRoute) {
  return isRenderableCurriculumLevel(route.level) && route.sitemap;
}

/**
 * Requires one source-owned program during static route projection.
 *
 * The source registry is already decoded at module load, so this lookup stays
 * synchronous instead of starting Effect's fiber runtime during static
 * prerender. A missing registry row is an integrity failure and remains a
 * visible typed server error rather than becoming a false 404.
 *
 * @see https://nextjs.org/docs/messages/next-prerender-current-time
 */
export function requireSourceCurriculumProgram(programKey: string) {
  const program = findLearningProgramByKey(programKey);
  if (program) {
    return program;
  }

  throw new InvalidPublicRouteSourceError({
    message: `Missing source program ${programKey}.`,
  });
}

/** Lists a bounded static-param subset from the exclusive route owner. */
export async function listRuntimeCurriculumStaticParams(rawLocale: string) {
  const locale = getLocaleOrThrow(rawLocale);
  const catalog = await getPublishedProgramRoutes(locale);
  if (!catalog.managed) {
    return listSourceStaticParams(locale);
  }
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

/** Resolves one route through its exclusive published or source owner. */
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
  if (published.managed) {
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
      managed: true,
      materialCards,
      program,
      route,
      sourcePath: route.sourcePath,
      sourceRevision: published.sourceRevision,
    };
  }
  const source = await resolveSourceRoute(Promise.resolve(resolved));
  const sourceModel = readSourceRouteModel(source);
  const program = requireSourceCurriculumProgram(source.route.programKey);
  const sourceRoutes = readCurriculumRoutes();
  let materialCards = sourceModel.materialCards;
  const contentRoutes = readSourceMaterialRoutes();
  const candidates = readMaterialSourceCandidates(
    readCurriculumMaterialPaths(source.route, sourceRoutes),
    locale,
    contentRoutes
  );
  if (candidates.length > 0) {
    let model = await getPublishedMaterialShell(
      locale,
      candidates,
      published.activeReleaseId
    );
    const expandedCandidates = expandMaterialCandidates(
      candidates,
      model.claims.flatMap((claim) =>
        claim.kind === "found" ? [claim.projection] : []
      )
    );
    if (expandedCandidates !== candidates) {
      model = await getPublishedMaterialShell(
        locale,
        expandedCandidates,
        published.activeReleaseId
      );
    }
    const reconciled = Either.getOrThrowWith(
      reconcileMaterialSourceRoutes(locale, contentRoutes, model),
      identity
    );
    const curriculumRoutes = Either.getOrThrowWith(
      reconcileMaterialCurriculumRoutes(
        locale,
        sourceRoutes,
        contentRoutes,
        reconciled,
        model
      ),
      identity
    );
    materialCards = readCurriculumMaterialCards({
      contentRoutes: reconciled,
      curriculumRoutes,
      route: source.route,
    });
  }
  return {
    alternates: sourceRoutes.filter((candidate) =>
      isSamePublicRouteIdentity(source.route, candidate)
    ),
    ancestors: readCurriculumAncestors(source.route, sourceRoutes).filter(
      isRenderableCurriculumView
    ),
    childGroups: sourceModel.childGroups,
    childRoutes: sourceModel.childRoutes,
    locale,
    managed: false,
    materialCards,
    program,
    route: source.route,
    sourcePath: `packages/contents/curriculum/${source.route.programKey}`,
    sourceRevision: null,
  };
}

/** Reads root curriculum cards from the exclusive published or source owner. */
export async function readRuntimeCurriculumCatalog(
  locale: Locale
): Promise<CurriculumCatalogModel> {
  const published = await getPublishedProgramCatalog(locale);
  if (published.managed) {
    return {
      entries: published.entries.filter(({ route }) =>
        isRenderableCurriculumView(route)
      ),
      managed: true,
      sourceRevision: published.sourceRevision,
    };
  }
  const entries = readSourceRootRoutes(locale).map((route) => ({
    program: requireSourceCurriculumProgram(route.programKey),
    route,
  }));
  return { entries, managed: false, sourceRevision: null };
}

/** Builds localized selector options from one exclusive catalog. */
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
