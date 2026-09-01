import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { type ReactNode, Suspense } from "react";
import { readMaterialCardChapters } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/curricula/[curriculum]/[[...path]]/data";
import { readCurriculumRouteIcon } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/curricula/[curriculum]/[[...path]]/icons";
import {
  CurriculumChildCards,
  CurriculumNestedHeader,
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
import { getCurriculumRouteSocialImage } from "@/lib/curriculum/artwork";
import { createResolvedRouteAlternates } from "@/lib/seo/alternates";
import { createBreadcrumbItems } from "@/lib/seo/breadcrumbs";
import { getCachedSEOMetadata } from "@/lib/seo/cache";
import { getAksaraTreeUrl } from "@/lib/utils/github";
import { getSocialMetadata } from "@/lib/utils/metadata";

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
  const { locale, program, route } = model;
  const seo = await getCachedSEOMetadata(
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
      image: getCurriculumRouteSocialImage(locale, program.key, route),
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

/** Resolves the URL-specific route before choosing its named composition. */
async function CurriculumRouteContent({
  params,
}: Pick<CurriculumPageProps, "params">) {
  const model = await resolveRuntimeCurriculumRoute(params);

  if (model.route.level === "track") {
    return <CurriculumTrackRoute model={model} />;
  }

  return <CurriculumNestedRoute model={model} />;
}

/** Renders the curriculum chooser with its catalog-owned selector. */
async function CurriculumTrackRoute({
  model,
}: {
  model: CurriculumRouteModel;
}) {
  const { locale, route } = model;
  const [catalog, tCommon, tLearningPrograms] = await Promise.all([
    readRuntimeCurriculumCatalog(locale),
    getTranslations({ locale, namespace: "Common" }),
    getTranslations({ locale, namespace: "LearningPrograms" }),
  ]);
  const homeLabel = tCommon("home");
  const breadcrumbs = readRuntimeCurriculumBreadcrumbs(
    homeLabel,
    tCommon("subject"),
    model
  );

  return (
    <CurriculumRouteFrame
      actionLabel={tLearningPrograms("curriculum-route-action")}
      breadcrumbs={breadcrumbs}
      model={model}
    >
      <CurriculumRootHeader
        currentRoute={route}
        homeLabel={homeLabel}
        options={readRuntimeCurriculumOptions(catalog, locale)}
        selectorLabel={tLearningPrograms("kind.school-curriculum")}
        subjectLabel={tCommon("subject")}
      />
    </CurriculumRouteFrame>
  );
}

/** Renders one nested curriculum node with its established route header. */
async function CurriculumNestedRoute({
  model,
}: {
  model: CurriculumRouteModel;
}) {
  const { locale, route } = model;
  const [tCommon, tLearningPrograms] = await Promise.all([
    getTranslations({ locale, namespace: "Common" }),
    getTranslations({ locale, namespace: "LearningPrograms" }),
  ]);
  const homeLabel = tCommon("home");
  const subjectLabel = tCommon("subject");
  const breadcrumbs = readRuntimeCurriculumBreadcrumbs(
    homeLabel,
    subjectLabel,
    model
  );

  return (
    <CurriculumRouteFrame
      actionLabel={tLearningPrograms("curriculum-route-action")}
      breadcrumbs={breadcrumbs}
      model={model}
    >
      {model.childRoutes.length > 0 ? (
        <CurriculumNestedHeader
          ancestors={model.ancestors}
          currentRoute={route}
          homeLabel={homeLabel}
          locale={locale}
          menuLabel={tCommon("navigate")}
          openMenuLabel={tCommon("navigate")}
          subjectLabel={subjectLabel}
        />
      ) : (
        <HeaderContent
          icon={readCurriculumRouteIcon(route)}
          link={readRuntimeCurriculumHeader(model)}
          title={route.title}
        />
      )}
    </CurriculumRouteFrame>
  );
}

/** Composes the shared curriculum body around one explicit route header. */
function CurriculumRouteFrame({
  actionLabel,
  breadcrumbs,
  children,
  model,
}: {
  actionLabel: string;
  breadcrumbs: ReturnType<typeof readRuntimeCurriculumBreadcrumbs>;
  children: ReactNode;
  model: CurriculumRouteModel;
}) {
  const { locale, route } = model;

  const sourceUrl = readCurriculumSourceUrl(model);

  return (
    <>
      <BreadcrumbJsonLd
        breadcrumbItems={createBreadcrumbItems(locale, breadcrumbs)}
      />
      <LayoutMaterialContent>
        {children}
        <LayoutContent>
          <CurriculumRouteBody actionLabel={actionLabel} model={model} />
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
  actionLabel,
  model,
}: {
  actionLabel: string;
  model: CurriculumRouteModel;
}) {
  const { childRoutes, locale, materialCards } = model;
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

  return (
    <CurriculumChildCards
      actionLabel={actionLabel}
      locale={locale}
      routes={childRoutes}
    />
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
