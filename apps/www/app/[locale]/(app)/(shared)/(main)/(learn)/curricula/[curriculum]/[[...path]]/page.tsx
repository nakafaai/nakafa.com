import type { PublicCurriculumRoute } from "@repo/contents/_types/route/schema";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import {
  listCurriculumStaticParams,
  readCurriculumBreadcrumbs,
  readCurriculumHeaderLink,
  readCurriculumRootOptions,
  readCurriculumRouteModel,
  readCurriculumRoutes,
  readCurriculumTocHeader,
  readMaterialCardChapters,
  resolveCurriculumRoute,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/curricula/[curriculum]/[[...path]]/data";
import { readCurriculumRouteIcon } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/curricula/[curriculum]/[[...path]]/icons";
import {
  CurriculumRootCards,
  CurriculumRootHeader,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/curricula/[curriculum]/[[...path]]/root";
import { readCurriculumSeoContext } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/curricula/[curriculum]/[[...path]]/seo";
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
import { SubjectItem } from "@/components/shared/subject-item";
import { SubjectList } from "@/components/shared/subject-list";
import { getGithubUrl } from "@/lib/utils/github";
import { getOgUrl, getSocialMetadata } from "@/lib/utils/metadata";
import { createProjectedRouteAlternates } from "@/lib/utils/seo/alternates";
import { createBreadcrumbItems } from "@/lib/utils/seo/breadcrumbs";
import { generateSEOMetadata } from "@/lib/utils/seo/generator";

type CurriculumPageProps =
  PageProps<"/[locale]/curricula/[curriculum]/[[...path]]">;
type CurriculumRouteBodyInput = ReturnType<typeof readCurriculumRouteModel>;

/**
 * Builds curriculum context params from curriculum-owned route projection rows.
 *
 * Curriculum paths are navigation context only; material bodies remain linked
 * through canonical material paths carried by the projection.
 */
export function generateStaticParams({
  params,
}: {
  params: { locale: string };
}) {
  return listCurriculumStaticParams(params.locale);
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
  const seo = await generateSEOMetadata(
    readCurriculumSeoContext(route),
    locale
  );

  return {
    title: { absolute: seo.title },
    description: seo.description,
    alternates: createProjectedRouteAlternates(route, readCurriculumRoutes()),
    ...getSocialMetadata({
      title: seo.title,
      description: seo.description,
      locale,
      path: `/${locale}/${route.publicPath}`,
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
  const breadcrumbs = readCurriculumBreadcrumbs(tCommon("home"), route);
  const selectorLabel =
    route.level === "track"
      ? (await getTranslations({ locale, namespace: "LearningPrograms" }))(
          "kind.school-curriculum"
        )
      : "";
  const body = readCurriculumRouteModel(routeLookup);
  const githubUrl = getCurriculumGithubUrl(route);

  return (
    <>
      <BreadcrumbJsonLd
        breadcrumbItems={createBreadcrumbItems(locale, breadcrumbs)}
      />
      <LayoutMaterial>
        <LayoutMaterialContent>
          {route.level === "track" ? (
            <CurriculumRootHeader
              currentRoute={route}
              homeLabel={tCommon("home")}
              options={readCurriculumRootOptions(locale)}
              selectorLabel={selectorLabel}
              subjectLabel={tCommon("subject")}
            />
          ) : (
            <HeaderContent
              icon={readCurriculumRouteIcon(route)}
              link={readCurriculumHeaderLink(locale, route)}
              title={route.title}
            />
          )}
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
 * Renders curriculum context pages through established route-level composition.
 *
 * Root rows render direct curriculum choice cards. Lower chooser rows reuse
 * `SubjectList`, and subject/course nodes keep the established collapsible
 * material-card composition with direct canonical lesson links.
 */
function CurriculumRouteBody({
  childGroups,
  childRoutes,
  locale,
  materialCards,
  route,
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

  if (childRoutes.length === 0) {
    return <ComingSoon />;
  }

  if (route.level === "track") {
    return <CurriculumRootCards locale={locale} routes={childRoutes} />;
  }

  return (
    <div className="flex flex-col gap-8">
      {childGroups.map((group) => (
        <section className="flex flex-col gap-3" key={group.key}>
          {group.title && (
            <h2 className="font-medium text-muted-foreground text-sm">
              {group.title}
            </h2>
          )}
          <SubjectList>
            {group.children.map((child) => (
              <SubjectItem
                href={`/${locale}/${child.publicPath}`}
                icon={readCurriculumRouteIcon(child)}
                key={child.publicPath}
                label={child.title}
              />
            ))}
          </SubjectList>
        </section>
      ))}
    </div>
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
    case "cambridge-international":
      return getGithubUrl({
        path: "/packages/contents/curriculum/cambridge-international",
      });
    case "merdeka":
      return getGithubUrl({
        path: "/packages/contents/curriculum/merdeka",
      });
    case "singapore-moe":
      return getGithubUrl({
        path: "/packages/contents/curriculum/singapore-moe",
      });
    case "united-states":
      return getGithubUrl({
        path: "/packages/contents/curriculum/united-states",
      });
    default:
      return getGithubUrl({ path: "/packages/contents/curriculum" });
  }
}
