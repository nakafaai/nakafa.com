import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import type { MaterialParams } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/data";
import { resolveMaterialOwner } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/owner";
import { getMaterialPublication } from "@/lib/content/material/publication";
import { getLlmsMarkdownPath } from "@/lib/llms/format";
import { getAksaraUrl } from "@/lib/utils/github";

/** Complete verified body and shell model consumed by the material page. */
export type MaterialPageContent = Awaited<ReturnType<typeof readMaterialPage>>;

/** Metadata selected from the same exclusive owner as the page body. */
export type MaterialMetadataContent = Awaited<
  ReturnType<typeof readMaterialMetadata>
>;

/**
 * Types one rendered body as the page shell's React children. Bodies stay
 * JSX inside Effect, where a ReactNode would put a Promise in the success
 * channel, so the page content widens them here, outside Effect.
 */
function toPageChildren(body: ReactNode): ReactNode {
  return body;
}

/** Reads metadata from the same signed delivery the page body renders. */
export async function readMaterialMetadata(params: MaterialParams) {
  const owner = await resolveMaterialOwner(params);
  if (!owner) {
    notFound();
  }
  if (owner.kind === "preview") {
    return {
      alternates: [owner.preview.projection],
      kind: owner.kind,
      appLocale: owner.appLocale,
      metadata: owner.preview.metadata,
      route: owner.preview.projection,
    };
  }

  const publication = await getMaterialPublication(
    owner.locale,
    owner.publicPath
  );
  if (!publication?.model.projection) {
    notFound();
  }

  return {
    alternates: publication.model.alternates,
    kind: owner.kind,
    appLocale: owner.locale,
    metadata: publication.model.projection.metadata,
    route: publication.model.projection,
  };
}

/** Loads the verified body, metadata, navigation model, and source link. */
export async function readMaterialPage(params: MaterialParams) {
  const owner = await resolveMaterialOwner(params);
  if (!owner) {
    notFound();
  }
  if (owner.kind === "preview") {
    const Content = owner.preview.Content;
    return {
      alternates: [owner.preview.projection],
      body: owner.preview.rawMdx,
      children: toPageChildren(<Content />),
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
    alternates: model.alternates,
    body: published.rawMdx,
    children: toPageChildren(published.body),
    copySourceUrl: published.sourceRevision
      ? getLlmsMarkdownPath({
          locale: owner.locale,
          publicPath: owner.publicPath,
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
