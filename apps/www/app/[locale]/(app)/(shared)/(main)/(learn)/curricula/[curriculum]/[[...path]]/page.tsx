import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { readMaterialCardChapters } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/curricula/[curriculum]/[[...path]]/data";
import { readCurriculumRouteIcon } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/curricula/[curriculum]/[[...path]]/icons";
import {
  CurriculumRootCards,
  CurriculumRootHeader,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/curricula/[curriculum]/[[...path]]/root";
import {
  type CurriculumRouteModel,
  listRuntimeCurriculumStaticParams,
  readRuntimeCurriculumBreadcrumbs,
  readRuntimeCurriculumCatalog,
  readRuntimeCurriculumHeader,
  readRuntimeCurriculumOptions,
  readRuntimeCurriculumToc,
  resolveRuntimeCurriculumRoute,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/curricula/[curriculum]/[[...path]]/runtime";
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
import { getAksaraTreeUrl } from "@/lib/utils/github";
import { getOgUrl, getSocialMetadata } from "@/lib/utils/metadata";
import { createResolvedRouteAlternates } from "@/lib/utils/seo/alternates";
import { createBreadcrumbItems } from "@/lib/utils/seo/breadcrumbs";
import { generateSEOMetadata } from "@/lib/utils/seo/generator";

type CurriculumPageProps =
  PageProps<"/[locale]/curricula/[curriculum]/[[...path]]">;

/**
 * Builds a bounded prerender subset from the exclusive curriculum owner.
 *
 * Curriculum paths are navigation context only; material bodies remain linked
 * through canonical material paths carried by the projection.
 */
export async function generateStaticParams({
  params,
}: {
  params: { locale: string };
}) {
  return listRuntimeCurriculumStaticParams(params.locale);
}

/** Generates metadata from the exclusive published or source route owner. */
export async function generateMetadata({
  params,
}: CurriculumPageProps): Promise<Metadata> {
  const model = await resolveRuntimeCurriculumRoute(params);
  const { locale, route } = model;
  const seo = await generateSEOMetadata(
    readCurriculumSeoContext(route, model.ancestors),
    locale
  );

  return {
    title: { absolute: seo.title },
    description: seo.description,
    alternates: createResolvedRouteAlternates(route, model.alternates),
    ...getSocialMetadata({
      title: seo.title,
      description: seo.description,
      locale,
      path: `/${locale}/${route.publicPath}`,
      image: getOgUrl(locale, route.publicPath),
    }),
  };
}

/** Renders one curriculum navigation node from its exclusive route owner. */
export default function Page({ params }: CurriculumPageProps) {
  return (
    <LayoutMaterial>
      <Suspense fallback={null}>
        <CurriculumRouteContent params={params} />
      </Suspense>
    </LayoutMaterial>
  );
}

/** Resolves and renders the URL-specific curriculum node inside its boundary. */
async function CurriculumRouteContent({
  params,
}: Pick<CurriculumPageProps, "params">) {
  const model = await resolveRuntimeCurriculumRoute(params);
  const { locale, route } = model;
  const [catalog, tCommon] = await Promise.all([
    readRuntimeCurriculumCatalog(locale),
    getTranslations({ locale, namespace: "Common" }),
  ]);
  const breadcrumbs = readRuntimeCurriculumBreadcrumbs(tCommon("home"), model);
  const selectorLabel =
    route.level === "track"
      ? (await getTranslations({ locale, namespace: "LearningPrograms" }))(
          "kind.school-curriculum"
        )
      : "";
  const sourceUrl = readCurriculumSourceUrl(model);

  return (
    <>
      <BreadcrumbJsonLd
        breadcrumbItems={createBreadcrumbItems(locale, breadcrumbs)}
      />
      <LayoutMaterialContent>
        {route.level === "track" ? (
          <CurriculumRootHeader
            currentRoute={route}
            homeLabel={tCommon("home")}
            options={readRuntimeCurriculumOptions(catalog, locale)}
            selectorLabel={selectorLabel}
            subjectLabel={tCommon("subject")}
          />
        ) : (
          <HeaderContent
            icon={readCurriculumRouteIcon(route)}
            link={readRuntimeCurriculumHeader(model)}
            title={route.title}
          />
        )}
        <LayoutContent>
          <CurriculumRouteBody {...model} />
        </LayoutContent>
        {sourceUrl ? (
          <FooterContent>
            <RefContent githubUrl={sourceUrl} />
          </FooterContent>
        ) : null}
      </LayoutMaterialContent>
      {model.materialCards.length > 0 && (
        <LayoutMaterialToc
          chapters={{
            label: route.title,
            data: readMaterialCardChapters(model.materialCards),
          }}
          githubUrl={sourceUrl}
          header={readRuntimeCurriculumToc(model)}
        />
      )}
    </>
  );
}

/** Renders the established curriculum chooser or material-card composition. */
function CurriculumRouteBody({
  childGroups,
  childRoutes,
  locale,
  materialCards,
  program,
  route,
}: CurriculumRouteModel) {
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
      <CurriculumRootCards
        entries={childRoutes.map((child) => ({
          program,
          route: child,
        }))}
        locale={locale}
      />
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

/** Resolves one immutable Aksara source directory from the signed projection. */
function readCurriculumSourceUrl(model: CurriculumRouteModel) {
  return model.sourceRevision
    ? getAksaraTreeUrl({
        path: model.sourcePath,
        revision: model.sourceRevision,
      })
    : undefined;
}
