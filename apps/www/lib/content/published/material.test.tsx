// @vitest-environment node

import {
  GitCommitShaSchema,
  ReleaseIdSchema,
} from "@nakafa/aksara-contracts/ids";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { Effect } from "effect";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeSignedArtifact } from "@/lib/content/published/artifact";
import {
  getPublishedMaterial,
  readPublishedMaterial,
  renderPublishedMaterial,
} from "@/lib/content/published/material";
import { getRendererComponents } from "@/lib/content/renderer/components";
import { rendererManifest } from "@/lib/content/renderer/manifest";
import {
  previewMetadata,
  previewProjection,
  previewPublicRoute,
  previewSourcePath,
  previewWireArtifact,
} from "@/test/content-preview";

const cacheLifeMock = vi.hoisted(() => vi.fn());
const cacheTagMock = vi.hoisted(() => vi.fn());
const executeMock = vi.hoisted(() => vi.fn());
const readContentMock = vi.hoisted(() => vi.fn());
const registryMock = vi.hoisted(() => vi.fn());
const components = {};
const liveRenderer = await Effect.runPromise(rendererManifest);
const sourceRevision = GitCommitShaSchema.make("a".repeat(40));
const input = {
  activeReleaseId: ReleaseIdSchema.make("release-function-concept"),
  locale: "en" as const,
  publicPath: previewProjection.publicPath,
};
const data = {
  activeReleaseId: input.activeReleaseId,
  artifact: previewWireArtifact,
  metadata: previewMetadata,
  rendererManifest: liveRenderer,
  route: previewPublicRoute,
  sourcePath: previewSourcePath,
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
  readContentMock.mockReturnValue(
    Effect.succeed({
      activeReleaseId: data.activeReleaseId,
      artifact: data.artifact,
      projection: previewProjection,
      rendererManifest: data.rendererManifest,
      sourcePath: data.sourcePath,
      sourceRevision: data.sourceRevision,
    })
  );
  executeMock.mockImplementation(
    ({ artifact }: { readonly artifact: unknown }) =>
      ContentVerificationKeyResolver.pipe(
        Effect.as({
          artifact,
          /** Represents one already authenticated compiled document. */
          Content: () => <h2>Function Concept</h2>,
        })
      )
  );
});

describe("published material", () => {
  it("adapts only an exact material projection to the current route shell", async () => {
    await expect(
      Effect.runPromise(readPublishedMaterial(input))
    ).resolves.toEqual(data);
  });

  it("caches verified metadata under the exact artifact identity", async () => {
    await expect(getPublishedMaterial(input)).resolves.toEqual(data);
    expect(cacheLifeMock).toHaveBeenCalledWith("contentRuntime");
    expect(cacheTagMock).toHaveBeenCalledWith(
      "content-runtime",
      "content-family:material",
      `content-artifact:${previewWireArtifact.artifactHash}`
    );
  });

  it("renders JSX through only the selected physical registry", async () => {
    const content = await renderPublishedMaterial(input);

    expect(renderToStaticMarkup(content.body)).toBe(
      "<h2>Function Concept</h2>"
    );
    expect(content).toMatchObject({
      metadata: previewMetadata,
      rawMdx: previewWireArtifact.payload.rawMdx,
      route: previewPublicRoute,
      sourcePath: previewSourcePath,
      sourceRevision,
    });
    expect(getRendererComponents).toHaveBeenCalledWith("mathematics");
    expect(executeSignedArtifact).toHaveBeenCalledWith({
      artifact: previewWireArtifact,
      components,
      rendererContractVersion: "1.0.0",
      rendererManifest: liveRenderer,
    });
    expect("Content" in content).toBe(false);
  });
});
