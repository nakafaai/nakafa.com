import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import type {
  ArticleMetadata,
  ArticleProjection,
  ArticleReference,
} from "@nakafa/aksara-contracts/projection/article";
import { Effect, Option } from "effect";
import { io } from "next/cache";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import type { ReactNode } from "react";
import { getArticlePublication } from "@/lib/content/article/publication";
import {
  type ArticlePreviewContent,
  readArticlePreview,
} from "@/lib/content/preview/article";
import { hasPreviewConfig } from "@/lib/content/preview/config";
import { getLlmsMarkdownPath } from "@/lib/llms/format";
import { getAksaraUrl } from "@/lib/utils/github";

/** Exact route identity shared by metadata and body ownership reads. */
export interface ArticleContentInput {
  readonly locale: Locale;
  readonly publicPath: ArticleProjection["publicPath"];
}

interface PublishedOwner {
  readonly kind: "published";
}

interface PreviewOwner {
  readonly content: ArticlePreviewContent;
  readonly kind: "preview";
}

/** Complete article data consumed by the existing page shell. */
export interface ArticlePageContent {
  readonly alternates: readonly ArticleProjection[];
  readonly body: string;
  readonly categoryTitle: string;
  readonly children: ReactNode;
  readonly contentId: ArticleProjection["graph"]["assetId"];
  readonly copySourceUrl: null | string;
  readonly kind: PreviewOwner["kind"] | PublishedOwner["kind"];
  readonly metadata: ArticleMetadata;
  readonly references: readonly ArticleReference[];
  readonly route: ArticleProjection;
  readonly sourceUrl: null | string;
}

/** Reads local article ownership only inside the configured preview child. */
async function readPreviewOwner(input: ArticleContentInput) {
  if (!hasPreviewConfig()) {
    return Option.none<ArticlePreviewContent>();
  }

  await io();
  return Effect.runPromise(
    readArticlePreview({
      appLocale: AppLocaleSchema.make(input.locale),
      publicPath: input.publicPath,
    })
  );
}

/** Selects one exclusive article owner before any native module import. */
async function resolveArticleOwner(
  input: ArticleContentInput
): Promise<PreviewOwner | PublishedOwner> {
  const preview = await readPreviewOwner(input);
  if (Option.isSome(preview)) {
    return { content: preview.value, kind: "preview" };
  }

  return { kind: "published" };
}

/** Reads metadata through the same exclusive owner used by page rendering. */
export async function readArticleMetadata(input: ArticleContentInput) {
  const owner = await resolveArticleOwner(input);
  if (owner.kind === "preview") {
    return {
      alternates: [owner.content.projection],
      categoryTitle: owner.content.categoryTitle,
      metadata: owner.content.metadata,
      route: owner.content.projection,
    };
  }
  const publication = await getArticlePublication(
    input.locale,
    input.publicPath
  );
  if (!publication?.model.projection) {
    notFound();
  }
  return {
    alternates: publication.model.alternates,
    categoryTitle: publication.model.projection.categoryTitle,
    metadata: publication.model.projection.metadata,
    route: publication.model.projection,
  };
}

/** Loads the body, metadata, references, and immutable source link. */
export async function readArticlePage(
  input: ArticleContentInput
): Promise<ArticlePageContent> {
  const owner = await resolveArticleOwner(input);
  if (owner.kind === "preview") {
    return {
      ...owner.content,
      alternates: [owner.content.projection],
      copySourceUrl: null,
      kind: owner.kind,
      route: owner.content.projection,
      sourceUrl: null,
    };
  }
  const publication = await getArticlePublication(
    input.locale,
    input.publicPath
  );
  if (!publication) {
    notFound();
  }
  const { model, published } = publication;

  return {
    alternates: model.alternates,
    body: published.rawMdx,
    categoryTitle: published.categoryTitle,
    children: published.body,
    contentId: published.contentId,
    copySourceUrl: published.sourceRevision
      ? getLlmsMarkdownPath({
          locale: input.locale,
          publicPath: input.publicPath,
        })
      : null,
    kind: owner.kind,
    metadata: published.metadata,
    references: published.references,
    route: model.projection,
    sourceUrl: published.sourceRevision
      ? getAksaraUrl({
          path: published.sourcePath,
          revision: published.sourceRevision,
        })
      : null,
  };
}
