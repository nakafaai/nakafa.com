// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
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
  it.effect("decodes an exact signed article projection", () =>
    Effect.gen(function* () {
      expect(
        yield* decodePublishedArticle(testArticleProjection, articleIdentity)
      ).toEqual(testArticleProjection);

      expect(
        yield* decodePublishedArticle(testArticleProjection, {
          ...articleIdentity,
          publicPath: "articles/politics/other",
        }).pipe(Effect.flip)
      ).toMatchObject({
        _tag: "PublishedProjectionError",
        appLocale: testArticleProjection.appLocale,
        publicPath: "articles/politics/other",
      });

      expect(
        yield* decodePublishedArticle({}, articleIdentity).pipe(Effect.flip)
      ).toMatchObject({
        _tag: "PublishedProjectionError",
        ...articleIdentity,
      });
    })
  );

  it.effect("decodes an exact signed Page projection", () =>
    Effect.gen(function* () {
      const identity = {
        appLocale: testPageProjection.appLocale,
        publicPath: testPageProjection.publicPath,
      } satisfies Parameters<typeof decodePublishedPage>[1];

      expect(yield* decodePublishedPage(testPageProjection, identity)).toEqual(
        testPageProjection
      );
      const historicalProjection = {
        ...testPageProjection,
        metadata: {
          description: testPageProjection.metadata.description,
          lastModified: testPageProjection.metadata.datePublished,
          title: testPageProjection.metadata.title,
        },
      };
      expect(
        yield* decodePublishedPage(historicalProjection, identity)
      ).toEqual(historicalProjection);
      expect(
        yield* decodePublishedPageJson(
          JSON.stringify(historicalProjection),
          identity
        )
      ).toEqual(historicalProjection);
      expect(
        yield* decodePublishedPage(testPageProjection, {
          ...identity,
          publicPath: "other-page",
        }).pipe(Effect.flip)
      ).toMatchObject({
        _tag: "PublishedProjectionError",
        appLocale: testPageProjection.appLocale,
        publicPath: "other-page",
      });
      expect(
        yield* decodePublishedPage({}, identity).pipe(Effect.flip)
      ).toMatchObject({
        _tag: "PublishedProjectionError",
        ...identity,
      });
      expect(
        yield* decodePublishedPageJson(
          JSON.stringify(testPageProjection),
          identity
        )
      ).toEqual(testPageProjection);
      expect(
        yield* decodePublishedPageJson("{", identity).pipe(Effect.flip)
      ).toMatchObject({
        _tag: "PublishedProjectionError",
        ...identity,
      });
      expect(
        yield* decodePublishedPageJson("{}", identity).pipe(Effect.flip)
      ).toMatchObject({
        _tag: "PublishedProjectionError",
        ...identity,
      });
    })
  );
});
