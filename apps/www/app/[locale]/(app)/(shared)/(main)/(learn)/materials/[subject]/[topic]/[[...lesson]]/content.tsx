import { AppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import {
  MaterialLessonProjectionSchema,
  MaterialMetadataSchema,
} from "@nakafa/aksara-contracts/projection/material";
import { RendererDomainSchema } from "@nakafa/aksara-contracts/renderer/domain";
import { Schema } from "effect";
import { notFound } from "next/navigation";
import type { PropsWithChildren } from "react";
import type { MaterialParams } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/data";
import { resolveMaterialOwner } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/owner";
import { getMaterialPublication } from "@/lib/content/material/publication";
import { getLlmsMarkdownPath } from "@/lib/llms/format";
import { getAksaraUrl } from "@/lib/utils/github";

const PreviewPageSchema = Schema.Struct({
  alternates: Schema.Array(MaterialLessonProjectionSchema),
  appLocale: AppLocaleCodeSchema,
  body: Schema.String,
  copySourceUrl: Schema.Null,
  kind: Schema.Literal("preview"),
  metadata: MaterialMetadataSchema,
  rendererDomain: RendererDomainSchema,
  route: MaterialLessonProjectionSchema,
  siblings: Schema.Array(MaterialLessonProjectionSchema),
  sourceUrl: Schema.Null,
});

const PublishedPageSchema = Schema.Struct({
  alternates: Schema.Array(MaterialLessonProjectionSchema),
  appLocale: AppLocaleCodeSchema,
  body: Schema.String,
  copySourceUrl: Schema.NullOr(Schema.String),
  kind: Schema.Literal("published"),
  metadata: MaterialMetadataSchema,
  rendererDomain: RendererDomainSchema,
  route: MaterialLessonProjectionSchema,
  siblings: Schema.Array(MaterialLessonProjectionSchema),
  sourceUrl: Schema.NullOr(Schema.String),
});

/** React children hold the rendered body, which no Schema can describe. */
type MaterialPageChildren = Required<Pick<PropsWithChildren, "children">>;

/** Complete verified body and shell model consumed by the material page. */
export type MaterialPageContent = (
  | typeof PreviewPageSchema.Type
  | typeof PublishedPageSchema.Type
) &
  MaterialPageChildren;

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

/** Metadata selected from the same exclusive owner as the page body. */
export type MaterialMetadataContent = Awaited<
  ReturnType<typeof readMaterialMetadata>
>;

/** Loads the verified body, metadata, navigation model, and source link. */
export async function readMaterialPage(
  params: MaterialParams
): Promise<MaterialPageContent> {
  const owner = await resolveMaterialOwner(params);
  if (!owner) {
    notFound();
  }
  if (owner.kind === "preview") {
    const Content = owner.preview.Content;
    return {
      alternates: [owner.preview.projection],
      appLocale: owner.appLocale,
      body: owner.preview.rawMdx,
      children: <Content />,
      copySourceUrl: null,
      kind: owner.kind,
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
    appLocale: owner.locale,
    body: published.rawMdx,
    children: published.body,
    copySourceUrl: published.sourceRevision
      ? getLlmsMarkdownPath({
          locale: owner.locale,
          publicPath: owner.publicPath,
        })
      : null,
    kind: owner.kind,
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
