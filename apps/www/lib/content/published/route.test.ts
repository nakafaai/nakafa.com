// @vitest-environment node

import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readActiveMaterialRoute } from "@/lib/content/published/route";
import { previewProjection, previewPublicRoute } from "@/test/content-preview";

const fetchQueryMock = vi.hoisted(() => vi.fn());
const readQueryMock = vi.hoisted(() => vi.fn());
const activeReleaseId = ReleaseIdSchema.make("release-active");
const input = {
  activeReleaseId,
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
  it("skips route lookup when no content release is active", async () => {
    await expect(
      Effect.runPromise(
        readActiveMaterialRoute({
          activeReleaseId: null,
          locale: input.locale,
          publicPath: input.publicPath,
        })
      )
    ).resolves.toEqual({
      activeReleaseId: null,
      kind: "unmanaged",
    });
    expect(readQueryMock).not.toHaveBeenCalled();
    expect(fetchQueryMock).not.toHaveBeenCalled();
  });

  it("passes unmanaged and owned absence through without projection fallback", async () => {
    fetchQueryMock
      .mockResolvedValueOnce({
        activeReleaseId: input.activeReleaseId,
        kind: "unmanaged",
      })
      .mockResolvedValueOnce({
        activeReleaseId: input.activeReleaseId,
        kind: "missing",
      });

    await expect(
      Effect.runPromise(readActiveMaterialRoute(input))
    ).resolves.toEqual({
      activeReleaseId: input.activeReleaseId,
      kind: "unmanaged",
    });
    await expect(
      Effect.runPromise(readActiveMaterialRoute(input))
    ).resolves.toEqual({
      activeReleaseId: input.activeReleaseId,
      kind: "missing",
    });
  });

  it("fails when ownership changes after the caller reads active identity", async () => {
    const nextReleaseId = ReleaseIdSchema.make("release-next");
    fetchQueryMock
      .mockResolvedValueOnce({
        activeReleaseId: nextReleaseId,
        kind: "unmanaged",
      })
      .mockResolvedValueOnce({
        activeReleaseId: nextReleaseId,
        kind: "missing",
      });

    await expect(
      Effect.runPromise(readActiveMaterialRoute(input).pipe(Effect.flip))
    ).resolves.toMatchObject({
      _tag: "PublishedReleaseMismatchError",
      actualReleaseId: "release-next",
      expectedReleaseId: activeReleaseId,
    });
    await expect(
      Effect.runPromise(readActiveMaterialRoute(input).pipe(Effect.flip))
    ).resolves.toMatchObject({
      _tag: "PublishedReleaseMismatchError",
      actualReleaseId: "release-next",
      expectedReleaseId: activeReleaseId,
    });
  });

  it("adapts a found active projection without fetching its artifact", async () => {
    fetchQueryMock.mockResolvedValue({
      activeReleaseId,
      kind: "found",
      projectionJson: JSON.stringify(previewProjection),
      rendererDomain: "mathematics",
    });

    await expect(
      Effect.runPromise(readActiveMaterialRoute(input))
    ).resolves.toEqual({
      activeReleaseId,
      kind: "found",
      rendererDomain: "mathematics",
      route: previewPublicRoute,
    });
    expect(fetchQueryMock).toHaveBeenCalledWith(expect.anything(), {
      locale: input.locale,
      publicPath: input.publicPath,
    });
    expect(readQueryMock).toHaveBeenCalledWith(
      "contentRelease.material.resolve",
      expect.any(Function)
    );
  });

  it("surfaces malformed stored projections as typed integrity failures", async () => {
    fetchQueryMock.mockResolvedValue({
      activeReleaseId,
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
      locale: input.locale,
      publicPath: input.publicPath,
    });

    fetchQueryMock.mockResolvedValue({
      activeReleaseId,
      kind: "found",
      projectionJson: "{",
      rendererDomain: "mathematics",
    });
    await expect(
      Effect.runPromise(readActiveMaterialRoute(input).pipe(Effect.flip))
    ).resolves.toMatchObject({
      _tag: "PublishedProjectionError",
      locale: input.locale,
      publicPath: input.publicPath,
    });
  });
});
