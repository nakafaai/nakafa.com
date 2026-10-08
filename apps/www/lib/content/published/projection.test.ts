// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { PublicPageProjectionSchema } from "@nakafa/aksara-contracts/projection/page";
import { Effect, Schema } from "effect";
import {
  decodePublishedArticle,
  decodePublishedPage,
  decodePublishedPageJson,
} from "@/lib/content/published/projection";
import { testArticleProjection } from "@/test/content-article";
import { testPageProjection } from "@/test/content-page";

const pageJson = Schema.encodeSync(
  Schema.fromJsonString(PublicPageProjectionSchema)
);

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
        yield* decodePublishedPageJson(pageJson(testPageProjection), identity)
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
