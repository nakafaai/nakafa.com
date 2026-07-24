// @vitest-environment node

import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readPublishedMaterial } from "@/lib/content/published/material";
import { getPublishedMaterialMetadata } from "@/lib/content/published/metadata";
import {
  previewMetadata,
  previewProjection,
  previewPublicRoute,
  previewWireArtifact,
} from "@/test/content-preview";

const cacheLifeMock = vi.hoisted(() => vi.fn());
const cacheTagMock = vi.hoisted(() => vi.fn());
const readMaterialMock = vi.hoisted(() => vi.fn());
const input = {
  locale: "en" as const,
  publicPath: previewProjection.publicPath,
};
const data = {
  artifact: previewWireArtifact,
  metadata: previewMetadata,
  route: previewPublicRoute,
};

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  cacheLife: cacheLifeMock,
  cacheTag: cacheTagMock,
}));
vi.mock("@/lib/content/published/material", () => ({
  readPublishedMaterial: readMaterialMock,
}));

beforeEach(() => {
  cacheLifeMock.mockReset();
  cacheTagMock.mockReset();
  readMaterialMock.mockReset();
  readMaterialMock.mockReturnValue(Effect.succeed(data));
});

describe("published material metadata", () => {
  it("caches only verified metadata and its route under exact tags", async () => {
    await expect(getPublishedMaterialMetadata(input)).resolves.toEqual({
      metadata: previewMetadata,
      route: previewPublicRoute,
    });
    expect(readPublishedMaterial).toHaveBeenCalledWith(input);
    expect(cacheLifeMock).toHaveBeenCalledWith("contentRuntime");
    expect(cacheTagMock).toHaveBeenCalledWith(
      "content-runtime",
      "content-family:material",
      `content-artifact:${previewWireArtifact.artifactHash}`
    );
  });
});
