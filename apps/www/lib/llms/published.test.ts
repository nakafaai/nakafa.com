// @vitest-environment node

import { readFile } from "node:fs/promises";
import {
  ContentKeySchema,
  CorpusSourcePathSchema,
  GitCommitShaSchema,
  PublicPathSchema,
  ReleaseIdSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  ArticleProjectionSchema,
  ArticleSlugSchema,
} from "@nakafa/aksara-contracts/projection/article";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readPublishedArticle } from "@/lib/content/published/article";
import { readPublishedMaterial } from "@/lib/content/published/material";
import { rendererManifest } from "@/lib/content/renderer/manifest";
import {
  getCachedPublishedArticleText,
  getCachedPublishedMaterialText,
} from "@/lib/llms/published";
import {
  previewMetadata,
  previewPublicRoute,
  previewSourcePath,
  previewWireArtifact,
  makeArticleGraph,
} from "@/test/content-preview";

const cacheLifeMock = vi.hoisted(() => vi.fn());
const cacheTagMock = vi.hoisted(() => vi.fn());
const readArticleMock = vi.hoisted(() => vi.fn());
const readMaterialMock = vi.hoisted(() => vi.fn());
const liveRenderer = await Effect.runPromise(rendererManifest);
const sourceRevision = GitCommitShaSchema.make("a".repeat(40));
const functionRoot = new URL(
  "../../../../packages/contents/material/lesson/mathematics/function-composition-inverse-function/function-concept/en.mdx",
  import.meta.url
);
const functionSource = await readFile(functionRoot, "utf8");
const rawMdx = functionSource.slice(functionSource.indexOf("\n\n") + 2);
const articleRoot = new URL(
  "../../../../packages/contents/articles/politics/dynastic-politics-asian-values/en.mdx",
  import.meta.url
);
const articleSource = await readFile(articleRoot, "utf8");
const articleRawMdx = articleSource.slice(articleSource.indexOf("\n\n") + 2);
const data = {
  activeReleaseId: ReleaseIdSchema.make("release-function-concept"),
  artifact: {
    ...previewWireArtifact,
    payload: {
      ...previewWireArtifact.payload,
      rawMdx,
    },
  },
  metadata: previewMetadata,
  rendererManifest: liveRenderer,
  route: previewPublicRoute,
  sourcePath: previewSourcePath,
  sourceRevision,
};
const articlePath = PublicPathSchema.make(
  "articles/politics/dynastic-politics-asian-values"
);
const articleProjection = ArticleProjectionSchema.make({
  articleSlug: ArticleSlugSchema.make("dynastic-politics-asian-values"),
  category: "politics",
  contentKey: ContentKeySchema.make(articlePath),
  graph: makeArticleGraph("dynastic-politics-asian-values", "en"),
  kind: "article",
  locale: "en",
  metadata: {
    authors: [{ name: "Nabil Akbarazzima Fatih" }],
    date: "2024-09-20",
    description:
      "Political dynasties are growing. Their influence brings risks to democracy and good governance.",
    title: "Dynastic Politics and Asian Values",
  },
  official: true,
  parentPath: PublicPathSchema.make("articles/politics"),
  publicPath: articlePath,
  references: [],
  sitemap: true,
});
const articleData = {
  ...data,
  artifact: {
    ...data.artifact,
    payload: {
      ...data.artifact.payload,
      contentKey: articleProjection.contentKey,
      rawMdx: articleRawMdx,
      rendererDomain: "politics" as const,
    },
  },
  projection: articleProjection,
  sourcePath: CorpusSourcePathSchema.make(
    "packages/corpus/articles/politics/dynastic-politics/asian-values/en.mdx"
  ),
};

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  cacheLife: cacheLifeMock,
  cacheTag: cacheTagMock,
}));
vi.mock("@/lib/content/published/material", () => ({
  readPublishedMaterial: readMaterialMock,
}));
vi.mock("@/lib/content/published/article", () => ({
  readPublishedArticle: readArticleMock,
}));

beforeEach(() => {
  cacheLifeMock.mockReset();
  cacheTagMock.mockReset();
  readArticleMock.mockReset();
  readMaterialMock.mockReset();
  readArticleMock.mockReturnValue(Effect.succeed(articleData));
  readMaterialMock.mockReturnValue(Effect.succeed(data));
});

describe("published llms markdown", () => {
  it("projects verified source with immutable provenance and exact cache tags", async () => {
    const text = await getCachedPublishedMaterialText({
      locale: "en",
      publicPath: previewPublicRoute.publicPath,
    });

    expect(text).toContain(previewMetadata.description);
    expect(text).toContain("What is a Function?");
    expect(text).toContain("Component: FunctionMachine");
    expect(text).toContain(
      `https://raw.githubusercontent.com/nakafaai/aksara/${sourceRevision}/${previewSourcePath}`
    );
    expect(readPublishedMaterial).toHaveBeenCalledWith({
      locale: "en",
      publicPath: previewPublicRoute.publicPath,
    });
    expect(cacheLifeMock).toHaveBeenCalledWith("contentRuntime");
    expect(cacheTagMock).toHaveBeenCalledWith(
      "content-runtime",
      "content-family:material",
      `content-artifact:${data.artifact.artifactHash}`
    );
  });

  it("omits source links for rollback state without an exact Git revision", async () => {
    readMaterialMock.mockReturnValueOnce(
      Effect.succeed({ ...data, sourceRevision: null })
    );
    const text = await getCachedPublishedMaterialText({
      locale: "en",
      publicPath: previewPublicRoute.publicPath,
    });

    expect(text).not.toContain("Source:");
  });

  it("preserves real source when semantic projection cannot parse it", async () => {
    const incompleteMdx = `${rawMdx}\n{`;
    readMaterialMock.mockReturnValueOnce(
      Effect.succeed({
        ...data,
        artifact: {
          ...data.artifact,
          payload: { ...data.artifact.payload, rawMdx: incompleteMdx },
        },
      })
    );
    const text = await getCachedPublishedMaterialText({
      locale: "en",
      publicPath: previewPublicRoute.publicPath,
    });

    expect(text).toContain("What is a Function?");
  });

  it("projects a verified article with its exact Aksara source", async () => {
    const text = await getCachedPublishedArticleText({
      locale: "en",
      publicPath: articlePath,
    });

    expect(text).toContain("Dynastic Politics");
    expect(text).toContain(
      `https://raw.githubusercontent.com/nakafaai/aksara/${sourceRevision}/${articleData.sourcePath}`
    );
    expect(readPublishedArticle).toHaveBeenCalledWith({
      locale: "en",
      publicPath: articlePath,
    });
    expect(cacheTagMock).toHaveBeenCalledWith(
      "content-runtime",
      "content-family:article",
      `content-artifact:${articleData.artifact.artifactHash}`
    );
  });
});
