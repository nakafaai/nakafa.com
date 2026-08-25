// @vitest-environment node

import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { canonicalizeArticleProjection } from "@nakafa/aksara-contracts/projection/article";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
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
  it("decodes one canonical article projection", async () => {
    await expect(
      Effect.runPromise(
        decodeArticleJson(
          canonicalizeArticleProjection(testArticleProjection),
          identity
        )
      )
    ).resolves.toEqual(testArticleProjection);
  });

  it.each([
    ["invalid JSON", "{"],
    ["invalid projection", "{}"],
  ])("preserves %s in the typed error channel", async (_label, source) => {
    await expect(
      Effect.runPromise(decodeArticleJson(source, identity).pipe(Effect.flip))
    ).resolves.toMatchObject({
      _tag: "PublishedProjectionError",
      ...identity,
    });
  });

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

  it("accepts only identical projections from one active release", async () => {
    const activeReleaseId = ReleaseIdSchema.make("release-active");
    const catalog = { activeReleaseId, projection: testArticleProjection };

    await expect(
      Effect.runPromise(verifyArticlePublication(catalog, catalog))
    ).resolves.toBeUndefined();

    await expect(
      Effect.runPromise(
        verifyArticlePublication(catalog, {
          activeReleaseId: ReleaseIdSchema.make("release-next"),
          projection: testArticleProjection,
        }).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({
      _tag: "PublishedReleaseMismatchError",
      actualReleaseId: "release-next",
      expectedReleaseId: activeReleaseId,
    });

    await expect(
      Effect.runPromise(
        verifyArticlePublication(catalog, {
          activeReleaseId,
          projection: {
            ...testArticleProjection,
            metadata: {
              ...testArticleProjection.metadata,
              title: "Different title",
            },
          },
        }).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({
      _tag: "PublishedProjectionError",
      ...identity,
    });
  });
});
