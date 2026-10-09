import { GitCommitShaSchema } from "@nakafa/aksara-contracts/ids";
import {
  CURRICULUM_NAMESPACES,
  CurriculumRouteSchema,
  isRenderableCurriculumLevel,
  type CurriculumRoute as PublishedCurriculumRoute,
} from "@nakafa/aksara-contracts/program/curriculum";
import {
  LearningProgramSchema,
  ProgramTranslationSchema,
} from "@nakafa/aksara-contracts/program/spec";
import { Array as Arr, Option, Schema } from "effect";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getPublishedMaterialCards } from "@/lib/content/program/cards";
import { getPublishedProgramCatalog } from "@/lib/content/program/catalog";
import { getPublishedProgramRoute } from "@/lib/content/program/route";
import { getCurriculumIndexHref } from "@/lib/curriculum/routes";
import { getLocaleOrThrow } from "@/lib/i18n/params";

type CurriculumParams =
  PageProps<"/[locale]/curricula/[curriculum]/[[...path]]">["params"];

/** Route shape consumed by the shared curriculum presentation. */
export type CurriculumViewRoute = PublishedCurriculumRoute;

/** One root curriculum card and its signed program metadata. */
const CurriculumCatalogEntrySchema = Schema.Struct({
  program: LearningProgramSchema,
  route: CurriculumRouteSchema,
  translation: ProgramTranslationSchema,
});
export type CurriculumCatalogEntry = typeof CurriculumCatalogEntrySchema.Type;

/** Complete signed curriculum catalog selected for one locale. */
const CurriculumCatalogModelSchema = Schema.Struct({
  entries: Schema.Array(CurriculumCatalogEntrySchema),
  sourceRevision: Schema.NullOr(GitCommitShaSchema),
});
export type CurriculumCatalogModel = typeof CurriculumCatalogModelSchema.Type;

/**
 * Complete presentation data for one signed curriculum route.
 *
 * The material cards come from a list schema owned by the contents package, so
 * the model takes the resolver's inferred return type.
 */
export type CurriculumRouteModel = Awaited<
  ReturnType<typeof resolveRuntimeCurriculumRoute>
>;

/** Checks whether one signed route owns a learner-renderable page. */
export function isRenderableCurriculumView(route: CurriculumViewRoute) {
  return isRenderableCurriculumLevel(route.level) && route.sitemap;
}

/** Resolves one route through the signed Aksara owner. */
export async function resolveRuntimeCurriculumRoute(params: CurriculumParams) {
  const resolved = await params;
  const locale = getLocaleOrThrow(resolved.locale);
  const publicPath = Arr.join(
    [
      CURRICULUM_NAMESPACES[locale],
      resolved.curriculum,
      ...(resolved.path ?? []),
    ],
    "/"
  );
  const published = await getPublishedProgramRoute(locale, publicPath);
  const { program, route } = published;
  if (!(program && route && isRenderableCurriculumView(route))) {
    notFound();
  }

  const childRoutes = Arr.filter(
    published.children,
    isRenderableCurriculumView
  );
  const materialCards = await getPublishedMaterialCards({
    contexts: published.contexts,
    groups: published.groups,
    locale,
    materials: published.materials,
    route,
  });
  return {
    alternates: Arr.filter(published.alternates, isRenderableCurriculumView),
    ancestors: Arr.filter(published.ancestors, isRenderableCurriculumView),
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
    entries: Arr.filter(published.entries, ({ route }) =>
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
  return Arr.map(catalog.entries, ({ program, route, translation }) => ({
    ...(program.provider.homeCountry === undefined
      ? {}
      : { countryCode: program.provider.homeCountry }),
    href: `/${locale}/${route.publicPath}`,
    programKey: route.programKey,
    publicSlug: translation.publicSlug,
    title: route.title,
    value: route.publicPath,
  }));
}

/** Builds visible and structured breadcrumb entries from resolved ancestors. */
export function readRuntimeCurriculumBreadcrumbs(
  homeLabel: string,
  subjectLabel: string,
  model: CurriculumRouteModel
) {
  return [
    { name: homeLabel, path: "" },
    {
      name: subjectLabel,
      path: getCurriculumIndexHref(model.locale),
    },
    ...Arr.map(model.ancestors, (ancestor) => ({
      name: ancestor.title,
      path: `/${ancestor.publicPath}`,
    })),
    { name: model.route.title, path: `/${model.route.publicPath}` },
  ];
}

/** Builds the right-sidebar header from one resolved curriculum route. */
export function readRuntimeCurriculumToc(model: CurriculumRouteModel) {
  const parent = Arr.last(model.ancestors);
  return {
    ...(Option.isSome(parent) ? { description: parent.value.title } : {}),
    href: `/${model.locale}/${model.route.publicPath}`,
    title: model.route.title,
  };
}
