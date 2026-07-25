import type { MaterialMetadata } from "@nakafa/aksara-contracts/projection/material";
import { isMaterialLessonRoute } from "@repo/contents/_types/route/content";
import type { PublicContentRoute } from "@repo/contents/_types/route/schema";
import { Effect, Option } from "effect";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { Locale } from "next-intl";
import type { ReactNode } from "react";
import {
  type MaterialParams,
  readMaterialRequest,
  readMaterialRoute,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/data";
import { getMaterialPageData } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/runtime";
import { applyContentRuntimeCache } from "@/lib/content/cache";
import { importContentModuleOrNull } from "@/lib/content/module";
import { hasPreviewConfig } from "@/lib/content/preview/config";
import {
  type MaterialPreviewContent,
  readMaterialPreview,
} from "@/lib/content/preview/material";
import {
  type ActiveContentReleaseId,
  getActiveContentIdentity,
} from "@/lib/content/published/active";
import { PublishedRendererMissingError } from "@/lib/content/published/errors";
import { renderPublishedMathematics } from "@/lib/content/published/mathematics";
import { getPublishedMaterialMetadata } from "@/lib/content/published/metadata";
import { readActiveMaterialRoute } from "@/lib/content/published/route";
import { getAksaraUrl, getGithubUrl } from "@/lib/utils/github";

interface PreviewOwner {
  readonly kind: "preview";
  readonly locale: Locale;
  readonly preview: MaterialPreviewContent;
  readonly route: PublicContentRoute;
}

interface PublishedOwner {
  readonly activeReleaseId: ActiveContentReleaseId;
  readonly kind: "published";
  readonly locale: Locale;
  readonly route: PublicContentRoute;
}

interface SourceOwner {
  readonly kind: "source";
  readonly locale: Locale;
  readonly route: PublicContentRoute;
}

/** Complete body data consumed by the existing material lesson shell. */
export interface MaterialPageSource {
  readonly body: string;
  readonly children: ReactNode;
  readonly locale: Locale;
  readonly metadata: MaterialMetadata;
  readonly route: PublicContentRoute;
  readonly sourceUrl: null | string;
}

/** Caches one exact published-ownership decision under content invalidation. */
async function readPublishedOwner(locale: Locale, publicPath: string) {
  "use cache";

  applyContentRuntimeCache();

  const active = await getActiveContentIdentity();
  return await Effect.runPromise(
    readActiveMaterialRoute({
      activeReleaseId: active?.releaseId ?? null,
      locale,
      publicPath,
    })
  );
}

/** Reads a local overlay only in the explicitly configured preview child. */
async function readPreviewOwner(
  params: Awaited<MaterialParams>
): Promise<Option.Option<PreviewOwner>> {
  if (!hasPreviewConfig()) {
    return Option.none();
  }

  await connection();
  const preview = await Effect.runPromise(readMaterialPreview({ params }));

  return Option.map(
    preview,
    (content) =>
      ({
        kind: "preview",
        locale: content.locale,
        preview: content,
        route: content.route,
      }) satisfies PreviewOwner
  );
}

/**
 * Selects one exclusive body owner before any static source lookup.
 *
 * Permanently owned deletions and unsupported renderer domains never reach the
 * filesystem source, so an old MDX body cannot reappear after migration.
 */
async function resolveMaterialOwner(params: MaterialParams) {
  const routeParams = await params;
  const preview = await readPreviewOwner(routeParams);
  if (Option.isSome(preview)) {
    return preview.value;
  }

  const resolvedParams = Promise.resolve(routeParams);
  const request = await readMaterialRequest(resolvedParams);
  if (!request.publicPath) {
    notFound();
  }

  const published = await readPublishedOwner(
    request.locale,
    request.publicPath
  );
  if (published.kind === "missing") {
    notFound();
  }
  if (published.kind === "found") {
    if (published.rendererDomain !== "mathematics") {
      return await Effect.runPromise(
        Effect.fail(
          new PublishedRendererMissingError({
            rendererDomain: published.rendererDomain,
          })
        )
      );
    }

    return {
      activeReleaseId: published.activeReleaseId,
      kind: "published",
      locale: request.locale,
      route: published.route,
    } satisfies PublishedOwner;
  }

  const source = await readMaterialRoute(resolvedParams);
  if (!(source.route && isMaterialLessonRoute(source.route))) {
    notFound();
  }

  return {
    kind: "source",
    locale: source.locale,
    route: source.route,
  } satisfies SourceOwner;
}

/** Reads metadata through the same exclusive owner used by page rendering. */
export async function readMaterialMetadata(params: MaterialParams) {
  const owner = await resolveMaterialOwner(params);
  if (owner.kind === "preview") {
    return {
      locale: owner.locale,
      metadata: owner.preview.metadata,
      route: owner.route,
    };
  }
  if (owner.kind === "published") {
    const published = await getPublishedMaterialMetadata({
      activeReleaseId: owner.activeReleaseId,
      locale: owner.locale,
      publicPath: owner.route.publicPath,
    });

    return {
      locale: owner.locale,
      metadata: published.metadata,
      route: published.route,
    };
  }

  const source = await getMaterialPageData({
    locale: owner.locale,
    sourcePath: owner.route.sourcePath,
  });

  return {
    locale: owner.locale,
    metadata: source?.metadata,
    route: owner.route,
  };
}

/** Loads the body, metadata, and immutable source link from one owner only. */
export async function readMaterialPage(
  params: MaterialParams
): Promise<MaterialPageSource> {
  const owner = await resolveMaterialOwner(params);
  if (owner.kind === "preview") {
    const Content = owner.preview.Content;

    return {
      body: owner.preview.rawMdx,
      children: <Content />,
      locale: owner.locale,
      metadata: owner.preview.metadata,
      route: owner.route,
      sourceUrl: null,
    };
  }
  if (owner.kind === "published") {
    const published = await renderPublishedMathematics({
      activeReleaseId: owner.activeReleaseId,
      locale: owner.locale,
      publicPath: owner.route.publicPath,
    });

    return {
      body: published.rawMdx,
      children: published.body,
      locale: owner.locale,
      metadata: published.metadata,
      route: published.route,
      sourceUrl: published.sourceRevision
        ? getAksaraUrl({
            path: published.sourcePath,
            revision: published.sourceRevision,
          })
        : null,
    };
  }

  const [source, content] = await Promise.all([
    getMaterialPageData({
      locale: owner.locale,
      sourcePath: owner.route.sourcePath,
    }),
    importContentModuleOrNull({
      filePath: owner.route.sourcePath,
      locale: owner.locale,
      source: "material-public-route",
    }),
  ]);
  if (!(source && content?.default)) {
    notFound();
  }
  const Content = content.default;

  return {
    body: source.body,
    children: <Content />,
    locale: owner.locale,
    metadata: source.metadata,
    route: owner.route,
    sourceUrl: getGithubUrl({
      path: `/packages/contents/${owner.route.sourcePath}/${owner.locale}.mdx`,
    }),
  };
}
