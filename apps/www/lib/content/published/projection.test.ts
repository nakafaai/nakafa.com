// @vitest-environment node

import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import {
  decodePublishedArticle,
  decodePublishedMaterial,
} from "@/lib/content/published/projection";
import { testArticleProjection } from "@/test/content-article";
import { previewProjection, previewPublicRoute } from "@/test/content-preview";

const identity = {
  locale: "en" as const,
  publicPath: previewProjection.publicPath,
};
const articleIdentity = {
  locale: "en" as const,
  publicPath: testArticleProjection.publicPath,
};

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
      locale: "en",
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

  it("adapts the exact signed projection to the current route shell", async () => {
    await expect(
      Effect.runPromise(decodePublishedMaterial(previewProjection, identity))
    ).resolves.toEqual({
      projection: previewProjection,
      route: previewPublicRoute,
    });
  });

  it("keeps invalid projection data in the typed error channel", async () => {
    const failures = [
      { ...previewProjection, parentPath: "subjects/other" },
      { ...previewProjection, contentKey: "test:invalid-route-source" },
    ];

    for (const input of failures) {
      await expect(
        Effect.runPromise(
          decodePublishedMaterial(input, identity).pipe(Effect.flip)
        )
      ).resolves.toMatchObject({
        _tag: "PublishedProjectionError",
        ...identity,
      });
    }
  });
});
