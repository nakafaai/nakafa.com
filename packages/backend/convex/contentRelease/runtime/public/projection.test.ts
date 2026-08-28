import { describe, expect, it } from "@effect/vitest";
import {
  ContentProjectionSchema,
  canonicalizeContentProjection,
} from "@nakafa/aksara-contracts/projection/spec";
import { ArticleProjectionSchema as StoredArticleProjectionSchema } from "@nakafa/aksara-transition/projection/article";
import { encodePublicProjection } from "@repo/backend/convex/contentRelease/runtime/public/projection";
import { testLocalizedArticleProjection } from "@repo/backend/test/content/runtime";
import { normalizePublicationDates } from "@repo/contents/_types/publication";
import { Effect, Schema } from "effect";

describe("current public content projection", () => {
  it.effect("normalizes an authenticated stored date exactly once", () =>
    Effect.gen(function* () {
      const current = testLocalizedArticleProjection(0, "id");
      const { datePublished } = normalizePublicationDates(current.metadata);
      const stored = StoredArticleProjectionSchema.make({
        ...current,
        metadata: {
          authors: current.metadata.authors,
          date: datePublished,
          title: current.metadata.title,
        },
      });

      const encoded = yield* encodePublicProjection(stored);

      expect(Schema.is(ContentProjectionSchema)(encoded.projection)).toBe(true);
      expect(encoded.projection.metadata).toMatchObject({
        datePublished,
      });
      expect(encoded.projection.metadata).not.toHaveProperty("date");
      expect(encoded.projectionJson).toBe(
        canonicalizeContentProjection(encoded.projection)
      );
    })
  );

  it.effect("preserves a current projection without compatibility fields", () =>
    Effect.gen(function* () {
      const current = testLocalizedArticleProjection(0, "de");

      const encoded = yield* encodePublicProjection(current);

      expect(encoded.projection).toEqual(current);
      expect(encoded.projectionJson).toBe(
        canonicalizeContentProjection(encoded.projection)
      );
    })
  );
});
