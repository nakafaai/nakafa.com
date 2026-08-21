// @vitest-environment node

import {
  GitCommitShaSchema,
  ReleaseIdSchema,
} from "@nakafa/aksara-contracts/ids";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readPublishedPage } from "@/lib/content/page/published";
import { readPublishedArticle } from "@/lib/content/published/article";
import { readPublishedMaterial } from "@/lib/content/published/material";
import { rendererManifest } from "@/lib/content/renderer/manifest";
import { getCachedPublishedText } from "@/lib/llms/published";
import {
  testArticleArtifact,
  testArticleProjection,
  testArticleSourcePath,
} from "@/test/content-article";
import { testPageArtifact, testPageProjection } from "@/test/content-page";
import {
  previewMetadata,
  previewProjection,
  previewSourcePath,
  previewWireArtifact,
} from "@/test/content-preview";

const cacheLifeMock = vi.hoisted(() => vi.fn());
const cacheTagMock = vi.hoisted(() => vi.fn());
const readArticleMock = vi.hoisted(() => vi.fn());
const readMaterialMock = vi.hoisted(() => vi.fn());
const readPageMock = vi.hoisted(() => vi.fn());
const liveRenderer = await Effect.runPromise(rendererManifest);
const sourceRevision = GitCommitShaSchema.make("a".repeat(40));
const rawMdx = `## What is a Function?

A function maps one input to exactly one output.

<FunctionMachine />`;
const materialData = {
  activeReleaseId: ReleaseIdSchema.make("release-function-concept"),
  artifact: {
    ...previewWireArtifact,
    payload: {
      ...previewWireArtifact.payload,
      rawMdx,
    },
  },
  metadata: previewMetadata,
  projection: previewProjection,
  rendererManifest: liveRenderer,
  sourcePath: previewSourcePath,
  sourceRevision,
};
const articleData = {
  activeReleaseId: ReleaseIdSchema.make("release-article"),
  artifact: testArticleArtifact,
  projection: testArticleProjection,
  rendererManifest: liveRenderer,
  sourcePath: testArticleSourcePath,
  sourceRevision,
};
const pageData = {
  activeReleaseId: ReleaseIdSchema.make("release-pages"),
  artifact: testPageArtifact,
  projection: testPageProjection,
  rendererManifest: liveRenderer,
  sourcePath: testPageProjection.sourcePath,
  sourceRevision,
};
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
vi.mock("@/lib/content/page/published", () => ({
  readPublishedPage: readPageMock,
}));
beforeEach(() => {
  cacheLifeMock.mockReset();
  cacheTagMock.mockReset();
  readArticleMock.mockReset().mockReturnValue(Effect.succeed(articleData));
  readMaterialMock.mockReset();
  readMaterialMock.mockReturnValue(Effect.succeed(materialData));
  readPageMock.mockReset().mockReturnValue(Effect.succeed(pageData));
});

describe("published llms markdown", () => {
  it("projects verified source with immutable provenance and exact cache tags", async () => {
    const text = await getCachedPublishedText({
      activeReleaseId: materialData.activeReleaseId,
      appLocale: previewProjection.appLocale,
      family: "material",
      publicPath: previewProjection.publicPath,
    });

    expect(text).toContain(previewMetadata.description);
    expect(text).toContain("What is a Function?");
    expect(text).toContain("Component: FunctionMachine");
    expect(text).toContain(
      `https://raw.githubusercontent.com/nakafaai/aksara/${sourceRevision}/${previewSourcePath}`
    );
    expect(readPublishedMaterial).toHaveBeenCalledWith({
      activeReleaseId: materialData.activeReleaseId,
      appLocale: previewProjection.appLocale,
      family: "material",
      publicPath: previewProjection.publicPath,
    });
    expect(cacheLifeMock).toHaveBeenCalledWith("contentRuntime");
    expect(cacheTagMock).toHaveBeenCalledWith(
      "content-runtime",
      "content-family:material",
      `content-artifact:${materialData.artifact.artifactHash}`
    );
  });

  it("selects article metadata and provenance through the same cache seam", async () => {
    const text = await getCachedPublishedText({
      activeReleaseId: articleData.activeReleaseId,
      appLocale: testArticleProjection.appLocale,
      family: "article",
      publicPath: testArticleProjection.publicPath,
    });

    expect(text).toContain(testArticleProjection.metadata.description);
    expect(text).toContain(testArticleArtifact.payload.rawMdx);
    expect(readPublishedArticle).toHaveBeenCalledWith({
      activeReleaseId: articleData.activeReleaseId,
      appLocale: testArticleProjection.appLocale,
      family: "article",
      publicPath: testArticleProjection.publicPath,
    });
    expect(cacheTagMock).toHaveBeenCalledWith(
      "content-runtime",
      "content-family:article",
      `content-artifact:${testArticleArtifact.artifactHash}`
    );
  });

  it("selects signed Page metadata and provenance without filesystem fallback", async () => {
    const text = await getCachedPublishedText({
      activeReleaseId: pageData.activeReleaseId,
      appLocale: testPageProjection.appLocale,
      family: "page",
      publicPath: testPageProjection.publicPath,
    });

    expect(text).toContain(testPageProjection.metadata.description);
    expect(text).toContain(testPageArtifact.payload.rawMdx);
    expect(readPublishedPage).toHaveBeenCalledWith({
      activeReleaseId: pageData.activeReleaseId,
      appLocale: testPageProjection.appLocale,
      family: "page",
      publicPath: testPageProjection.publicPath,
    });
    expect(cacheTagMock).toHaveBeenCalledWith(
      "content-runtime",
      "content-family:page",
      `content-artifact:${testPageArtifact.artifactHash}`
    );
  });

  it("omits source links for rollback state without an exact Git revision", async () => {
    readMaterialMock.mockReturnValueOnce(
      Effect.succeed({ ...materialData, sourceRevision: null })
    );
    const text = await getCachedPublishedText({
      activeReleaseId: materialData.activeReleaseId,
      appLocale: previewProjection.appLocale,
      family: "material",
      publicPath: previewProjection.publicPath,
    });

    expect(text).not.toContain("Source:");
  });

  it("fails closed when semantic projection cannot parse signed source", async () => {
    const incompleteMdx = `${rawMdx}\n{`;
    readMaterialMock.mockReturnValueOnce(
      Effect.succeed({
        ...materialData,
        artifact: {
          ...materialData.artifact,
          payload: {
            ...materialData.artifact.payload,
            rawMdx: incompleteMdx,
          },
        },
      })
    );
    await expect(
      getCachedPublishedText({
        activeReleaseId: materialData.activeReleaseId,
        appLocale: previewProjection.appLocale,
        family: "material",
        publicPath: previewProjection.publicPath,
      })
    ).rejects.toThrow("Unexpected end of file in expression");
  });
});
