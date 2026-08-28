import { describe, expect, it } from "@effect/vitest";
import {
  ArticleProjectionSchema,
  canonicalizeArticleProjection,
} from "@nakafa/aksara-contracts/projection/article";
import {
  encodePredecessorProjection,
  PredecessorArticleProjectionSchema,
} from "@repo/backend/convex/contentRelease/article/predecessor";
import {
  testArticleProjection,
  testLocalizedArticleProjection,
} from "@repo/backend/test/content/runtime";
import { normalizePublicationDates } from "@repo/contents/_types/publication";
import { Cause, Effect, Exit, Schema } from "effect";

const decodePredecessor = Schema.decodeUnknownSync(
  PredecessorArticleProjectionSchema
);

describe("contentRelease/article/predecessor", () => {
  it.each(["en", "id", "de"] as const)(
    "adapts a current %s projection to the exact 0.15.0 view",
    async (locale) => {
      const current = testLocalizedArticleProjection(0, locale);
      const currentJson = canonicalizeArticleProjection(current);
      const currentExit = Schema.decodeUnknownExit(
        PredecessorArticleProjectionSchema
      )(JSON.parse(currentJson), { onExcessProperty: "error" });

      expect(Exit.isFailure(currentExit)).toBe(true);
      if (Exit.isFailure(currentExit)) {
        expect(Cause.pretty(currentExit.cause)).toContain(
          'Expected no excess property\n  at ["metadata"]["datePublished"]'
        );
      }

      const predecessorJson = await Effect.runPromise(
        encodePredecessorProjection(current)
      );
      const predecessor = decodePredecessor(JSON.parse(predecessorJson), {
        onExcessProperty: "error",
      });

      expect(predecessor.metadata).toEqual({
        authors: current.metadata.authors,
        date: current.metadata.datePublished,
        description: current.metadata.description,
        title: current.metadata.title,
      });
      expect(predecessorJson).not.toContain("datePublished");
      expect(predecessorJson).not.toContain("dateModified");
    }
  );

  it("keeps the publication date when the current projection is modified", async () => {
    const source = testArticleProjection(0);
    const dates = normalizePublicationDates(source.metadata);
    const current = ArticleProjectionSchema.make({
      ...source,
      metadata: {
        authors: source.metadata.authors,
        dateModified: "2026-07-24",
        datePublished: dates.datePublished,
        ...(source.metadata.description === undefined
          ? {}
          : { description: source.metadata.description }),
        title: source.metadata.title,
      },
    });
    const predecessorJson = await Effect.runPromise(
      encodePredecessorProjection(current)
    );
    const predecessor = decodePredecessor(JSON.parse(predecessorJson), {
      onExcessProperty: "error",
    });

    expect(predecessor.metadata.date).toBe(current.metadata.datePublished);
    expect(predecessorJson).not.toContain("dateModified");
  });
});
