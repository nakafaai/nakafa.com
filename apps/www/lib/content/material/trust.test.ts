// @vitest-environment node

import { api } from "@repo/backend/convex/_generated/api";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPublishedTrustLesson,
  readPublishedTrustLesson,
} from "@/lib/content/material/trust";

const runtimeQueryMock = vi.hoisted(() => vi.fn());
const cacheMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/content/cache", () => ({
  applyPublishedCatalogCache: cacheMock,
}));
vi.mock("@/lib/content/runtime/query", async () => {
  const { createTestRuntimeQuery } = await import("@/test/runtime-query");
  return {
    readRuntimeQuery: createTestRuntimeQuery(runtimeQueryMock),
  };
});

describe("published marketing trust lesson", () => {
  beforeEach(() => {
    runtimeQueryMock.mockReset();
    cacheMock.mockReset();
  });

  it("resolves the current signed route from its stable lesson identity", async () => {
    runtimeQueryMock.mockResolvedValueOnce({
      activeReleaseId: "release-material",
      managed: true,
      publicPath:
        "subjects/mathematics/exponential-logarithm/current-basic-concept",
    });

    await expect(getPublishedTrustLesson("en")).resolves.toEqual({
      lessonHref:
        "/en/subjects/mathematics/exponential-logarithm/current-basic-concept",
      sourceHref:
        "/en/subjects/mathematics/exponential-logarithm/current-basic-concept.md",
    });
    expect(runtimeQueryMock).toHaveBeenCalledWith(
      api.contentRelease.material.identity,
      {
        contentKey:
          "material/lesson/mathematics/exponential-logarithm/basic-concept",
        appLocale: "en",
        expectedMaterialKey: "lesson.mathematics.exponential-logarithm",
        expectedSectionKey: "basic-concept",
      }
    );
    expect(cacheMock).toHaveBeenCalledWith("material");
  });

  it.each([
    ["unmanaged", false, null],
    ["missing", true, null],
    ["malformed", true, "/copied/path"],
  ])(
    "rejects a %s signed identity without a copied route",
    async (_name, managed, publicPath) => {
      runtimeQueryMock.mockResolvedValueOnce({
        activeReleaseId: managed ? "release-material" : null,
        managed,
        publicPath,
      });

      await expect(
        Effect.runPromise(readPublishedTrustLesson("en").pipe(Effect.flip))
      ).resolves.toMatchObject({
        _tag: "PublishedProjectionError",
        appLocale: "en",
        publicPath: "marketing/trust",
      });
    }
  );
});
