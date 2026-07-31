import type {
  MaterialLessonProjection,
  MaterialMetadata,
} from "@nakafa/aksara-contracts/projection/material";
import type { RendererDomain } from "@nakafa/aksara-contracts/renderer/domain";
import { isMaterialLessonRoute } from "@repo/contents/_types/route/content";
import type { PublicMaterialLessonRoute } from "@repo/contents/_types/route/schema";
import { Effect, Option } from "effect";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { Locale } from "next-intl";
import type { ReactNode } from "react";
import {
  type MaterialParams,
  readMaterialRequest,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/data";
import { getMaterialPageData } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/runtime";
import type { MaterialSourceClaim } from "@/lib/content/material/ownership";
import {
  type MaterialReleasePin,
  verifyStaticMaterialReleasePin,
} from "@/lib/content/material/release";
import {
  getPublishedMaterialRoute,
  type PublishedMaterialRoute,
} from "@/lib/content/material/route";
import {
  readMaterialCandidates,
  readMaterialSource,
} from "@/lib/content/material/shell";
import { importContentModuleOrNull } from "@/lib/content/module";
import { hasPreviewConfig } from "@/lib/content/preview/config";
import {
  type MaterialPreviewContent,
  readMaterialPreview,
} from "@/lib/content/preview/material";
import { renderPublishedMaterial } from "@/lib/content/published/material";
import { getAksaraUrl, getGithubUrl } from "@/lib/utils/github";

/** Route data accepted while one family moves from source to Aksara. */
export type MaterialViewRoute =
  | MaterialLessonProjection
  | PublicMaterialLessonRoute;

interface PreviewOwner {
  readonly kind: "preview";
  readonly preview: MaterialPreviewContent;
}

interface PublishedOwner {
  readonly kind: "published";
  readonly model: Extract<
    PublishedMaterialRoute,
    { readonly projection: MaterialLessonProjection }
  >;
}

interface SourceOwner {
  readonly activeReleaseId: MaterialReleasePin;
  readonly kind: "source";
  readonly locale: Locale;
  readonly route: PublicMaterialLessonRoute;
  readonly sourceClaims: readonly MaterialSourceClaim[];
  readonly sourceMaterials: readonly MaterialLessonProjection[];
}

type MaterialOwner = PreviewOwner | PublishedOwner | SourceOwner;

interface MaterialPageFields {
  readonly alternates: readonly MaterialViewRoute[];
  readonly body: string;
  readonly children: ReactNode;
  readonly locale: Locale;
  readonly metadata: MaterialMetadata;
  readonly rendererDomain: RendererDomain | null;
  readonly siblings: readonly MaterialLessonProjection[];
  readonly sourceClaims: readonly MaterialSourceClaim[];
  readonly sourceUrl: null | string;
}

interface PreviewPageSource extends MaterialPageFields {
  readonly kind: "preview";
  readonly route: MaterialLessonProjection;
}

interface PublishedPageSource extends MaterialPageFields {
  readonly familyManaged: boolean;
  readonly kind: "published";
  readonly route: MaterialLessonProjection;
}

interface SourcePageSource extends MaterialPageFields {
  readonly kind: "source";
  readonly route: PublicMaterialLessonRoute;
}

/** Complete body and shell model consumed by the material lesson page. */
export type MaterialPageSource =
  | PreviewPageSource
  | PublishedPageSource
  | SourcePageSource;

interface MaterialMetadataFields {
  readonly alternates: readonly MaterialViewRoute[];
  readonly locale: Locale;
  readonly metadata: MaterialMetadata | undefined;
  readonly sourceClaims: readonly MaterialSourceClaim[];
}

interface PreviewMetadataSource extends MaterialMetadataFields {
  readonly kind: "preview";
  readonly route: MaterialLessonProjection;
}

interface PublishedMetadataSource extends MaterialMetadataFields {
  readonly familyManaged: boolean;
  readonly kind: "published";
  readonly route: MaterialLessonProjection;
}

interface SourceMetadataSource extends MaterialMetadataFields {
  readonly kind: "source";
  readonly route: PublicMaterialLessonRoute;
}

/** Metadata and locale counterparts selected from one exclusive owner. */
export type MaterialMetadataSource =
  | PreviewMetadataSource
  | PublishedMetadataSource
  | SourceMetadataSource;

/** Reads a local overlay only in the explicitly configured preview child. */
async function readPreviewOwner(
  params: Awaited<MaterialParams>
): Promise<Option.Option<PreviewOwner>> {
  if (!hasPreviewConfig()) {
    return Option.none();
  }
  await connection();
  return Option.map(
    await Effect.runPromise(readMaterialPreview({ params })),
    (preview) => ({ kind: "preview", preview })
  );
}

/**
 * Selects one exclusive body owner before loading a filesystem body.
 *
 * An Aksara-owned deletion cannot fall through to the old source body.
 */
async function resolveMaterialOwner(
  params: MaterialParams
): Promise<MaterialOwner> {
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
  const source = readMaterialSource(request.locale, request.publicPath);
  let published = await getPublishedMaterialRoute(
    request.locale,
    request.publicPath,
    source.candidates
  );
  if (
    published.managed &&
    !published.familyManaged &&
    published.projection !== null
  ) {
    const candidates = readMaterialCandidates(published.projection);
    const initialIdentities = new Set(
      source.candidates.map(
        (candidate) => `${candidate.locale}\0${candidate.contentKey}`
      )
    );
    if (
      candidates.length !== source.candidates.length ||
      candidates.some(
        (candidate) =>
          !initialIdentities.has(`${candidate.locale}\0${candidate.contentKey}`)
      )
    ) {
      published = await getPublishedMaterialRoute(
        request.locale,
        request.publicPath,
        candidates,
        published.activeReleaseId
      );
    }
  }
  if (published.managed) {
    if (published.projection === null) {
      notFound();
    }
    return { kind: "published", model: published };
  }
  if (!(source.route && isMaterialLessonRoute(source.route))) {
    notFound();
  }
  const sourceClaim = published.sourceClaims.find(
    (claim) =>
      claim.contentKey === source.route.sourcePath &&
      claim.locale === request.locale
  );
  if (sourceClaim) {
    notFound();
  }
  return {
    activeReleaseId: published.activeReleaseId,
    kind: "source",
    locale: request.locale,
    route: source.route,
    sourceClaims: published.sourceClaims,
    sourceMaterials: published.sourceMaterials,
  };
}

/** Reads metadata through the same exclusive owner used by page rendering. */
export async function readMaterialMetadata(
  params: MaterialParams
): Promise<MaterialMetadataSource> {
  const owner = await resolveMaterialOwner(params);
  if (owner.kind === "preview") {
    return {
      alternates: [owner.preview.projection],
      kind: owner.kind,
      locale: owner.preview.locale,
      metadata: owner.preview.metadata,
      route: owner.preview.projection,
      sourceClaims: [],
    };
  }
  if (owner.kind === "published") {
    return {
      alternates: owner.model.alternates,
      familyManaged: owner.model.familyManaged,
      kind: owner.kind,
      locale: owner.model.projection.locale,
      metadata: owner.model.projection.metadata,
      route: owner.model.projection,
      sourceClaims: owner.model.sourceClaims,
    };
  }
  const source = await getMaterialPageData({
    locale: owner.locale,
    sourcePath: owner.route.sourcePath,
  });
  await verifyStaticMaterialReleasePin(owner.activeReleaseId, {
    locale: owner.locale,
    publicPath: owner.route.publicPath,
  });
  return {
    alternates: [],
    kind: owner.kind,
    locale: owner.locale,
    metadata: source?.metadata,
    route: owner.route,
    sourceClaims: owner.sourceClaims,
  };
}

/** Loads the body, metadata, navigation model, and immutable source link. */
export async function readMaterialPage(
  params: MaterialParams
): Promise<MaterialPageSource> {
  const owner = await resolveMaterialOwner(params);
  if (owner.kind === "preview") {
    const Content = owner.preview.Content;
    return {
      alternates: [owner.preview.projection],
      body: owner.preview.rawMdx,
      children: <Content />,
      kind: owner.kind,
      locale: owner.preview.locale,
      metadata: owner.preview.metadata,
      rendererDomain: owner.preview.rendererDomain,
      route: owner.preview.projection,
      siblings: [owner.preview.projection],
      sourceClaims: [],
      sourceUrl: null,
    };
  }
  if (owner.kind === "published") {
    const { model } = owner;
    const published = await renderPublishedMaterial({
      activeReleaseId: model.activeReleaseId,
      locale: model.projection.locale,
      publicPath: model.projection.publicPath,
    });
    return {
      alternates: model.alternates,
      body: published.rawMdx,
      children: published.body,
      familyManaged: model.familyManaged,
      kind: owner.kind,
      locale: model.projection.locale,
      metadata: published.metadata,
      rendererDomain: model.rendererDomain,
      route: model.projection,
      siblings: model.siblings,
      sourceClaims: model.sourceClaims,
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
  await verifyStaticMaterialReleasePin(owner.activeReleaseId, {
    locale: owner.locale,
    publicPath: owner.route.publicPath,
  });
  const Content = content.default;
  return {
    alternates: [],
    body: source.body,
    children: <Content />,
    kind: owner.kind,
    locale: owner.locale,
    metadata: source.metadata,
    rendererDomain: null,
    route: owner.route,
    siblings: owner.sourceMaterials,
    sourceClaims: owner.sourceClaims,
    sourceUrl: getGithubUrl({
      path: `/packages/contents/${owner.route.sourcePath}/${owner.locale}.mdx`,
    }),
  };
}
