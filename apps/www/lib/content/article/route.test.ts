// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { ACTIVE_APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import { canonicalizeArticleProjection } from "@nakafa/aksara-contracts/projection/article";
import { createTestPublication } from "@repo/backend/test/content/publication";
import { testLocalizedArticleProjection } from "@repo/backend/test/content/runtime";
import { Effect } from "effect";
import {
  getPublishedArticleRoute,
  readPublishedArticleRoute,
} from "@/lib/content/article/route";
import { makeArticleRuntimeSource } from "@/test/content/article";
import {
  makeTestArticleProjection,
  testArticleDeProjection,
  testArticleIdProjection,
  testArticleProjection,
} from "@/test/content-article";
import {
  createTestNativeQuery,
  createTestRuntimeQuery,
} from "@/test/runtime-query";

const runtimeQueryMock = vi.hoisted(() => vi.fn());
const runtimeReadMock = vi.hoisted(() => vi.fn());
const cacheMock = vi.hoisted(() => vi.fn());
const activeReleaseId = ReleaseIdSchema.make("release-article");

vi.mock("@/lib/content/cache", () => ({
  applyContentCache: cacheMock,
}));
vi.mock("@repo/backend/client/nakafa/query", () => ({
  readNakafaRuntimeQuery: runtimeReadMock,
}));

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
  runtimeReadMock.mockImplementation(createTestRuntimeQuery(runtimeQueryMock));
  cacheMock.mockReset();
});

describe("published article route", () => {
  it.effect(
    "resolves reciprocal locales and missing routes from authenticated serving rows",
    () =>
      Effect.gen(function* () {
        const fixture = yield* makeArticleRuntimeSource();
        const context = yield* createTestPublication(fixture.source);
        runtimeReadMock.mockImplementation(createTestNativeQuery(context));
        const projection = testLocalizedArticleProjection(1, "de");

        const route = yield* readPublishedArticleRoute(
          "de",
          projection.publicPath
        );
        expect(route).toMatchObject({
          activeReleaseId: fixture.state.activeReleaseId,
          projection,
        });
        expect(route.alternates).toHaveLength(3);
        expect(
          yield* readPublishedArticleRoute("de", "articles/politik/missing")
        ).toEqual({
          activeReleaseId: fixture.state.activeReleaseId,
          projection: null,
          alternates: [],
        });
      })
  );

  it.effect.each([
    testArticleProjection,
    testArticleIdProjection,
    testArticleDeProjection,
  ])(
    "decodes one complete $appLocale route and reciprocal locale set",
    (projection) =>
      Effect.gen(function* () {
        runtimeQueryMock.mockResolvedValueOnce(
          foundModel({
            projectionJson: canonicalizeArticleProjection(projection),
          })
        );

        const route = yield* Effect.tryPromise(() =>
          getPublishedArticleRoute(projection.appLocale, projection.publicPath)
        );
        expect(route).toEqual({
          activeReleaseId,
          alternates: [
            testArticleProjection,
            testArticleIdProjection,
            testArticleDeProjection,
          ],
          projection,
        });
        expect(cacheMock).toHaveBeenCalledWith("article");
      })
  );

  it.effect("pins a route read to the expected active release", () =>
    Effect.gen(function* () {
      runtimeQueryMock.mockResolvedValueOnce(foundModel());

      const route = yield* Effect.tryPromise(() =>
        getPublishedArticleRoute(
          "en",
          testArticleProjection.publicPath,
          activeReleaseId
        )
      );
      expect(route).toMatchObject({ activeReleaseId });
      expect(runtimeQueryMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ expectedActiveReleaseId: activeReleaseId })
      );
    })
  );

  it.effect("preserves an active release mismatch for pinned callers", () =>
    Effect.gen(function* () {
      const expectedReleaseId = ReleaseIdSchema.make("release-previous");
      runtimeQueryMock.mockResolvedValueOnce(foundModel());

      const error = yield* readPublishedArticleRoute(
        "en",
        testArticleProjection.publicPath,
        expectedReleaseId
      ).pipe(Effect.flip);
      expect(error).toMatchObject({
        _tag: "PublishedReleaseMismatchError",
        actualReleaseId: activeReleaseId,
        expectedReleaseId,
      });
    })
  );

  it.effect("preserves a signed missing-route tombstone", () =>
    Effect.gen(function* () {
      runtimeQueryMock.mockResolvedValueOnce(
        foundModel({ alternateJson: [], projectionJson: null })
      );

      const route = yield* readPublishedArticleRoute(
        "en",
        testArticleProjection.publicPath
      );
      expect(route).toEqual({
        activeReleaseId,
        alternates: [],
        projection: null,
      });
    })
  );

  it.effect.each([
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
  ])("rejects an invalid %s", ([, result]) =>
    Effect.gen(function* () {
      runtimeQueryMock.mockResolvedValueOnce(result);

      const error = yield* readPublishedArticleRoute(
        "en",
        testArticleProjection.publicPath
      ).pipe(Effect.flip);
      expect(error).toMatchObject({ _tag: "PublishedProjectionError" });
    })
  );
});

vi.mock("@/env", () => ({
  env: { NEXT_PUBLIC_CONVEX_URL: "https://test.convex.cloud" },
}));
