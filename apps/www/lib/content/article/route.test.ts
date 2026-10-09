// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { ACTIVE_APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import { canonicalizeArticleProjection } from "@nakafa/aksara-contracts/projection/article";
import { createTestPublication } from "@repo/backend/test/content/publication";
import { testLocalizedArticleProjection } from "@repo/backend/test/content/runtime";
import { Array as Arr, Effect, Layer } from "effect";
import { readPublishedArticleRoute } from "@/lib/content/article/route";
import { makeArticleRuntimeSource } from "@/test/content/article";
import {
  makeTestArticleProjection,
  testArticleDeProjection,
  testArticleIdProjection,
  testArticleProjection,
} from "@/test/content-article";

const runtimeQueryMock = vi.hoisted(() => vi.fn());
const activeReleaseId = ReleaseIdSchema.make("release-article");
vi.mock("@confect/js", async (importOriginal) => {
  const { HttpClient } = await importOriginal<typeof import("@confect/js")>();
  return {
    HttpClient: {
      ...HttpClient,
      layer: (...args: Parameters<typeof HttpClient.layer>) =>
        Layer.effect(
          HttpClient.HttpClient,
          Effect.gen(function* () {
            const client = yield* HttpClient.HttpClient;
            return {
              ...client,
              query: runtimeQueryMock,
            };
          })
        ).pipe(Layer.provide(HttpClient.layer(...args))),
    },
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
      Arr.map(
        [
          testArticleProjection,
          testArticleIdProjection,
          testArticleDeProjection,
        ],
        canonicalizeArticleProjection
      ),
    projectionJson:
      overrides?.projectionJson === undefined
        ? canonicalizeArticleProjection(testArticleProjection)
        : overrides.projectionJson,
  };
}
beforeEach(() => {
  runtimeQueryMock.mockReset();
});
describe("published article route", () => {
  it.effect(
    "resolves reciprocal locales and missing routes from authenticated serving rows",
    () =>
      Effect.gen(function* () {
        const fixture = yield* makeArticleRuntimeSource();
        const context = yield* createTestPublication(fixture.source);
        runtimeQueryMock.mockImplementation(context.query);
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
        runtimeQueryMock.mockReturnValueOnce(
          Effect.succeed(
            foundModel({
              projectionJson: canonicalizeArticleProjection(projection),
            })
          )
        );
        const route = yield* readPublishedArticleRoute(
          projection.appLocale,
          projection.publicPath
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
      })
  );
  it.effect("pins a route read to the expected active release", () =>
    Effect.gen(function* () {
      runtimeQueryMock.mockReturnValueOnce(Effect.succeed(foundModel()));
      const route = yield* readPublishedArticleRoute(
        "en",
        testArticleProjection.publicPath,
        activeReleaseId
      );
      expect(route).toMatchObject({
        activeReleaseId,
      });
      expect(runtimeQueryMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          expectedActiveReleaseId: activeReleaseId,
        })
      );
    })
  );
  it.effect("preserves an active release mismatch for pinned callers", () =>
    Effect.gen(function* () {
      const expectedReleaseId = ReleaseIdSchema.make("release-previous");
      runtimeQueryMock.mockReturnValueOnce(Effect.succeed(foundModel()));
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
      runtimeQueryMock.mockReturnValueOnce(
        Effect.succeed(
          foundModel({
            alternateJson: [],
            projectionJson: null,
          })
        )
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
    [
      "active locales",
      foundModel({
        activeAppLocales: ["id", "en", "de"],
      }),
    ],
    [
      "missing release",
      foundModel({
        activeReleaseId: null,
      }),
    ],
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
    [
      "projection JSON",
      foundModel({
        projectionJson: "{}",
      }),
    ],
    [
      "alternate JSON",
      foundModel({
        alternateJson: ["{}"],
      }),
    ],
  ])("rejects an invalid %s", ([, result]) =>
    Effect.gen(function* () {
      runtimeQueryMock.mockReturnValueOnce(Effect.succeed(result));
      const error = yield* readPublishedArticleRoute(
        "en",
        testArticleProjection.publicPath
      ).pipe(Effect.flip);
      expect(error).toMatchObject({
        _tag: "PublishedProjectionError",
      });
    })
  );
});
