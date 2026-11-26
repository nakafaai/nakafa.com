import { Menu02Icon } from "@hugeicons/core-free-icons";
import { makeBreadcrumbNodes } from "@repo/seo/jsonld/node";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { CurriculumCardGrid } from "@/components/curriculum/cards";
import { CurriculumHeader } from "@/components/curriculum/header";
import { ContainerList } from "@/components/shared/card/list";
import { CardMaterial } from "@/components/shared/card/material";
import { SidebarTree } from "@/components/shared/outline/tree";
import { PageBody } from "@/components/shared/page/body";
import { CatalogPage, Page } from "@/components/shared/page/frame";
import {
  PageOutline,
  PageOutlineFooter,
  PageOutlineHeader,
  PageOutlineProvider,
} from "@/components/shared/page/outline";
import { ComingSoon } from "@/components/shared/upcoming";
import { GithubButton } from "@/components/sidebar/actions/github";
import { ReportButton } from "@/components/sidebar/actions/report";
import { ShareButton } from "@/components/sidebar/actions/share";
import { PanelSheetTrigger } from "@/components/sidebar/sheet";
import { PUBLIC_CONTENT_HEADERS } from "@/lib/content/delivery";
import { readCurriculumRoute } from "@/lib/curriculum/node.functions";
import { createSeoHead, toRouterHead } from "@/lib/seo/head";
import { readStaticData } from "@/lib/static/data";

/** One curriculum node: a track chooser, a nested node or a material list. */
export const Route = createFileRoute("/$locale/_main/curricula/$curriculum/$")({
  loader: async ({ params }) => {
    const page = await readStaticData(readCurriculumRoute, {
      curriculum: params.curriculum,
      locale: params.locale,
      path: Arr.filter(
        (params._splat ?? "").split("/"),
        (segment) => segment !== ""
      ),
    });
    if (page.kind === "notFound") {
      throw notFound();
    }
    return page;
  },
  head: ({ loaderData }) => {
    if (loaderData === undefined) {
      return {};
    }
    const {
      alternates,
      breadcrumbs,
      canonicalPath,
      description,
      image,
      locale,
      title,
    } = loaderData;
    return toRouterHead(
      createSeoHead({
        alternates,
        canonicalPath,
        description,
        image,
        indexable: true,
        jsonLd: makeBreadcrumbNodes(breadcrumbs),
        kind: "curriculum",
        locale,
        parts: [title],
        type: "website",
      })
    );
  },
  headers: ({ loaderData }) =>
    loaderData === undefined ? undefined : PUBLIC_CONTENT_HEADERS,
  component: CurriculumRoutePage,
});

function CurriculumRoutePage() {
  const page = Route.useLoaderData();
  if (page.materialCards.length > 0) {
    return <CurriculumMaterialsPage />;
  }
  if (page.childCards.length > 0) {
    return <CurriculumCatalogPage />;
  }
  return <CurriculumEmptyPage />;
}

/** A curriculum node that lists materials with its reading outline at the right edge. */
function CurriculumMaterialsPage() {
  const page = Route.useLoaderData();
  const { labels, route } = page;
  return (
    <PageOutlineProvider>
      <Page>
        <CurriculumHeader
          action={<CurriculumOutlineToggle />}
          homeLabel={labels.home}
          options={page.options}
          subjectLabel={labels.subject}
          title={route.title}
          trail={page.trail}
        />
        <PageBody>
          <ContainerList className="pt-6 sm:grid-cols-1">
            {Arr.map(page.materialCards, (material) => (
              <CardMaterial
                key={material.link.publicPath}
                material={material}
              />
            ))}
          </ContainerList>
        </PageBody>
      </Page>
      <PageOutline
        footer={
          <PageOutlineFooter>
            <ReportButton />
            {page.sourceUrl ? (
              <GithubButton githubUrl={page.sourceUrl} />
            ) : null}
            <ShareButton />
          </PageOutlineFooter>
        }
        header={<PageOutlineHeader {...page.toc} />}
      >
        <SidebarTree data={page.chapters} title={route.title} />
      </PageOutline>
    </PageOutlineProvider>
  );
}

/** A curriculum catalog node: its child tracks or grades in the wider 4xl catalog frame. */
function CurriculumCatalogPage() {
  const page = Route.useLoaderData();
  const { labels, route } = page;
  return (
    <CatalogPage>
      <CurriculumHeader
        homeLabel={labels.home}
        options={page.options}
        subjectLabel={labels.subject}
        title={route.title}
        trail={page.trail}
      />
      <PageBody>
        <CurriculumCardGrid
          actionLabel={labels.routeAction}
          cards={page.childCards}
        />
      </PageBody>
    </CatalogPage>
  );
}

/** A curriculum node with neither materials nor child cards yet. */
function CurriculumEmptyPage() {
  const page = Route.useLoaderData();
  const { labels, route } = page;
  return (
    <Page>
      <CurriculumHeader
        homeLabel={labels.home}
        options={page.options}
        subjectLabel={labels.subject}
        title={route.title}
        trail={page.trail}
      />
      <PageBody>
        <ComingSoon />
      </PageBody>
    </Page>
  );
}

/** Opens the page's outline from its header. */
function CurriculumOutlineToggle() {
  const t = useTranslations("Common");

  return <PanelSheetTrigger icon={Menu02Icon} label={t("on-this-page")} />;
}
