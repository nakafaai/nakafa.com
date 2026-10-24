import { LocalizedPath } from "@repo/internationalization/src/alternates";
import { loadLocaleMessages } from "@repo/internationalization/src/messages";
import { toCanonicalPath } from "@repo/internationalization/src/rewrite";
import { HOME_TARGET } from "@repo/internationalization/src/target";
import { makeBreadcrumbNodes } from "@repo/seo/json-ld/node";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Array as Arr, Effect, Option, Schema } from "effect";
import { createTranslator } from "use-intl";
import { CurriculumCardGrid } from "@/components/curriculum/cards";
import { CurriculumNestedHeader } from "@/components/curriculum/header";
import { CurriculumSelector } from "@/components/curriculum/selector";
import { BreadcrumbHeader } from "@/components/shared/breadcrumb/header";
import { ContainerList } from "@/components/shared/card/list";
import { CardMaterial } from "@/components/shared/card/material";
import { FooterContent } from "@/components/shared/content/footer";
import { LayoutContent } from "@/components/shared/content/frame";
import { RefContent } from "@/components/shared/content/references";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterial } from "@/components/shared/material/frame";
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
import {
  LEARN_SHELL_CACHE_SCOPES,
  publicContentHeaders,
  readContentCacheTags,
} from "@/lib/content/delivery";
import { getAksaraTreeUrl } from "@/lib/content/repository";
import {
  getCurriculumRouteSocialImage,
  resolveCurriculumCatalogArtwork,
} from "@/lib/curriculum/artwork";
import { readMaterialCardChapters } from "@/lib/curriculum/chapters";
import { getCurriculumLooks } from "@/lib/curriculum/look";
import {
  readRuntimeCurriculumBreadcrumbs,
  readRuntimeCurriculumCatalog,
  readRuntimeCurriculumOptions,
  readRuntimeCurriculumToc,
  resolveRuntimeCurriculumRoute,
} from "@/lib/curriculum/model";
import { readCurriculumSeoContext } from "@/lib/curriculum/seo";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { createResolvedRouteAlternates } from "@/lib/seo/alternates";
import { createBreadcrumbItems } from "@/lib/seo/breadcrumbs";
import { resolveSEOMetadata } from "@/lib/seo/generator";
import { createSeoHead, toHeadAlternates, toRouterHead } from "@/lib/seo/head";
import { serverHandler } from "@/lib/server/fn";

const CurriculumInput = Schema.Struct({
  curriculum: Schema.String,
  locale: Schema.String,
  path: Schema.Array(Schema.String),
});

/**
 * Reads one curriculum node on the server: its breadcrumbs, its cards or child
 * routes, its outline and its SEO copy. An unknown node is answered with 404 by
 * the resolver, which throws before this read returns.
 */
