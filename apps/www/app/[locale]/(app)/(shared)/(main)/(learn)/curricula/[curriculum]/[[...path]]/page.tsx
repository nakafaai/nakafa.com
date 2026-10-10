import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import { Array as Arr, Effect } from "effect";
import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { getTranslations } from "next-intl/server";
import { type ReactNode, Suspense } from "react";
import { readMaterialCardChapters } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/curricula/[curriculum]/[[...path]]/data";
import { CurriculumChildCards } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/curricula/[curriculum]/[[...path]]/root";
import { CurriculumSelector } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/curricula/[curriculum]/[[...path]]/selector";
import { readCurriculumSeoContext } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/curricula/[curriculum]/[[...path]]/seo";
import { BreadcrumbHeader } from "@/components/shared/breadcrumb/header";
import { ContainerList } from "@/components/shared/card/list";
import { CardMaterial } from "@/components/shared/card/material";
import { FooterContent } from "@/components/shared/content/footer";
import { LayoutContent } from "@/components/shared/content/layout";
import { RefContent } from "@/components/shared/content/references";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterial } from "@/components/shared/material/layout";
import {
  SidebarRight,
  SidebarRightFooter,
  SidebarRightHeader,
} from "@/components/shared/outline/panel";
import { SidebarTree } from "@/components/shared/outline/tree";
import { ComingSoon } from "@/components/shared/upcoming";
import { GithubButton } from "@/components/sidebar/actions/github";
import { ReportButton } from "@/components/sidebar/actions/report";
import { ShareButton } from "@/components/sidebar/actions/share";
import { readPublishedProgramPrerenderRoute } from "@/lib/content/program/catalog";
import { getAksaraTreeUrl } from "@/lib/content/repository";
import { getCurriculumRouteSocialImage } from "@/lib/curriculum/artwork";
import {
  type CurriculumRouteModel,
  readRuntimeCurriculumBreadcrumbs,
  readRuntimeCurriculumCatalog,
  readRuntimeCurriculumOptions,
  readRuntimeCurriculumToc,
  resolveRuntimeCurriculumRoute,
} from "@/lib/curriculum/model";
import { getLocaleOrThrow, type LocaleRouteParams } from "@/lib/i18n/params";
import { createResolvedRouteAlternates } from "@/lib/seo/alternates";
import { createBreadcrumbItems } from "@/lib/seo/breadcrumbs";
import { getCachedSEOMetadata } from "@/lib/seo/cache";
import { getSocialMetadata } from "@/lib/seo/social";

type CurriculumPageProps =
  PageProps<"/[locale]/curricula/[curriculum]/[[...path]]">;

const CurriculumNestedHeader = dynamic(
  () =>
    import(
      "@/app/[locale]/(app)/(shared)/(main)/(learn)/curricula/[curriculum]/[[...path]]/nested/header"
    )
);

/**
 * Supplies one real curriculum root per locale for Cache Components.
 *
 * Curriculum paths are navigation context only; material bodies remain linked
 * through canonical material paths carried by the projection.
 */
export async function generateStaticParams({
  params,
}: {
  params: LocaleRouteParams;
}) {
  const locale = getLocaleOrThrow(params.locale);
  const route = await Effect.runPromise(
    readPublishedProgramPrerenderRoute(locale)
  );
  const [, curriculum, ...path] = route.publicPath.split("/");
  return [{ curriculum, path }];
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
    <CurriculumRouteFrame breadcrumbs={breadcrumbs} model={model}>
      <BreadcrumbHeader
        value={{
          action: (
            <CurriculumSelector
              currentValue={route.publicPath}
              label={tLearningPrograms("kind.school-curriculum")}
              options={readRuntimeCurriculumOptions(catalog, locale)}
            />
          ),
          homeLabel,
          items: [{ label: tCommon("subject") }],
          menuLabel: tCommon("more"),
          title: route.title,
        }}
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
  const tCommon = await getTranslations({ locale, namespace: "Common" });
  const homeLabel = tCommon("home");
  const subjectLabel = tCommon("subject");
  const breadcrumbs = readRuntimeCurriculumBreadcrumbs(
    homeLabel,
    subjectLabel,
    model
  );

  return (
    <CurriculumRouteFrame breadcrumbs={breadcrumbs} model={model}>
      <CurriculumNestedHeader
        ancestors={model.ancestors}
        currentRoute={route}
        homeLabel={homeLabel}
        locale={locale}
        menuLabel={tCommon("more")}
        subjectLabel={subjectLabel}
      />
    </CurriculumRouteFrame>
  );
}

/** Composes the shared curriculum body around one explicit route header. */
function CurriculumRouteFrame({
  breadcrumbs,
  children,
  model,
}: {
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
          <CurriculumRouteBody model={model} />
        </LayoutContent>
        {sourceUrl ? (
          <FooterContent>
            <RefContent githubUrl={sourceUrl} />
          </FooterContent>
        ) : null}
      </LayoutMaterialContent>
      {model.materialCards.length > 0 && (
        <SidebarRight
          footer={
            <SidebarRightFooter>
              <ReportButton />
              {sourceUrl ? <GithubButton githubUrl={sourceUrl} /> : null}
              <ShareButton />
            </SidebarRightFooter>
          }
          header={<SidebarRightHeader {...readRuntimeCurriculumToc(model)} />}
        >
          <SidebarTree
            data={readMaterialCardChapters(model.materialCards)}
            title={route.title}
          />
        </SidebarRight>
      )}
    </>
  );
}

/** Renders the established curriculum chooser or material-card composition. */
async function CurriculumRouteBody({ model }: { model: CurriculumRouteModel }) {
  const { childRoutes, locale, materialCards } = model;
  if (materialCards.length > 0) {
    return (
      <ContainerList className="pt-6 sm:grid-cols-1">
        {Arr.map(materialCards, (material) => (
          <CardMaterial key={material.href} material={material} />
        ))}
      </ContainerList>
    );
  }

  if (childRoutes.length === 0) {
    return <ComingSoon />;
  }

  const tLearningPrograms = await getTranslations({
    locale,
    namespace: "LearningPrograms",
  });

  return (
    <CurriculumChildCards
      actionLabel={tLearningPrograms("curriculum-route-action")}
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
