import { Menu02Icon } from "@hugeicons/core-free-icons";
import { makeBreadcrumbNodes } from "@repo/seo/jsonld/node";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { CurriculumCardGrid } from "@/components/curriculum/cards";
import { CurriculumNestedHeader } from "@/components/curriculum/header";
import { CurriculumSelector } from "@/components/curriculum/selector";
import { BreadcrumbHeader } from "@/components/shared/breadcrumb/header";
import { ContainerList } from "@/components/shared/card/list";
import { CardMaterial } from "@/components/shared/card/material";
import { RefContent } from "@/components/shared/content/references";
import { SidebarTree } from "@/components/shared/outline/tree";
import { PageBody } from "@/components/shared/page/body";
import { PageFooter } from "@/components/shared/page/footer";
import { Page } from "@/components/shared/page/frame";
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
import { HOME_TARGET } from "@/lib/routing/target";
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
  const { labels, route } = page;
  const hasOutline = page.materialCards.length > 0;
  return (
    <CurriculumOutline enabled={hasOutline}>
      <Page>
        {route.level === "track" ? (
          <BreadcrumbHeader
            value={{
              action: (
                <CurriculumSelector
                  currentValue={route.publicPath}
                  label={labels.selector}
                  options={page.options}
                />
              ),
              home: HOME_TARGET,
              homeLabel: labels.home,
              items: [{ label: labels.subject }],
              title: route.title,
            }}
          />
        ) : (
          <CurriculumNestedHeader
            ancestors={page.ancestors}
            currentRoute={route}
            homeLabel={labels.home}
            subjectLabel={labels.subject}
          >
            {hasOutline ? <CurriculumOutlineToggle /> : null}
          </CurriculumNestedHeader>
        )}
        <PageBody>
          {page.materialCards.length > 0 ? (
            <ContainerList className="pt-6 sm:grid-cols-1">
              {Arr.map(page.materialCards, (material) => (
                <CardMaterial
                  key={material.link.publicPath}
                  material={material}
                />
              ))}
            </ContainerList>
          ) : null}
          {page.materialCards.length === 0 && page.childCards.length === 0 ? (
            <ComingSoon />
          ) : null}
          {page.materialCards.length === 0 && page.childCards.length > 0 ? (
            <CurriculumCardGrid
              actionLabel={labels.routeAction}
              cards={page.childCards}
            />
          ) : null}
        </PageBody>
        {page.sourceUrl ? (
          <PageFooter>
            <RefContent githubUrl={page.sourceUrl} />
          </PageFooter>
        ) : null}
      </Page>
      {hasOutline ? (
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
      ) : null}
    </CurriculumOutline>
  );
}

/** The state of the page's outline, for a page that lists materials. Any other page has no outline to hold. */
function CurriculumOutline({
  children,
  enabled,
}: {
  children: ReactNode;
  enabled: boolean;
}) {
  return enabled ? (
    <PageOutlineProvider>{children}</PageOutlineProvider>
  ) : (
    children
  );
}

/** Opens the page's outline from its header. */
function CurriculumOutlineToggle() {
  const t = useTranslations("Common");

  return <PanelSheetTrigger icon={Menu02Icon} label={t("on-this-page")} />;
}