const readCurriculumRoute = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(CurriculumInput))
  .handler(
    serverHandler(
      Effect.fn("www.curricula.route.read")(function* (
        data: typeof CurriculumInput.Type
      ) {
        const locale = getLocaleOrThrow(data.locale);
        const model = yield* Effect.promise(() =>
          resolveRuntimeCurriculumRoute({
            curriculum: data.curriculum,
            locale,
            path: data.path,
          })
        );
        const { program, route } = model;
        const canonicalPath = Schema.decodeUnknownOption(LocalizedPath)(
          toCanonicalPath(`/${locale}/${route.publicPath}`)
        );
        if (Option.isNone(canonicalPath)) {
          return { kind: "notFound" as const };
        }
        const [catalog, messages, seo] = yield* Effect.all(
          [
            Effect.promise(() => readRuntimeCurriculumCatalog(locale)),
            Effect.promise(() => loadLocaleMessages(locale)),
            resolveSEOMetadata(
              readCurriculumSeoContext(route, model.ancestors),
              locale
            ),
          ],
          { concurrency: "unbounded" }
        );
        const tCommon = createTranslator({
          locale,
          messages,
          namespace: "Common",
        });
        const tLearningPrograms = createTranslator({
          locale,
          messages,
          namespace: "LearningPrograms",
        });
        const homeLabel = tCommon("home");
        const subjectLabel = tCommon("subject");
        const childVisuals = getCurriculumLooks(model.childRoutes, (child) =>
          resolveCurriculumCatalogArtwork(locale, {
            kind: "route",
            nodeKey: child.nodeKey,
            programKey: child.programKey,
          })
        );

        return {
          alternates: toHeadAlternates(
            createResolvedRouteAlternates(route, model.alternates)
          ),
          ancestors: model.ancestors,
          breadcrumbs: createBreadcrumbItems(
            locale,
            readRuntimeCurriculumBreadcrumbs(homeLabel, subjectLabel, model)
          ),
          cacheTags: readContentCacheTags([
            ...LEARN_SHELL_CACHE_SCOPES,
            "program",
            "material",
          ]),
          canonicalPath: canonicalPath.value,
          chapters: readMaterialCardChapters(model.materialCards),
          childCards: Arr.zipWith(
            model.childRoutes,
            childVisuals,
            (route, visual) => ({
              route,
              visual,
            })
          ),
          kind: "found" as const,
          description: seo.description,
          image: getCurriculumRouteSocialImage(locale, program.key, route),
          labels: {
            home: homeLabel,
            more: tCommon("more"),
            routeAction: tLearningPrograms("curriculum-route-action"),
            selector: tLearningPrograms("kind.school-curriculum"),
            subject: subjectLabel,
          },
          locale,
          materialCards: model.materialCards,
          options: readRuntimeCurriculumOptions(catalog),
          route,
          sourceUrl: model.sourceRevision
            ? getAksaraTreeUrl({
                path: model.sourcePath,
                revision: model.sourceRevision,
              })
            : null,
          title: seo.title,
          toc: readRuntimeCurriculumToc(model),
        };
      })
    )
  );

/** One curriculum node: a track chooser, a nested node or a material list. */
export const Route = createFileRoute("/$locale/_main/curricula/$curriculum/$")({
  loader: async ({ params }) => {
    const page = await readCurriculumRoute({
      data: {
        curriculum: params.curriculum,
        locale: params.locale,
        path: Arr.filter(
          (params._splat ?? "").split("/"),
          (segment) => segment !== ""
        ),
      },
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
        locale,
        parts: [title],
        type: "website",
      })
    );
  },
  headers: ({ loaderData }) =>
    loaderData === undefined
      ? undefined
      : publicContentHeaders(loaderData.cacheTags),
  component: CurriculumRoutePage,
});

function CurriculumRoutePage() {
  const page = Route.useLoaderData();
  const { labels, route } = page;
  return (
    <LayoutMaterial>
      <LayoutMaterialContent>
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
              home: { host: "app", target: HOME_TARGET },
              homeLabel: labels.home,
              items: [{ label: labels.subject }],
              menuLabel: labels.more,
              title: route.title,
            }}
          />
        ) : (
          <CurriculumNestedHeader
            ancestors={page.ancestors}
            currentRoute={route}
            homeLabel={labels.home}
            menuLabel={labels.more}
            subjectLabel={labels.subject}
          />
        )}
        <LayoutContent>
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
        </LayoutContent>
        {page.sourceUrl ? (
          <FooterContent>
            <RefContent githubUrl={page.sourceUrl} />
          </FooterContent>
        ) : null}
      </LayoutMaterialContent>
      {page.materialCards.length > 0 ? (
        <SidebarRight
          footer={
            <SidebarRightFooter>
              <ReportButton />
              {page.sourceUrl ? (
                <GithubButton githubUrl={page.sourceUrl} />
              ) : null}
              <ShareButton />
            </SidebarRightFooter>
          }
          header={<SidebarRightHeader {...page.toc} />}
        >
          <SidebarTree data={page.chapters} title={route.title} />
        </SidebarRight>
      ) : null}
    </LayoutMaterial>
  );
}
