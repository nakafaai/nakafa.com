// @vitest-environment node

import {
  GitCommitShaSchema,
  ReleaseIdSchema,
} from "@nakafa/aksara-contracts/ids";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { Effect } from "effect";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPublishedArticle,
  readPublishedArticle,
  renderPublishedArticle,
} from "@/lib/content/published/article";
import { executeSignedArtifact } from "@/lib/content/published/artifact";
import { getRendererComponents } from "@/lib/content/renderer/components";
import { rendererManifest } from "@/lib/content/renderer/manifest";
import {
  testArticleArtifact,
  testArticleProjection,
  testArticleSourcePath,
} from "@/test/content-article";

const cacheLifeMock = vi.hoisted(() => vi.fn());
const cacheTagMock = vi.hoisted(() => vi.fn());
const executeMock = vi.hoisted(() => vi.fn());
const readContentMock = vi.hoisted(() => vi.fn());
const registryMock = vi.hoisted(() => vi.fn());
const components = {};
const liveRenderer = await Effect.runPromise(rendererManifest);
const sourceRevision = GitCommitShaSchema.make("a".repeat(40));
const input = {
  activeReleaseId: ReleaseIdSchema.make("release-test-article"),
  locale: "en" as const,
  publicPath: testArticleProjection.publicPath,
};
const data = {
  activeReleaseId: input.activeReleaseId,
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
vi.mock("@/lib/content/published/artifact", () => ({
  executeSignedArtifact: executeMock,
}));
vi.mock("@/lib/content/published/exchange", () => ({
  readPublishedContent: readContentMock,
}));
vi.mock("@/lib/content/renderer/components", () => ({
  getRendererComponents: registryMock,
}));

beforeEach(() => {
  cacheLifeMock.mockReset();
  cacheTagMock.mockReset();
  executeMock.mockReset();
  readContentMock.mockReset();
  registryMock.mockReset().mockReturnValue(components);
  readContentMock.mockReturnValue(Effect.succeed(data));
  executeMock.mockImplementation(
    ({ artifact }: { readonly artifact: unknown }) =>
      ContentVerificationKeyResolver.pipe(
        Effect.as({
          artifact,
          /** Represents the reviewed article after authenticated execution. */
          Content: () => <h2>Political Maneuvers</h2>,
        })
      )
  );
});

describe("published article", () => {
  it("decodes and caches one exact active article", async () => {
    await expect(
      Effect.runPromise(readPublishedArticle(input))
    ).resolves.toEqual(data);
    await expect(getPublishedArticle(input)).resolves.toEqual(data);
    expect(cacheLifeMock).toHaveBeenCalledWith("contentRuntime");
    expect(cacheTagMock).toHaveBeenCalledWith(
      "content-runtime",
      "content-family:article",
      `content-artifact:${testArticleArtifact.artifactHash}`
    );
  });

  it("renders through only the article artifact's physical registry", async () => {
    const content = await renderPublishedArticle(input);

    expect(renderToStaticMarkup(content.body)).toBe(
      "<h2>Political Maneuvers</h2>"
    );
    expect(content).toMatchObject({
      metadata: testArticleProjection.metadata,
      official: false,
      publicPath: testArticleProjection.publicPath,
      rawMdx: testArticleArtifact.payload.rawMdx,
      references: [],
      sourcePath: testArticleSourcePath,
      sourceRevision,
    });
    expect(getRendererComponents).toHaveBeenCalledWith("politics");
    expect(executeSignedArtifact).toHaveBeenCalledWith({
      artifact: testArticleArtifact,
      components,
      rendererContractVersion: "1.0.0",
      rendererManifest: liveRenderer,
    });
  });
});
