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
import { applyContentRuntimeCache } from "@/lib/content/cache";
import {
  type ArticlePreviewContent,
  readArticlePreview,
} from "@/lib/content/preview/article";
import { hasPreviewConfig } from "@/lib/content/preview/config";
import {
  type ActiveContentReleaseId,
  getActiveContentIdentity,
} from "@/lib/content/published/active";
import {
  getPublishedArticle,
  renderPublishedArticle,
} from "@/lib/content/published/article";
import { readActiveContentRoute } from "@/lib/content/published/route";
import { getAksaraUrl } from "@/lib/utils/github";

/** Exact route identity shared by metadata and body ownership reads. */
export interface ArticleContentInput {
  readonly locale: Locale;
  readonly publicPath: ArticleProjection["publicPath"];
}

interface PublishedOwner {
  readonly activeReleaseId: ActiveContentReleaseId;
  readonly kind: "published";
}

interface PreviewOwner {
  readonly content: ArticlePreviewContent;
  readonly kind: "preview";
}

/** Complete article data consumed by the existing page shell. */
export interface ArticlePageContent {
  readonly body: string;
  readonly categoryTitle: string;
  readonly children: ReactNode;
  readonly contentId: ArticleProjection["graph"]["assetId"];
  readonly metadata: ArticleMetadata;
  readonly references: readonly ArticleReference[];
  readonly sourceUrl: null | string;
}

/** Caches one exact published-ownership decision under content invalidation. */
async function readPublishedOwner(input: ArticleContentInput) {
  "use cache";

  applyContentRuntimeCache();

  const active = await getActiveContentIdentity();
  return await Effect.runPromise(
    readActiveContentRoute({
      activeReleaseId: active?.releaseId ?? null,
      family: "article",
      locale: input.locale,
      publicPath: input.publicPath,
    })
  );
}

/** Reads local article ownership only inside the configured preview child. */
async function readPreviewOwner(input: ArticleContentInput) {
  if (!hasPreviewConfig()) {
    return Option.none<ArticlePreviewContent>();
  }

  await io();
  return Effect.runPromise(readArticlePreview(input));
}

/** Selects one exclusive article owner before any native module import. */
async function resolveArticleOwner(
  input: ArticleContentInput
): Promise<PreviewOwner | PublishedOwner> {
  const preview = await readPreviewOwner(input);
  if (Option.isSome(preview)) {
    return { content: preview.value, kind: "preview" };
  }

  const published = await readPublishedOwner(input);
  if (published.kind !== "found") {
    notFound();
  }
  return {
    activeReleaseId: published.activeReleaseId,
    kind: "published",
  };
}

/** Reads metadata through the same exclusive owner used by page rendering. */
export async function readArticleMetadata(input: ArticleContentInput) {
  const owner = await resolveArticleOwner(input);
  if (owner.kind === "preview") {
    return {
      categoryTitle: owner.content.categoryTitle,
      metadata: owner.content.metadata,
    };
  }
  const published = await getPublishedArticle({
    activeReleaseId: owner.activeReleaseId,
    locale: input.locale,
    publicPath: input.publicPath,
  });
  return {
    categoryTitle: published.projection.categoryTitle,
    metadata: published.projection.metadata,
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
      sourceUrl: null,
    };
  }
  const published = await renderPublishedArticle({
    activeReleaseId: owner.activeReleaseId,
    locale: input.locale,
    publicPath: input.publicPath,
  });

  return {
    body: published.rawMdx,
    categoryTitle: published.categoryTitle,
    children: published.body,
    contentId: published.contentId,
    metadata: published.metadata,
    references: published.references,
    sourceUrl: published.sourceRevision
      ? getAksaraUrl({
          path: published.sourcePath,
          revision: published.sourceRevision,
        })
      : null,
  };
}
