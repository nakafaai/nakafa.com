// @vitest-environment node

import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { decodePublishedArticle } from "@/lib/content/published/projection";
import { testArticleProjection } from "@/test/content-article";

const articleIdentity = {
  appLocale: testArticleProjection.appLocale,
  publicPath: testArticleProjection.publicPath,
} satisfies Parameters<typeof decodePublishedArticle>[1];

describe("published projection", () => {
  it("decodes an exact signed article projection", async () => {
    await expect(
      Effect.runPromise(
        decodePublishedArticle(testArticleProjection, articleIdentity)
      )
    ).resolves.toEqual(testArticleProjection);

    await expect(
      Effect.runPromise(
        decodePublishedArticle(testArticleProjection, {
          ...articleIdentity,
          publicPath: "articles/politics/other",
        }).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({
      _tag: "PublishedProjectionError",
      appLocale: testArticleProjection.appLocale,
      publicPath: "articles/politics/other",
    });

    await expect(
      Effect.runPromise(
        decodePublishedArticle({}, articleIdentity).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({
      _tag: "PublishedProjectionError",
      ...articleIdentity,
    });
  });
});
