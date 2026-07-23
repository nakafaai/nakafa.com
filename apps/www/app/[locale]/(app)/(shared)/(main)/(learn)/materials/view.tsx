import type { LearningContextInput } from "@repo/backend/convex/contents/context";
import { toLocalizedContentHref } from "@repo/contents/_types/route/content";
import type { MDXComponents } from "@repo/design-system/types/markdown";
import { Effect, Either, Option } from "effect";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  readMaterialHeaderLink,
  readMaterialRoutes,
  resolveParent,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/data";
import {
  getMaterialPageData,
  getMaterialPreviewData,
  getMaterialRouteData,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/runtime";
import {
  MaterialLessonPage,
  type MaterialPageContent,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/shell";
import { DeferredAiSheetOpen } from "@/components/ai/deferred-sheet-open";
import { DeferredComments } from "@/components/comments/deferred";
import { ContentViewTracker } from "@/components/tracking/tracker";
import {
  importMaterialModule,
  type MaterialModuleImporter,
  type MaterialRouteParams,
  type MaterialRouteTarget,
  type PublishedMaterialRenderer,
  type ResolvedMaterialRoute,
} from "@/lib/content/material";
import type { MaterialPreviewContent } from "@/lib/content/preview/material";
import { PublishedRendererMissingError } from "@/lib/content/published/errors";
import { getPublishedMaterialMetadata } from "@/lib/content/published/metadata";
import { getContentViewId } from "@/lib/content/views";
import { readMaterialContextQuery } from "@/lib/routing/material/query";
import { getAksaraUrl, getGithubUrl } from "@/lib/utils/github";
import { getOgUrl, getSocialMetadata } from "@/lib/utils/metadata";
import { createProjectedRouteAlternates } from "@/lib/utils/seo/alternates";

/** Framework inputs shared by each physical material route wrapper. */
export interface MaterialPageProps {
  readonly params: Promise<MaterialRouteParams>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Route-owned dependencies that keep rich registries physically isolated. */
export interface MaterialPageConfig {
  readonly components: MDXComponents;
  readonly importer: MaterialModuleImporter;
  readonly published?: PublishedMaterialRenderer;
  readonly target: MaterialRouteTarget;
}

/** One page resolution with an optional authenticated local body overlay. */
interface MaterialPageResolution extends ResolvedMaterialRoute {
  readonly owner: "preview" | "published" | "source";
  readonly preview: Option.Option<MaterialPreviewContent>;
}

/**
 * Resolves an authenticated local route before consulting the static catalog.
 *
 * Static resolution uses the pure decoder boundary so Next can prerender
 * source-controlled MDX without starting a timestamped Effect fiber.
 *
 * @see https://nextjs.org/docs/messages/next-prerender-current-time
 */
async function resolveMaterialPage(
  params: Promise<MaterialRouteParams>,
  config: MaterialPageConfig
): Promise<MaterialPageResolution> {
  const routeParams = await params;
  const preview = await getMaterialPreviewData({
    components: config.components,
    params: routeParams,
    target: config.target,
  });

  if (Option.isSome(preview)) {
    return {
      locale: preview.value.locale,
      owner: "preview",
      preview,
      rendererDomain: preview.value.rendererDomain,
      route: preview.value.route,
    };
  }

  const resolved = await getMaterialRouteData({
    params: routeParams,
    target: config.target,
  });

  if (Option.isNone(resolved)) {
    notFound();
  }

  return { ...resolved.value, preview };
}

/** Reads preview or synchronized metadata without reconnecting another registry. */
async function readMaterialMetadata(
  params: Promise<MaterialRouteParams>,
  config: MaterialPageConfig
) {
  const { locale, owner, preview, route } = await resolveMaterialPage(
    params,
    config
  );
  if (Option.isSome(preview)) {
    return { locale, metadata: preview.value.metadata, route };
  }
  if (owner === "published") {
    const published = await getPublishedMaterialMetadata({
      locale,
      publicPath: route.publicPath,
    });

    return {
      locale,
      metadata: published.metadata,
      route: published.route,
    };
  }
  const metadata = (
    await getMaterialPageData({
      locale,
      sourcePath: route.sourcePath,
    })
  ).metadata;

  return { locale, metadata, route };
}

/** Generates metadata through the one shared material route implementation. */
export async function generateMaterialMetadata(
  props: Pick<MaterialPageProps, "params">,
  config: MaterialPageConfig
): Promise<Metadata> {
  const { locale, metadata, route } = await readMaterialMetadata(
    props.params,
    config
  );
  const path = toLocalizedContentHref(route);
  const title = metadata.title;
  const description =
    metadata.description ?? metadata.subject ?? metadata.title;

  return {
    title: { absolute: title },
    description,
    authors: metadata.authors.map(({ name }) => ({ name })),
    alternates: createProjectedRouteAlternates(route, readMaterialRoutes(), {
      types: { "text/markdown": `${path}.md` },
    }),
    ...getSocialMetadata({
      title,
      description,
      locale,
      path,
      image: getOgUrl(locale, route.publicPath),
      type: "article",
    }),
  };
}

/** Renders one material page through its route-owned registry and body loader. */
export async function renderMaterialPage(
  { params, searchParams }: MaterialPageProps,
  config: MaterialPageConfig
) {
  const [resolution, query] = await Promise.all([
    resolveMaterialPage(params, config),
    searchParams,
  ]);
  const { locale, preview, rendererDomain } = resolution;
  let route = resolution.route;
  let children: ReactNode;
  let pageContent: MaterialPageContent;
  let sourceUrl: string | undefined;

  if (Option.isSome(preview)) {
    const Content = preview.value.Content;
    children = <Content />;
    pageContent = {
      body: preview.value.rawMdx,
      metadata: preview.value.metadata,
    };
    sourceUrl = undefined;
  } else if (resolution.owner === "published") {
    if (!config.published) {
      return await Effect.runPromise(
        Effect.fail(new PublishedRendererMissingError({ rendererDomain }))
      );
    }
    const published = await config.published({
      locale,
      publicPath: route.publicPath,
    });
    children = published.body;
    pageContent = {
      body: published.rawMdx,
      metadata: published.metadata,
    };
    sourceUrl = published.sourceRevision
      ? getAksaraUrl({
          path: published.sourcePath,
          revision: published.sourceRevision,
        })
      : undefined;
    route = published.route;
  } else {
    const [runtime, localModule] = await Promise.all([
      getMaterialPageData({ locale, sourcePath: route.sourcePath }),
      importMaterialModule({
        importer: config.importer,
        locale,
        rendererDomain,
        sourcePath: route.sourcePath,
      }),
    ]);
    const Content = localModule.default;
    children = <Content />;
    pageContent = { body: runtime.body, metadata: runtime.metadata };
    sourceUrl = getGithubUrl({
      path: `/packages/contents/${route.sourcePath}`,
    });
  }

  const parent = resolveParent(route);
  if (Either.isLeft(parent)) {
    return await Promise.reject(parent.left);
  }
  const parentRoute = parent.right;
  const materialContext = readMaterialContextQuery(query);
  const trackerContext: LearningContextInput | undefined = materialContext
    ? {
        mode: "placement",
        nodeKey: materialContext.nodeKey,
        programKey: materialContext.programKey,
      }
    : undefined;
  const contentId = getContentViewId({ locale, route: route.sourcePath });

  return (
    <ContentViewTracker
      contentId={contentId}
      context={trackerContext}
      locale={locale}
    >
      <MaterialLessonPage
        content={pageContent}
        footer={<DeferredComments slug={route.sourcePath} />}
        headerLink={readMaterialHeaderLink(route, materialContext)}
        locale={locale}
        materialContext={materialContext}
        parentTitle={parentRoute.title}
        rendererDomain={rendererDomain}
        route={route}
        sourceUrl={sourceUrl}
        toolbar={
          <DeferredAiSheetOpen
            audio={{
              contentType: "material",
              locale,
              slug: route.sourcePath,
            }}
            contextTitle={pageContent.metadata.title}
          />
        }
      >
        {children}
      </MaterialLessonPage>
    </ContentViewTracker>
  );
}
