// @vitest-environment node

import {
  GitCommitShaSchema,
  ReleaseIdSchema,
} from "@nakafa/aksara-contracts/ids";
import { ArticleCategorySchema } from "@nakafa/aksara-contracts/projection/article";
import { Effect, Option } from "effect";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  readArticleMetadata,
  readArticlePage,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/articles/[category]/[slug]/source";
import {
  testArticleArtifact,
  testArticleProjection,
  testArticleSourcePath,
} from "@/test/content-article";

const mocks = vi.hoisted(() => ({
  applyContentRuntimeCache: vi.fn(),
  getActiveContentIdentity: vi.fn(),
  getAksaraUrl: vi.fn(),
  getArticlePageData: vi.fn(),
  getGithubUrl: vi.fn(),
  getPublishedArticle: vi.fn(),
  getTranslations: vi.fn(),
  hasPreviewConfig: vi.fn(),
  importContentModuleOrNull: vi.fn(),
  notFound: vi.fn(),
  readActiveContentRoute: vi.fn(),
  readArticlePreview: vi.fn(),
  renderPublishedArticle: vi.fn(),
  connection: vi.fn(),
}));

vi.mock(
  "@/app/[locale]/(app)/(shared)/(main)/(learn)/articles/[category]/[slug]/runtime",
  () => ({ getArticlePageData: mocks.getArticlePageData })
);
vi.mock("@/lib/content/cache", () => ({
  applyContentRuntimeCache: mocks.applyContentRuntimeCache,
}));
vi.mock("@/lib/content/module", () => ({
  importContentModuleOrNull: mocks.importContentModuleOrNull,
}));
vi.mock("@/lib/content/preview/article", () => ({
  readArticlePreview: mocks.readArticlePreview,
}));
vi.mock("@/lib/content/preview/config", () => ({
  hasPreviewConfig: mocks.hasPreviewConfig,
}));
vi.mock("@/lib/content/published/active", () => ({
  getActiveContentIdentity: mocks.getActiveContentIdentity,
}));
vi.mock("@/lib/content/published/article", () => ({
  getPublishedArticle: mocks.getPublishedArticle,
  renderPublishedArticle: mocks.renderPublishedArticle,
}));
vi.mock("@/lib/content/published/route", () => ({
  readActiveContentRoute: mocks.readActiveContentRoute,
}));
vi.mock("@/lib/utils/github", () => ({
  getAksaraUrl: mocks.getAksaraUrl,
  getGithubUrl: mocks.getGithubUrl,
}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("next/server", () => ({ connection: mocks.connection }));
vi.mock("next-intl/server", () => ({
  getTranslations: mocks.getTranslations,
}));

const activeReleaseId = ReleaseIdSchema.make("release-article");
const sourceRevision = GitCommitShaSchema.make("a".repeat(40));
const input = {
  category: testArticleProjection.category,
  locale: testArticleProjection.locale,
  publicPath: testArticleProjection.publicPath,
  slug: testArticleProjection.articleSlug,
};
const sourceBody = testArticleArtifact.payload.rawMdx;
const sourceData = {
  body: sourceBody,
  metadata: testArticleProjection.metadata,
  references: testArticleProjection.references,
};
const publishedData = {
  artifact: testArticleArtifact,
  projection: testArticleProjection,
};
const renderedData = {
  body: <h2>Political Maneuvers</h2>,
  categoryTitle: testArticleProjection.categoryTitle,
  metadata: testArticleProjection.metadata,
  official: testArticleProjection.official,
  publicPath: testArticleProjection.publicPath,
  rawMdx: sourceBody,
  references: testArticleProjection.references,
  sourcePath: testArticleSourcePath,
  sourceRevision,
};

beforeEach(() => {
  for (const mock of Object.values(mocks)) {
    mock.mockReset();
  }
  mocks.getActiveContentIdentity.mockReturnValue(
    Effect.succeed({ releaseId: activeReleaseId })
  );
  mocks.getArticlePageData.mockResolvedValue({
    content: sourceData,
    filePath: `/${testArticleProjection.publicPath}`,
  });
  mocks.getAksaraUrl.mockReturnValue("https://github.com/aksara/source");
  mocks.getGithubUrl.mockReturnValue("https://github.com/nakafa/source");
  mocks.getPublishedArticle.mockResolvedValue(publishedData);
  mocks.getTranslations.mockResolvedValue((key: string) =>
    key === "politics" ? "Politics" : key
  );
  mocks.hasPreviewConfig.mockReturnValue(true);
  mocks.importContentModuleOrNull.mockResolvedValue({
    /** Represents the reviewed native article module during migration. */
    default: () => <h2>Political Maneuvers</h2>,
  });
  mocks.notFound.mockImplementation(() => {
    throw new Error("not found");
  });
  mocks.connection.mockResolvedValue(undefined);
  mocks.readActiveContentRoute.mockReturnValue(
    Effect.succeed({ activeReleaseId, kind: "unmanaged" })
  );
  mocks.readArticlePreview.mockReturnValue(Effect.succeed(Option.none()));
  mocks.renderPublishedArticle.mockResolvedValue(renderedData);
});

describe("article source ownership", () => {
  it("reads the selected local artifact before persistent ownership", async () => {
    mocks.readArticlePreview.mockReturnValue(
      Effect.succeed(
        Option.some({
          body: sourceBody,
          categoryTitle: testArticleProjection.categoryTitle,
          children: <h2>Local Political Maneuvers</h2>,
          metadata: testArticleProjection.metadata,
          references: testArticleProjection.references,
        })
      )
    );

    await expect(readArticleMetadata(input)).resolves.toEqual({
      categoryTitle: testArticleProjection.categoryTitle,
      metadata: testArticleProjection.metadata,
    });
    const page = await readArticlePage(input);

    expect(page.body).toBe(sourceBody);
    expect(renderToStaticMarkup(page.children)).toBe(
      "<h2>Local Political Maneuvers</h2>"
    );
    expect(page.sourceUrl).toBeNull();
    expect(mocks.getActiveContentIdentity).not.toHaveBeenCalled();
    expect(mocks.readActiveContentRoute).not.toHaveBeenCalled();
    expect(mocks.getArticlePageData).not.toHaveBeenCalled();
    expect(mocks.renderPublishedArticle).not.toHaveBeenCalled();
    expect(mocks.connection).toHaveBeenCalledTimes(2);
  });

  it("never starts the preview runtime during production prerender", async () => {
    mocks.hasPreviewConfig.mockReturnValue(false);

    await expect(readArticleMetadata(input)).resolves.toEqual({
      categoryTitle: testArticleProjection.categoryTitle,
      metadata: testArticleProjection.metadata,
    });

    expect(mocks.connection).not.toHaveBeenCalled();
    expect(mocks.readArticlePreview).not.toHaveBeenCalled();
  });

  it("reads an unmanaged article only through the current source owner", async () => {
    await expect(readArticleMetadata(input)).resolves.toEqual({
      categoryTitle: testArticleProjection.categoryTitle,
      metadata: testArticleProjection.metadata,
    });
    const page = await readArticlePage(input);

    expect(page.body).toBe(sourceBody);
    expect(renderToStaticMarkup(page.children)).toBe(
      "<h2>Political Maneuvers</h2>"
    );
    expect(page.sourceUrl).toBe("https://github.com/nakafa/source");
    expect(mocks.getPublishedArticle).not.toHaveBeenCalled();
    expect(mocks.renderPublishedArticle).not.toHaveBeenCalled();
  });

  it("reads an owned article only through its signed Aksara release", async () => {
    mocks.readActiveContentRoute.mockReturnValue(
      Effect.succeed({ activeReleaseId, kind: "found" })
    );

    await expect(readArticleMetadata(input)).resolves.toEqual({
      categoryTitle: testArticleProjection.categoryTitle,
      metadata: testArticleProjection.metadata,
    });
    const page = await readArticlePage(input);

    expect(page.body).toBe(sourceBody);
    expect(renderToStaticMarkup(page.children)).toBe(
      "<h2>Political Maneuvers</h2>"
    );
    expect(page.sourceUrl).toBe("https://github.com/aksara/source");
    expect(mocks.getArticlePageData).not.toHaveBeenCalled();
    expect(mocks.importContentModuleOrNull).not.toHaveBeenCalled();
  });

  it("never falls back after an owned article is deleted", async () => {
    mocks.readActiveContentRoute.mockReturnValue(
      Effect.succeed({ activeReleaseId, kind: "missing" })
    );

    await expect(readArticlePage(input)).rejects.toThrow("not found");

    expect(mocks.getArticlePageData).not.toHaveBeenCalled();
    expect(mocks.importContentModuleOrNull).not.toHaveBeenCalled();
    expect(mocks.renderPublishedArticle).not.toHaveBeenCalled();
  });

  it("rejects unmanaged categories that the current source does not own", async () => {
    await expect(
      readArticlePage({
        ...input,
        category: ArticleCategorySchema.make("future-category"),
      })
    ).rejects.toThrow("not found");

    expect(mocks.getArticlePageData).not.toHaveBeenCalled();
    expect(mocks.importContentModuleOrNull).not.toHaveBeenCalled();
  });

  it("rejects missing current metadata and body modules without fallback", async () => {
    mocks.getArticlePageData.mockResolvedValueOnce({
      content: null,
      filePath: `/${testArticleProjection.publicPath}`,
    });
    await expect(readArticleMetadata(input)).rejects.toThrow("not found");

    mocks.importContentModuleOrNull.mockResolvedValueOnce(null);
    await expect(readArticlePage(input)).rejects.toThrow("not found");
  });

  it("keeps rollback provenance absent instead of inventing a source link", async () => {
    mocks.readActiveContentRoute.mockReturnValue(
      Effect.succeed({ activeReleaseId, kind: "found" })
    );
    mocks.renderPublishedArticle.mockResolvedValue({
      ...renderedData,
      sourceRevision: null,
    });

    await expect(readArticlePage(input)).resolves.toMatchObject({
      sourceUrl: null,
    });
    expect(mocks.getAksaraUrl).not.toHaveBeenCalled();
  });
});
