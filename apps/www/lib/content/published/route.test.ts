// @vitest-environment node

import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readActiveMaterialRoute } from "@/lib/content/published/route";
import { previewProjection, previewPublicRoute } from "@/test/content-preview";

const fetchQueryMock = vi.hoisted(() => vi.fn());
const readQueryMock = vi.hoisted(() => vi.fn());
const input = {
  locale: "en" as const,
  publicPath: previewProjection.publicPath,
};

vi.mock("server-only", () => ({}));
vi.mock("@/lib/content/runtime/query", () => ({
  fetchRuntimeQuery: fetchQueryMock,
  readRuntimeQuery: readQueryMock,
}));

beforeEach(() => {
  fetchQueryMock.mockReset();
  readQueryMock.mockReset();
  readQueryMock.mockImplementation(
    (_name: string, read: () => Promise<unknown>) =>
      Effect.tryPromise({ catch: () => new Error("read"), try: read })
  );
});

describe("published material route", () => {
  it("passes unmanaged and owned absence through without projection fallback", async () => {
    fetchQueryMock
      .mockResolvedValueOnce({ kind: "unmanaged" })
      .mockResolvedValueOnce({ kind: "missing" });

    await expect(
      Effect.runPromise(readActiveMaterialRoute(input))
    ).resolves.toEqual({ kind: "unmanaged" });
    await expect(
      Effect.runPromise(readActiveMaterialRoute(input))
    ).resolves.toEqual({ kind: "missing" });
  });

  it("adapts a found active projection without fetching its artifact", async () => {
    fetchQueryMock.mockResolvedValue({
      activeReleaseId: "release-active",
      kind: "found",
      projectionJson: JSON.stringify(previewProjection),
      rendererDomain: "mathematics",
    });

    await expect(
      Effect.runPromise(readActiveMaterialRoute(input))
    ).resolves.toEqual({
      activeReleaseId: "release-active",
      kind: "found",
      rendererDomain: "mathematics",
      route: previewPublicRoute,
    });
    expect(fetchQueryMock).toHaveBeenCalledWith(expect.anything(), input);
    expect(readQueryMock).toHaveBeenCalledWith(
      "contentRelease.material.resolve",
      expect.any(Function)
    );
  });

  it("surfaces malformed stored projections as typed integrity failures", async () => {
    fetchQueryMock.mockResolvedValue({
      activeReleaseId: "release-active",
      kind: "found",
      projectionJson: JSON.stringify({
        ...previewProjection,
        publicPath: "subjects/mathematics/unrelated",
      }),
      rendererDomain: "mathematics",
    });

    await expect(
      Effect.runPromise(readActiveMaterialRoute(input).pipe(Effect.flip))
    ).resolves.toMatchObject({
      _tag: "PublishedProjectionError",
      ...input,
    });

    fetchQueryMock.mockResolvedValue({
      activeReleaseId: "release-active",
      kind: "found",
      projectionJson: "{",
      rendererDomain: "mathematics",
    });
    await expect(
      Effect.runPromise(readActiveMaterialRoute(input).pipe(Effect.flip))
    ).resolves.toMatchObject({
      _tag: "PublishedProjectionError",
      ...input,
    });
  });
});
