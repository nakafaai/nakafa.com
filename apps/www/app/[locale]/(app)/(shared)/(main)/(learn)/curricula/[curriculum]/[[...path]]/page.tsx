import type { PublicCurriculumRoute } from "@repo/contents/_types/route/schema";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CurriculumRouteCardIcon } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/curricula/[curriculum]/[[...path]]/card-icon";
import {
  listCurriculumStaticParams,
  readCurriculumBreadcrumbs,
  readCurriculumHeaderLink,
  readCurriculumRouteModel,
  readCurriculumRoutes,
  readCurriculumTocHeader,
  readMaterialCardChapters,
  resolveCurriculumRoute,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/curricula/[curriculum]/[[...path]]/data";
import {
  readCurriculumGroupIcon,
  readCurriculumRouteIcon,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/curricula/[curriculum]/[[...path]]/icons";
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
      <LayoutMaterial>
        <LayoutMaterialContent>
          <HeaderContent
            icon={readCurriculumRouteIcon(route)}
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
 * Renders curriculum context pages through established route-level composition.
 *
 * Root rows reuse the historical subject grouped-card grid. Lower chooser
 * rows reuse `SubjectList`, and subject/course nodes keep the established
 * collapsible material-card composition with direct canonical lesson links.
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
    return (
      <div className="flex flex-col gap-12 pb-24">
        {childGroups.map((group) => (
          <section className="flex flex-col gap-6" key={group.key}>
            {group.title && (
              <div className="flex items-center gap-2">
                {group.iconKey && (
                  <HugeIcons
                    className="size-5"
                    icon={readCurriculumGroupIcon(group.iconKey)}
                  />
                )}
                <h2 className="font-medium text-lg">{group.title}</h2>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-6">
              {group.children.map((child) => (
                <NavigationLink
                  className="group flex flex-col items-center gap-2"
                  href={`/${locale}/${child.publicPath}`}
                  key={child.publicPath}
                  prefetch
                >
                  <div className="flex aspect-[1/0.95] w-full items-center justify-center rounded-xl bg-muted/50 transition-all ease-out group-hover:bg-muted">
                    <CurriculumRouteCardIcon route={child} />
                  </div>
                  <h3 className="text-center">{child.title}</h3>
                </NavigationLink>
              ))}
            </div>
          </section>
        ))}
      </div>
    );
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
