// @vitest-environment node

import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { ACTIVE_APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import { canonicalizeArticleProjection } from "@nakafa/aksara-contracts/projection/article";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPublishedArticleRoute,
  readPublishedArticleRoute,
} from "@/lib/content/article/route";
import {
  makeTestArticleProjection,
  testArticleDeProjection,
  testArticleIdProjection,
  testArticleProjection,
} from "@/test/content-article";

const runtimeQueryMock = vi.hoisted(() => vi.fn());
const cacheMock = vi.hoisted(() => vi.fn());
const activeReleaseId = ReleaseIdSchema.make("release-article");

vi.mock("@/lib/content/cache", () => ({
  applyPublishedCatalogCache: cacheMock,
}));
vi.mock("@/lib/content/runtime/query", async () => {
  const { createTestRuntimeQuery } = await import("@/test/runtime-query");
  return {
    readRuntimeQuery: createTestRuntimeQuery(runtimeQueryMock),
  };
});

/** Builds one complete backend-verified article model response. */
function foundModel(overrides?: {
  readonly activeAppLocales?: readonly string[];
  readonly activeReleaseId?: null | string;
  readonly alternateJson?: readonly string[];
  readonly projectionJson?: null | string;
}) {
  return {
    activeAppLocales: overrides?.activeAppLocales ?? ACTIVE_APP_LOCALE_CODES,
    activeReleaseId:
      overrides?.activeReleaseId === undefined
        ? activeReleaseId
        : overrides.activeReleaseId,
    alternateJson:
      overrides?.alternateJson ??
      [
        testArticleProjection,
        testArticleIdProjection,
        testArticleDeProjection,
      ].map(canonicalizeArticleProjection),
    projectionJson:
      overrides?.projectionJson === undefined
        ? canonicalizeArticleProjection(testArticleProjection)
        : overrides.projectionJson,
  };
}

beforeEach(() => {
  runtimeQueryMock.mockReset();
  cacheMock.mockReset();
});

describe("published article route", () => {
  it.each([
    testArticleProjection,
    testArticleIdProjection,
    testArticleDeProjection,
  ])(
    "decodes one complete $appLocale route and reciprocal locale set",
    async (projection) => {
      runtimeQueryMock.mockResolvedValueOnce(
        foundModel({
          projectionJson: canonicalizeArticleProjection(projection),
        })
      );

      await expect(
        getPublishedArticleRoute(projection.appLocale, projection.publicPath)
      ).resolves.toEqual({
        activeReleaseId,
        alternates: [
          testArticleProjection,
          testArticleIdProjection,
          testArticleDeProjection,
        ],
        projection,
      });
      expect(cacheMock).toHaveBeenCalledWith("article");
    }
  );

  it("pins a route read to the expected active release", async () => {
    runtimeQueryMock.mockResolvedValueOnce(foundModel());

    await expect(
      getPublishedArticleRoute(
        "en",
        testArticleProjection.publicPath,
        activeReleaseId
      )
    ).resolves.toMatchObject({ activeReleaseId });
    expect(runtimeQueryMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ expectedActiveReleaseId: activeReleaseId })
    );
  });

  it("preserves an active release mismatch for pinned callers", async () => {
    const expectedReleaseId = ReleaseIdSchema.make("release-previous");
    runtimeQueryMock.mockResolvedValueOnce(foundModel());

    await expect(
      Effect.runPromise(
        readPublishedArticleRoute(
          "en",
          testArticleProjection.publicPath,
          expectedReleaseId
        ).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({
      _tag: "PublishedReleaseMismatchError",
      actualReleaseId: activeReleaseId,
      expectedReleaseId,
    });
  });

  it("preserves a signed missing-route tombstone", async () => {
    runtimeQueryMock.mockResolvedValueOnce(
      foundModel({ alternateJson: [], projectionJson: null })
    );

    await expect(
      Effect.runPromise(
        readPublishedArticleRoute("en", testArticleProjection.publicPath)
      )
    ).resolves.toEqual({
      activeReleaseId,
      alternates: [],
      projection: null,
    });
  });

  it.each([
    ["active locales", foundModel({ activeAppLocales: ["id", "en", "de"] })],
    ["missing release", foundModel({ activeReleaseId: null })],
    [
      "current route",
      foundModel({
        projectionJson: canonicalizeArticleProjection(testArticleIdProjection),
      }),
    ],
    [
      "complete locale set",
      foundModel({
        alternateJson: [canonicalizeArticleProjection(testArticleProjection)],
      }),
    ],
    [
      "duplicate locale",
      foundModel({
        alternateJson: [
          canonicalizeArticleProjection(testArticleProjection),
          canonicalizeArticleProjection(testArticleProjection),
        ],
      }),
    ],
    [
      "counterpart",
      foundModel({
        alternateJson: [
          canonicalizeArticleProjection(testArticleProjection),
          canonicalizeArticleProjection(
            makeTestArticleProjection("another-article")
          ),
        ],
      }),
    ],
    ["projection JSON", foundModel({ projectionJson: "{}" })],
    ["alternate JSON", foundModel({ alternateJson: ["{}"] })],
  ])("rejects an invalid %s", async (_label, result) => {
    runtimeQueryMock.mockResolvedValueOnce(result);

    await expect(
      Effect.runPromise(
        readPublishedArticleRoute("en", testArticleProjection.publicPath).pipe(
          Effect.flip
        )
      )
    ).resolves.toMatchObject({ _tag: "PublishedProjectionError" });
  });
});
