// @vitest-environment node

import { readFile } from "node:fs/promises";
import {
  GitCommitShaSchema,
  ReleaseIdSchema,
} from "@nakafa/aksara-contracts/ids";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readPublishedArticle } from "@/lib/content/published/article";
import { readPublishedMaterial } from "@/lib/content/published/material";
import { rendererManifest } from "@/lib/content/renderer/manifest";
import { getCachedPublishedText } from "@/lib/llms/published";
import {
  testArticleArtifact,
  testArticleProjection,
  testArticleSourcePath,
} from "@/test/content-article";
import {
  previewMetadata,
  previewPublicRoute,
  previewSourcePath,
  previewWireArtifact,
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
  rendererManifest: liveRenderer,
  route: previewPublicRoute,
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
  readArticleMock.mockReset().mockReturnValue(Effect.succeed(articleData));
  readMaterialMock.mockReset();
  readMaterialMock.mockReturnValue(Effect.succeed(materialData));
});

describe("published llms markdown", () => {
  it("projects verified source with immutable provenance and exact cache tags", async () => {
    const text = await getCachedPublishedText({
      activeReleaseId: materialData.activeReleaseId,
      family: "material",
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
      activeReleaseId: materialData.activeReleaseId,
      family: "material",
      locale: "en",
      publicPath: previewPublicRoute.publicPath,
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
      family: "article",
      locale: "en",
      publicPath: testArticleProjection.publicPath,
    });

    expect(text).toContain(testArticleProjection.metadata.description);
    expect(text).toContain(testArticleArtifact.payload.rawMdx);
    expect(readPublishedArticle).toHaveBeenCalledWith({
      activeReleaseId: articleData.activeReleaseId,
      family: "article",
      locale: "en",
      publicPath: testArticleProjection.publicPath,
    });
    expect(cacheTagMock).toHaveBeenCalledWith(
      "content-runtime",
      "content-family:article",
      `content-artifact:${testArticleArtifact.artifactHash}`
    );
  });

  it("omits source links for rollback state without an exact Git revision", async () => {
    readMaterialMock.mockReturnValueOnce(
      Effect.succeed({ ...materialData, sourceRevision: null })
    );
    const text = await getCachedPublishedText({
      activeReleaseId: materialData.activeReleaseId,
      family: "material",
      locale: "en",
      publicPath: previewPublicRoute.publicPath,
    });

    expect(text).not.toContain("Source:");
  });

  it("preserves real source when semantic projection cannot parse it", async () => {
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
    const text = await getCachedPublishedText({
      activeReleaseId: materialData.activeReleaseId,
      family: "material",
      locale: "en",
      publicPath: previewPublicRoute.publicPath,
    });

    expect(text).toContain("What is a Function?");
  });
});
