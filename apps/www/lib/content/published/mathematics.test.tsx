// @vitest-environment node

import { Effect } from "effect";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  readPublishedMaterial,
  renderPublishedMaterial,
} from "@/lib/content/published/material";
import { renderPublishedMathematics } from "@/lib/content/published/mathematics";
import {
  previewMetadata,
  previewProjection,
  previewPublicRoute,
  previewWireArtifact,
} from "@/test/content-preview";

const cacheLifeMock = vi.hoisted(() => vi.fn());
const cacheTagMock = vi.hoisted(() => vi.fn());
const dataMock = vi.hoisted(() => vi.fn());
const renderMock = vi.hoisted(() => vi.fn());
const components = vi.hoisted(() => ({}));
const input = {
  locale: "en" as const,
  publicPath: previewProjection.publicPath,
};
const data = {
  artifact: previewWireArtifact,
  metadata: previewMetadata,
  rendererManifest: { rendererContractVersion: "1.0.0" },
  route: previewPublicRoute,
};

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  cacheLife: cacheLifeMock,
  cacheTag: cacheTagMock,
}));
vi.mock("@repo/design-system/lib/markdown/domain/mathematics", () => ({
  mathematicsComponents: components,
}));
vi.mock("@/lib/content/published/material", () => ({
  readPublishedMaterial: dataMock,
  renderPublishedMaterial: renderMock,
}));

beforeEach(() => {
  cacheLifeMock.mockReset();
  cacheTagMock.mockReset();
  dataMock.mockReset();
  renderMock.mockReset();
  dataMock.mockReturnValue(Effect.succeed(data));
  renderMock.mockReturnValue(
    Effect.succeed({
      body: <h2>Function Concept</h2>,
      metadata: previewMetadata,
      rawMdx: previewWireArtifact.payload.rawMdx,
      route: previewPublicRoute,
    })
  );
});

describe("published mathematics renderer", () => {
  it("caches the exact artifact and supplies only its physical registry", async () => {
    const content = await renderPublishedMathematics(input);

    expect(renderToStaticMarkup(content.body)).toBe(
      "<h2>Function Concept</h2>"
    );
    expect(readPublishedMaterial).toHaveBeenCalledWith(input);
    expect(renderPublishedMaterial).toHaveBeenCalledWith({
      components,
      data,
      rendererDomain: "mathematics",
    });
    expect(cacheLifeMock).toHaveBeenCalledWith("contentRuntime");
    expect(cacheTagMock).toHaveBeenCalledWith(
      "content-runtime",
      "content-family:material",
      `content-artifact:${previewWireArtifact.artifactHash}`
    );
  });
});
