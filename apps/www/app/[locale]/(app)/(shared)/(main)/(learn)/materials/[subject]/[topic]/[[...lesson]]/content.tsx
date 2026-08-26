import type {
  MaterialLessonProjection,
  MaterialMetadata,
} from "@nakafa/aksara-contracts/projection/material";
import type { RendererDomain } from "@nakafa/aksara-contracts/renderer/domain";
import { Effect, Option } from "effect";
import { io } from "next/cache";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import type { ReactNode } from "react";
import {
  type MaterialParams,
  readMaterialRequest,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/data";
import { getMaterialPublication } from "@/lib/content/material/publication";
import { hasPreviewConfig } from "@/lib/content/preview/config";
import {
  type MaterialPreviewContent,
  readMaterialPreview,
} from "@/lib/content/preview/material";
import type { ActiveContentReleaseId } from "@/lib/content/published/active";
import { getAksaraUrl, getRawAksaraUrl } from "@/lib/utils/github";

interface PreviewOwner {
  readonly appLocale: Locale;
  readonly kind: "preview";
  readonly preview: MaterialPreviewContent;
}

interface PublishedOwner {
  readonly kind: "published";
  readonly locale: Locale;
  readonly publicPath: string;
}

type MaterialOwner = PreviewOwner | PublishedOwner;

interface MaterialFields {
  readonly alternates: readonly MaterialLessonProjection[];
  readonly appLocale: Locale;
  readonly metadata: MaterialMetadata;
  readonly rendererDomain: RendererDomain;
  readonly route: MaterialLessonProjection;
}

interface PreviewContent extends MaterialFields {
  readonly body: string;
  readonly children: ReactNode;
  readonly copySourceUrl: null;
  readonly kind: "preview";
  readonly siblings: readonly MaterialLessonProjection[];
  readonly sourceUrl: null;
}

interface PublishedContent extends MaterialFields {
  readonly activeReleaseId: ActiveContentReleaseId;
  readonly body: string;
  readonly children: ReactNode;
  readonly copySourceUrl: null | string;
  readonly kind: "published";
  readonly siblings: readonly MaterialLessonProjection[];
  readonly sourceUrl: null | string;
}

/** Complete verified body and shell model consumed by the material page. */
export type MaterialPageContent = PreviewContent | PublishedContent;

/** Metadata selected from the same exclusive owner as the page body. */
export interface MaterialMetadataContent extends MaterialFields {
  readonly kind: MaterialOwner["kind"];
}

/** Reads a local overlay only in the explicitly configured preview child. */
async function readPreviewOwner(
  params: Awaited<MaterialParams>,
  appLocale: Locale
): Promise<Option.Option<PreviewOwner>> {
  if (!hasPreviewConfig()) {
    return Option.none();
  }
  await io();
  return Option.map(
    await Effect.runPromise(readMaterialPreview({ params })),
    (preview) => ({ appLocale, kind: "preview", preview })
  );
}

/** Selects an authenticated preview or the signed Aksara publication. */
async function resolveMaterialOwner(
  params: MaterialParams
): Promise<MaterialOwner> {
  const routeParams = await params;
  const request = await readMaterialRequest(Promise.resolve(routeParams));
  const preview = await readPreviewOwner(routeParams, request.locale);
  if (Option.isSome(preview)) {
    return preview.value;
  }

  if (!request.publicPath) {
    notFound();
  }
  return {
    kind: "published",
    locale: request.locale,
    publicPath: request.publicPath,
  };
}

/** Reads metadata through the same exclusive owner used by page rendering. */
export async function readMaterialMetadata(
  params: MaterialParams
): Promise<MaterialMetadataContent> {
  const owner = await resolveMaterialOwner(params);
  if (owner.kind === "preview") {
    return {
      alternates: [owner.preview.projection],
      kind: owner.kind,
      appLocale: owner.appLocale,
      metadata: owner.preview.metadata,
      rendererDomain: owner.preview.rendererDomain,
      route: owner.preview.projection,
    };
  }

  const publication = await getMaterialPublication(
    owner.locale,
    owner.publicPath
  );
  if (!publication) {
    notFound();
  }
  const { model, published } = publication;

  return {
    alternates: model.alternates,
    kind: owner.kind,
    appLocale: owner.locale,
    metadata: published.metadata,
    rendererDomain: published.rendererDomain,
    route: model.projection,
  };
}

/** Loads the verified body, metadata, navigation model, and source link. */
export async function readMaterialPage(
  params: MaterialParams
): Promise<MaterialPageContent> {
  const owner = await resolveMaterialOwner(params);
  if (owner.kind === "preview") {
    const Content = owner.preview.Content;
    return {
      alternates: [owner.preview.projection],
      body: owner.preview.rawMdx,
      children: <Content />,
      copySourceUrl: null,
      kind: owner.kind,
      appLocale: owner.appLocale,
      metadata: owner.preview.metadata,
      rendererDomain: owner.preview.rendererDomain,
      route: owner.preview.projection,
      siblings: [owner.preview.projection],
      sourceUrl: null,
    };
  }

  const publication = await getMaterialPublication(
    owner.locale,
    owner.publicPath
  );
  if (!publication) {
    notFound();
  }
  const { model, published } = publication;
  return {
    activeReleaseId: published.activeReleaseId,
    alternates: model.alternates,
    body: published.rawMdx,
    children: published.body,
    copySourceUrl: published.sourceRevision
      ? getRawAksaraUrl({
          path: published.sourcePath,
          revision: published.sourceRevision,
        })
      : null,
    kind: owner.kind,
    appLocale: owner.locale,
    metadata: published.metadata,
    rendererDomain: published.rendererDomain,
    route: model.projection,
    siblings: model.siblings,
    sourceUrl: published.sourceRevision
      ? getAksaraUrl({
          path: published.sourcePath,
          revision: published.sourceRevision,
        })
      : null,
  };
}
