// @vitest-environment node

import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readActiveContentRoute } from "@/lib/content/published/route";
import { testArticleProjection } from "@/test/content-article";
import { previewProjection } from "@/test/content-preview";
import { createTestRuntimeQuery } from "@/test/runtime-query";

const fetchQueryMock = vi.hoisted(() => vi.fn());
const readQueryMock = vi.hoisted(() => vi.fn());
const activeReleaseId = ReleaseIdSchema.make("release-active");
const input = {
  activeReleaseId,
  appLocale: previewProjection.appLocale,
  family: "material" as const,
  publicPath: previewProjection.publicPath,
};

vi.mock("@/lib/content/runtime/query", () => ({
  readRuntimeQuery: readQueryMock,
}));

beforeEach(() => {
  fetchQueryMock.mockReset();
  readQueryMock.mockReset();
  readQueryMock.mockImplementation(createTestRuntimeQuery(fetchQueryMock));
});

describe("published content route", () => {
  it("skips route lookup when no content release is active", async () => {
    await expect(
      Effect.runPromise(
        readActiveContentRoute({
          activeReleaseId: null,
          appLocale: input.appLocale,
          family: input.family,
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

  it("decodes the canonical routed projection without fetching its artifact", async () => {
    fetchQueryMock.mockResolvedValue({
      activeReleaseId,
      kind: "found",
      projectionJson: JSON.stringify(previewProjection),
    });

    await expect(
      Effect.runPromise(readActiveContentRoute(input))
    ).resolves.toEqual({
      activeReleaseId,
      kind: "found",
      projection: previewProjection,
    });
    expect(fetchQueryMock).toHaveBeenCalledWith(expect.anything(), {
      appLocale: input.appLocale,
      family: input.family,
      publicPath: input.publicPath,
    });
    expect(readQueryMock).toHaveBeenCalledWith(expect.anything(), {
      appLocale: input.appLocale,
      family: input.family,
      publicPath: input.publicPath,
    });
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
      appLocale: input.appLocale,
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
      appLocale: input.appLocale,
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
      appLocale: input.appLocale,
      publicPath: input.publicPath,
    });
  });
});
