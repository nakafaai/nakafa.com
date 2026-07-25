import type {
  ArticleMetadata,
  ArticleProjection,
  ArticleReference,
  ArticleCategory as PublishedArticleCategory,
} from "@nakafa/aksara-contracts/projection/article";
import { parseArticleCategory } from "@repo/contents/_lib/articles/category";
import type { ArticleCategory } from "@repo/contents/_types/taxonomy";
import { Effect, Option } from "effect";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { getArticlePageData } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/articles/[category]/[slug]/runtime";
import { applyContentRuntimeCache } from "@/lib/content/cache";
import { importContentModuleOrNull } from "@/lib/content/module";
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
import { getAksaraUrl, getGithubUrl } from "@/lib/utils/github";

/** Exact route identity shared by metadata and body ownership reads. */
export interface ArticleSourceInput {
  readonly category: PublishedArticleCategory;
  readonly locale: Locale;
  readonly publicPath: ArticleProjection["publicPath"];
  readonly slug: string;
}

interface PublishedOwner {
  readonly activeReleaseId: ActiveContentReleaseId;
  readonly kind: "published";
}

interface PreviewOwner {
  readonly content: ArticlePreviewContent;
  readonly kind: "preview";
}

interface SourceOwner {
  readonly category: ArticleCategory;
  readonly kind: "source";
}

/** Complete article data consumed by the existing page shell. */
export interface ArticlePageSource {
  readonly body: string;
  readonly categoryTitle: string;
  readonly children: ReactNode;
  readonly metadata: ArticleMetadata;
  readonly references: readonly ArticleReference[];
  readonly sourceUrl: null | string;
}

/** Caches one exact published-ownership decision under content invalidation. */
async function readPublishedOwner(input: ArticleSourceInput) {
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
async function readPreviewOwner(input: ArticleSourceInput) {
  if (!hasPreviewConfig()) {
    return Option.none<ArticlePreviewContent>();
  }

  await connection();
  return Effect.runPromise(readArticlePreview(input));
}

/** Selects one exclusive article owner before any native module import. */
async function resolveArticleOwner(
  input: ArticleSourceInput
): Promise<PreviewOwner | PublishedOwner | SourceOwner> {
  const preview = await readPreviewOwner(input);
  if (Option.isSome(preview)) {
    return { content: preview.value, kind: "preview" };
  }

  const published = await readPublishedOwner(input);
  if (published.kind === "missing") {
    notFound();
  }
  if (published.kind === "found") {
    return {
      activeReleaseId: published.activeReleaseId,
      kind: "published",
    };
  }
  const category = parseArticleCategory(input.category);
  if (Option.isNone(category)) {
    notFound();
  }
  return { category: category.value, kind: "source" };
}

/** Reads metadata through the same exclusive owner used by page rendering. */
export async function readArticleMetadata(input: ArticleSourceInput) {
  const owner = await resolveArticleOwner(input);
  if (owner.kind === "preview") {
    return {
      categoryTitle: owner.content.categoryTitle,
      metadata: owner.content.metadata,
    };
  }
  if (owner.kind === "published") {
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

  const [{ content }, t] = await Promise.all([
    getArticlePageData({
      ...input,
      category: owner.category,
    }),
    getTranslations({ locale: input.locale, namespace: "Articles" }),
  ]);
  if (!content) {
    notFound();
  }
  return {
    categoryTitle: t(owner.category),
    metadata: content.metadata,
  };
}

/** Loads the body, metadata, references, and immutable source link. */
export async function readArticlePage(
  input: ArticleSourceInput
): Promise<ArticlePageSource> {
  const owner = await resolveArticleOwner(input);
  if (owner.kind === "preview") {
    return {
      ...owner.content,
      sourceUrl: null,
    };
  }
  if (owner.kind === "published") {
    const published = await renderPublishedArticle({
      activeReleaseId: owner.activeReleaseId,
      locale: input.locale,
      publicPath: input.publicPath,
    });

    return {
      body: published.rawMdx,
      categoryTitle: published.categoryTitle,
      children: published.body,
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

  const [{ content, filePath }, module, t] = await Promise.all([
    getArticlePageData({ ...input, category: owner.category }),
    importContentModuleOrNull({
      filePath: `/${input.publicPath}`,
      locale: input.locale,
      source: "article-content-module",
    }),
    getTranslations({ locale: input.locale, namespace: "Articles" }),
  ]);
  if (!(content && module?.default)) {
    notFound();
  }
  const Content = module.default;

  return {
    body: content.body,
    categoryTitle: t(owner.category),
    children: <Content />,
    metadata: content.metadata,
    references: content.references,
    sourceUrl: getGithubUrl({ path: `/packages/contents${filePath}` }),
  };
}
