import { getCategoryIcon } from "@repo/contents/_lib/curriculum/icons";
import { getMaterialIcon } from "@repo/contents/_lib/curriculum/material";
import type { PublicCurriculumRoute } from "@repo/contents/_types/route/schema";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import { CollectionPageJsonLd } from "@repo/seo/json-ld/collection-page";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import {
  CURRICULUM_ROUTES,
  listCurriculumStaticParams,
  readCurriculumBreadcrumbs,
  readCurriculumHeaderLink,
  readCurriculumRouteModel,
  readCurriculumTocHeader,
  readMaterialCardChapters,
  resolveCurriculumRoute,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/curricula/[curriculum]/[[...path]]/data";
import { getCurriculumGradeIcon } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/curricula/icons";
import { CardMaterial } from "@/components/shared/card-material";
import { ComingSoon } from "@/components/shared/coming-soon";
import { ContainerList } from "@/components/shared/container-list";
import { FooterContent } from "@/components/shared/footer-content";
import { HeaderContent } from "@/components/shared/header-content";
import { LayoutContent } from "@/components/shared/layout-content";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterial } from "@/components/shared/material/layout";
import { LayoutMaterialToc } from "@/components/shared/material/toc";
import { RefContent } from "@/components/shared/ref-content";
import { SubjectItem, SubjectList } from "@/components/shared/subject-list";
import { getGithubUrl } from "@/lib/utils/github";
import { getOgUrl, getSocialMetadata } from "@/lib/utils/metadata";
import { createProjectedRouteAlternates } from "@/lib/utils/seo/alternates";
import { createBreadcrumbItems } from "@/lib/utils/seo/breadcrumbs";

type CurriculumPageProps =
  PageProps<"/[locale]/curricula/[curriculum]/[[...path]]">;
type CurriculumRouteBodyInput = ReturnType<typeof readCurriculumRouteModel>;

/**
 * Builds curriculum context params from curriculum-owned route projection rows.
 *
 * Curriculum paths are navigation context only; material bodies remain linked
 * through canonical material paths carried by the projection.
 */
export function generateStaticParams() {
  return listCurriculumStaticParams();
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
  const { locale, route } = await resolveCurriculumRoute(params);
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
 * Subject/course nodes render collapsible cards with direct canonical lesson
 * links; topic/unit rows remain grouping data and are not separate page hops.
 */
export default async function Page({ params }: CurriculumPageProps) {
  const routeLookup = await resolveCurriculumRoute(params);
  const { locale, route } = routeLookup;
  const tCommon = await getTranslations({ locale, namespace: "Common" });
  const body = readCurriculumRouteModel(routeLookup);
  const githubUrl = getCurriculumGithubUrl(route);

  return (
    <>
      <BreadcrumbJsonLd
        breadcrumbItems={createBreadcrumbItems(
          locale,
          readCurriculumBreadcrumbs(tCommon("home"), route)
        )}
      />
      {body.materialCards.length > 0 && (
        <CollectionPageJsonLd
          description={route.description ?? route.title}
          items={body.materialCards.flatMap((material) =>
            material.items.map((item) => ({
              name: item.title,
              url: `https://nakafa.com${item.href}`,
            }))
          )}
          name={route.title}
          url={`https://nakafa.com/${locale}/${route.publicPath}`}
        />
      )}
      <LayoutMaterial>
        <LayoutMaterialContent>
          <HeaderContent
            description={body.headerDescription}
            icon={getCurriculumRouteIcon(route)}
            link={readCurriculumHeaderLink(locale, route)}
            title={route.title}
          />
          <LayoutContent>
            <CurriculumRouteBody {...body} />
          </LayoutContent>
          <FooterContent>
            <RefContent githubUrl={githubUrl} />
          </FooterContent>
        </LayoutMaterialContent>
        {body.materialCards.length > 0 && (
          <LayoutMaterialToc
            chapters={{
              label: route.title,
              data: readMaterialCardChapters(body.materialCards),
            }}
            githubUrl={githubUrl}
            header={readCurriculumTocHeader(locale, route)}
          />
        )}
      </LayoutMaterial>
    </>
  );
}

/**
 * Renders the established curriculum navigation variants without nested modes.
 *
 * Grade-card roots reuse the old curriculum home composition. Other curriculum
 * subject/course nodes reuse the old collapsible material-card composition.
 */
function CurriculumRouteBody({
  childRoutes,
  isCurriculumRoot,
  locale,
  materialCards,
  usesGradeCards,
}: CurriculumRouteBodyInput) {
  if (materialCards.length > 0) {
    return (
      <ContainerList className="sm:grid-cols-1">
        {materialCards.map((material) => (
          <CardMaterial key={material.href} material={material} />
        ))}
      </ContainerList>
    );
  }

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

  if (childRoutes.length === 0) {
    return <ComingSoon />;
  }

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

/**
 * Selects the source file directory behind the curriculum context page.
 *
 * Reference actions should point maintainers to the source-owned curriculum
 * Module, while public pages continue to use localized projected URLs.
 */
function getCurriculumGithubUrl(route: PublicCurriculumRoute) {
  switch (route.programKey) {
    case "cambridge-igcse":
      return getGithubUrl({
        path: "/packages/contents/curriculum/cambridge/igcse",
      });
    case "id-kurikulum-merdeka":
      return getGithubUrl({
        path: "/packages/contents/curriculum/indonesia/merdeka",
      });
    default:
      return getGithubUrl({ path: "/packages/contents/curriculum" });
  }
}

/**
 * Selects the existing subject/material icon for one curriculum route row.
 *
 * The domain is carried by the contents route projection from curriculum
 * source modules. The page never infers subject identity from route strings or
 * localized display copy.
 */
function getCurriculumRouteIcon(route: PublicCurriculumRoute) {
  if (route.level === "class") {
    return getCategoryIcon("high-school");
  }

  return getMaterialIcon(route.materialDomain ?? "");
}
