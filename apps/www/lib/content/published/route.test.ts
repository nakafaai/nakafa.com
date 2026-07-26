// @vitest-environment node

import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readActiveContentRoute } from "@/lib/content/published/route";
import { testArticleProjection } from "@/test/content-article";
import { previewProjection, previewV2Projection } from "@/test/content-preview";
import { readTestRuntimeQuery } from "@/test/runtime-query";

const fetchQueryMock = vi.hoisted(() => vi.fn());
const readQueryMock = vi.hoisted(() => vi.fn());
const activeReleaseId = ReleaseIdSchema.make("release-active");
const input = {
  activeReleaseId,
  family: "material" as const,
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
  readQueryMock.mockImplementation(readTestRuntimeQuery);
});

describe("published content route", () => {
  it("skips route lookup when no content release is active", async () => {
    await expect(
      Effect.runPromise(
        readActiveContentRoute({
          activeReleaseId: null,
          family: input.family,
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
      Effect.runPromise(readActiveContentRoute(input))
    ).resolves.toEqual({
      activeReleaseId: input.activeReleaseId,
      kind: "unmanaged",
    });
    await expect(
      Effect.runPromise(readActiveContentRoute(input))
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
      Effect.runPromise(readActiveContentRoute(input).pipe(Effect.flip))
    ).resolves.toMatchObject({
      _tag: "PublishedReleaseMismatchError",
      actualReleaseId: "release-next",
      expectedReleaseId: activeReleaseId,
    });
    await expect(
      Effect.runPromise(readActiveContentRoute(input).pipe(Effect.flip))
    ).resolves.toMatchObject({
      _tag: "PublishedReleaseMismatchError",
      actualReleaseId: "release-next",
      expectedReleaseId: activeReleaseId,
    });
  });

  it("adapts every retained routed wire without fetching its artifact", async () => {
    for (const projection of [previewV2Projection, previewProjection]) {
      fetchQueryMock.mockResolvedValue({
        activeReleaseId,
        kind: "found",
        projectionJson: JSON.stringify(projection),
      });

      await expect(
        Effect.runPromise(readActiveContentRoute(input))
      ).resolves.toEqual({
        activeReleaseId,
        kind: "found",
        projection,
      });
    }
    expect(fetchQueryMock).toHaveBeenCalledWith(expect.anything(), {
      family: input.family,
      locale: input.locale,
      publicPath: input.publicPath,
    });
    expect(readQueryMock).toHaveBeenCalledWith(
      "contentRelease.ownership.resolve",
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
    });

    await expect(
      Effect.runPromise(readActiveContentRoute(input).pipe(Effect.flip))
    ).resolves.toMatchObject({
      _tag: "PublishedProjectionError",
      locale: input.locale,
      publicPath: input.publicPath,
    });

    fetchQueryMock.mockResolvedValue({
      activeReleaseId,
      kind: "found",
      projectionJson: JSON.stringify(testArticleProjection),
    });
    await expect(
      Effect.runPromise(readActiveContentRoute(input).pipe(Effect.flip))
    ).resolves.toMatchObject({
      _tag: "PublishedProjectionError",
      locale: input.locale,
      publicPath: input.publicPath,
    });

    fetchQueryMock.mockResolvedValue({
      activeReleaseId,
      kind: "found",
      projectionJson: "{",
    });
    await expect(
      Effect.runPromise(readActiveContentRoute(input).pipe(Effect.flip))
    ).resolves.toMatchObject({
      _tag: "PublishedProjectionError",
      locale: input.locale,
      publicPath: input.publicPath,
    });
  });
});
