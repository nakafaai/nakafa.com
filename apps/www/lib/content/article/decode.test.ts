// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { canonicalizeArticleProjection } from "@nakafa/aksara-contracts/projection/article";
import { Effect } from "effect";
import {
  decodeArticleJson,
  isArticleCounterpart,
  verifyArticlePublication,
} from "@/lib/content/article/decode";
import {
  makeTestArticleProjection,
  testArticleIdProjection,
  testArticleProjection,
} from "@/test/content-article";

const identity = {
  appLocale: testArticleProjection.appLocale,
  publicPath: testArticleProjection.publicPath,
};

describe("published article decoding", () => {
  it.effect("decodes one canonical article projection", () =>
    Effect.gen(function* () {
      const projection = yield* decodeArticleJson(
        canonicalizeArticleProjection(testArticleProjection),
        identity
      );

      expect(projection).toEqual(testArticleProjection);
    })
  );

  it.effect.each([
    ["invalid JSON", "{"],
    ["invalid projection", "{}"],
  ])("preserves %s in the typed error channel", ([, source]) =>
    Effect.gen(function* () {
      const error = yield* decodeArticleJson(source, identity).pipe(
        Effect.flip
      );

      expect(error).toMatchObject({
        _tag: "PublishedProjectionError",
        ...identity,
      });
    })
  );

  it("compares stable locale counterparts", () => {
    expect(
      isArticleCounterpart(testArticleProjection, testArticleIdProjection)
    ).toBe(true);
    expect(
      isArticleCounterpart(
        testArticleProjection,
        makeTestArticleProjection("another-article")
      )
    ).toBe(false);
  });

  it.effect("accepts only identical projections from one active release", () =>
    Effect.gen(function* () {
      const activeReleaseId = ReleaseIdSchema.make("release-active");
      const catalog = { activeReleaseId, projection: testArticleProjection };

      const verified = yield* verifyArticlePublication(catalog, catalog);
      expect(verified).toBeUndefined();

      const releaseError = yield* verifyArticlePublication(catalog, {
        activeReleaseId: ReleaseIdSchema.make("release-next"),
        projection: testArticleProjection,
      }).pipe(Effect.flip);
      expect(releaseError).toMatchObject({
        _tag: "PublishedReleaseMismatchError",
        actualReleaseId: "release-next",
        expectedReleaseId: activeReleaseId,
      });

      const projectionError = yield* verifyArticlePublication(catalog, {
        activeReleaseId,
        projection: {
          ...testArticleProjection,
          metadata: {
            ...testArticleProjection.metadata,
            title: "Different title",
          },
        },
      }).pipe(Effect.flip);
      expect(projectionError).toMatchObject({
        _tag: "PublishedProjectionError",
        ...identity,
      });
    })
  );
});
