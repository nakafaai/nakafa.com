import { getMaterialIcon } from "@repo/contents/_lib/curriculum/material";
import { listPublicCurriculumRoutesEffect } from "@repo/contents/_types/route/projection";
import type { PublicCurriculumRoute } from "@repo/contents/_types/route/schema";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { Effect } from "effect";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurriculumGradeIcon } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/curricula/icons";
import { HeaderContent } from "@/components/shared/header-content";
import { LayoutContent } from "@/components/shared/layout-content";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterial } from "@/components/shared/material/layout";
import { SubjectItem, SubjectList } from "@/components/shared/subject-list";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { getOgUrl, getSocialMetadata } from "@/lib/utils/metadata";
import { createProjectedRouteAlternates } from "@/lib/utils/seo/alternates";

type CurriculumPageProps =
  PageProps<"/[locale]/curricula/[curriculum]/[[...path]]">;
type CurriculumRouteLookup = Awaited<ReturnType<typeof getCurriculumRoute>>;
type CurriculumRouteBodyInput = ReturnType<typeof readCurriculumRouteBodyInput>;

const CURRICULUM_ROUTES = Effect.runSync(listPublicCurriculumRoutesEffect());

/**
 * Builds curriculum context params from curriculum-owned route projection rows.
 *
 * Curriculum paths are navigation context only; material bodies remain linked
 * through canonical material paths carried by the projection.
 */
export function generateStaticParams() {
  return CURRICULUM_ROUTES.map((route) => {
    const [, curriculum, ...path] = route.publicPath.split("/");

    return path.length > 0 ? { curriculum, path } : { curriculum };
  });
}

/**
 * Generates metadata for one curriculum context node.
 *
 * Alternates come from matching projected curriculum rows so locale changes do
 * not imply a different curriculum or country identity.
 */
export async function generateMetadata({
  params,
}: CurriculumPageProps): Promise<Metadata> {
  const { locale, route } = await getCurriculumRoute(params);
  const path = `/${locale}/${route.publicPath}`;
  const description = route.description ?? route.title;

  return {
    title: { absolute: route.title },
    description,
    alternates: createProjectedRouteAlternates(route, CURRICULUM_ROUTES),
    ...getSocialMetadata({
      title: route.title,
      description,
      locale,
      path,
      image: getOgUrl(locale, route.publicPath),
    }),
  };
}

/**
 * Renders a curriculum navigation node and its projected child routes.
 *
 * Leaf curriculum nodes link to canonical material pages when the projection
 * exposes `canonicalPath`; they do not duplicate material body content.
 */
export default async function Page({ params }: CurriculumPageProps) {
  const routeLookup = await getCurriculumRoute(params);
  const { locale, route } = routeLookup;
  const childRoutes = CURRICULUM_ROUTES.filter(
    (child) => child.locale === locale && child.parentPath === route.publicPath
  );
  const body = readCurriculumRouteBodyInput(routeLookup, childRoutes);

  return (
    <LayoutMaterial>
      <LayoutMaterialContent>
        <HeaderContent
          description={route.description}
          icon={getCurriculumRouteIcon(route)}
          title={route.title}
        />
        <LayoutContent>
          <CurriculumRouteBody {...body} />
        </LayoutContent>
      </LayoutMaterialContent>
    </LayoutMaterial>
  );
}

/**
 * Computes the render model for one curriculum node from projected rows.
 *
 * The model is derived from `getCurriculumRoute` and route projection output so
 * the page does not introduce a second manual curriculum route contract.
 */
function readCurriculumRouteBodyInput(
  routeLookup: CurriculumRouteLookup,
  childRoutes: readonly PublicCurriculumRoute[]
) {
  const isCurriculumRoot = routeLookup.route.level === "track";

  return {
    childRoutes,
    isCurriculumRoot,
    locale: routeLookup.locale,
    route: routeLookup.route,
    usesGradeCards: isCurriculumRoot && hasGradeCardRows(childRoutes),
  };
}

/**
 * Renders the established curriculum navigation variants without nested modes.
 *
 * Grade-card roots reuse the old curriculum home composition. Other curriculum
 * nodes reuse the subject-list composition and link material leaves to their
 * canonical material pages when a projected canonical path exists.
 */
function CurriculumRouteBody({
  childRoutes,
  isCurriculumRoot,
  locale,
  route,
  usesGradeCards,
}: CurriculumRouteBodyInput) {
  if (usesGradeCards) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-6">
        {childRoutes.map((child) => {
          const IconComponent = getCurriculumGradeIcon(child.nodeKey);

          if (!IconComponent) {
            return null;
          }

          return (
            <NavigationLink
              className="group flex flex-col items-center gap-2"
              href={`/${locale}/${child.publicPath}`}
              key={child.publicPath}
              prefetch
            >
              <div className="flex aspect-[1/0.95] w-full items-center justify-center rounded-xl bg-muted/50 transition-all ease-out group-hover:bg-muted">
                <IconComponent />
              </div>
              <h2 className="text-center">{child.title}</h2>
            </NavigationLink>
          );
        })}
      </div>
    );
  }

  if (isCurriculumRoot) {
    return (
      <SubjectList>
        {childRoutes.map((child) => (
          <SubjectItem
            href={`/${locale}/${child.publicPath}`}
            icon={getCurriculumRouteIcon(child)}
            key={child.publicPath}
            label={child.title}
          />
        ))}
      </SubjectList>
    );
  }

  return (
    <SubjectList>
      {route.canonicalPath && (
        <SubjectItem
          href={`/${locale}/${route.canonicalPath}`}
          icon={getCurriculumRouteIcon(route)}
          label={route.title}
        />
      )}
      {childRoutes.map((child) => (
        <SubjectItem
          href={`/${locale}/${child.publicPath}`}
          icon={getCurriculumRouteIcon(child)}
          key={child.publicPath}
          label={child.title}
        />
      ))}
    </SubjectList>
  );
}

/**
 * Resolves localized curriculum params through schema-owned route projection.
 *
 * This enforces the locale language rule: the same curriculum key may resolve
 * in every locale that has source-owned route slugs.
 */
async function getCurriculumRoute(params: CurriculumPageProps["params"]) {
  const { locale: rawLocale, curriculum, path } = await params;
  const locale = getLocaleOrThrow(rawLocale);
  const routePath = [curriculum, ...(path ?? [])].join("/");
  const route = CURRICULUM_ROUTES.find(
    (candidate) =>
      candidate.locale === locale &&
      getPathWithoutNamespace(candidate.publicPath) === routePath
  );

  if (!route) {
    notFound();
  }

  return { locale, route };
}

/** Removes the localized route namespace from one projected public path. */
function getPathWithoutNamespace(publicPath: string) {
  return publicPath.split("/").slice(1).join("/");
}

/**
 * Selects the existing subject/material icon for one curriculum route row.
 *
 * The domain is carried by the contents route projection from curriculum
 * source modules. The page never infers subject identity from route strings or
 * localized display copy.
 */
function getCurriculumRouteIcon(route: PublicCurriculumRoute) {
  return getMaterialIcon(route.materialDomain ?? "");
}

/**
 * Checks whether the current root children are curriculum class rows.
 *
 * Class rows reuse the established grade-card visuals from the old curriculum
 * root. Other curriculum models, including Cambridge course/unit routes, keep the
 * standard subject list so route identity does not imply Indonesian grades.
 */
function hasGradeCardRows(routes: readonly PublicCurriculumRoute[]) {
  if (routes.length === 0) {
    return false;
  }

  return routes.every(
    (route) =>
      route.level === "class" && getCurriculumGradeIcon(route.nodeKey) !== null
  );
}
