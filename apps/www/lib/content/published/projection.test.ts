// @vitest-environment node

import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import {
  decodePublishedArticle,
  decodePublishedPage,
  decodePublishedPageJson,
} from "@/lib/content/published/projection";
import { testArticleProjection } from "@/test/content-article";
import { testPageProjection } from "@/test/content-page";

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

  it("decodes an exact signed Page projection", async () => {
    const identity = {
      appLocale: testPageProjection.appLocale,
      publicPath: testPageProjection.publicPath,
    } satisfies Parameters<typeof decodePublishedPage>[1];

    await expect(
      Effect.runPromise(decodePublishedPage(testPageProjection, identity))
    ).resolves.toEqual(testPageProjection);
    await expect(
      Effect.runPromise(
        decodePublishedPage(testPageProjection, {
          ...identity,
          publicPath: "other-page",
        }).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({
      _tag: "PublishedProjectionError",
      appLocale: testPageProjection.appLocale,
      publicPath: "other-page",
    });
    await expect(
      Effect.runPromise(decodePublishedPage({}, identity).pipe(Effect.flip))
    ).resolves.toMatchObject({
      _tag: "PublishedProjectionError",
      ...identity,
    });
    await expect(
      Effect.runPromise(
        decodePublishedPageJson(JSON.stringify(testPageProjection), identity)
      )
    ).resolves.toEqual(testPageProjection);
    await expect(
      Effect.runPromise(
        decodePublishedPageJson("{", identity).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({
      _tag: "PublishedProjectionError",
      ...identity,
    });
    await expect(
      Effect.runPromise(
        decodePublishedPageJson("{}", identity).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({
      _tag: "PublishedProjectionError",
      ...identity,
    });
  });
});
