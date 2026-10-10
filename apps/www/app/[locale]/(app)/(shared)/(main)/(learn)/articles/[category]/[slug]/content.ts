import { notFound } from "next/navigation";
import {
  type ArticleContentInput,
  resolveArticleOwner,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/articles/[category]/[slug]/owner";
import { getArticlePublication } from "@/lib/content/article/publication";
import { getAksaraUrl } from "@/lib/content/repository";
import { getLlmsMarkdownPath } from "@/lib/llms/format";

/** Complete article data consumed by the existing page shell. */
export type ArticlePageContent = Awaited<ReturnType<typeof readArticlePage>>;

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
export async function readArticlePage(input: ArticleContentInput) {
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
