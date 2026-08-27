import { describe, expect, it } from "@effect/vitest";
import {
  canonicalizeMaterialProjection,
  MaterialLessonProjectionSchema,
} from "@nakafa/aksara-contracts/projection/material";
import {
  encodePredecessorProjection,
  PredecessorMaterialProjectionSchema,
} from "@repo/backend/convex/contentRelease/material/predecessor";
import { makeMaterialProjection } from "@repo/backend/test/content/material";
import { normalizePublicationDates } from "@repo/contents/_types/publication";
import { Cause, Effect, Exit, Schema } from "effect";

const decodePredecessor = Schema.decodeUnknownSync(
  PredecessorMaterialProjectionSchema
);

describe("contentRelease/material/predecessor", () => {
  it.each(["en", "id", "de"] as const)(
    "adapts a current %s projection to the exact 0.15.0 view",
    async (locale) => {
      const current = makeMaterialProjection(locale, 1);
      const dates = normalizePublicationDates(current.metadata);
      const currentJson = canonicalizeMaterialProjection(current);
      const currentExit = Schema.decodeUnknownExit(
        PredecessorMaterialProjectionSchema
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
        date: dates.datePublished,
        title: current.metadata.title,
      });
      expect(predecessorJson).not.toContain("datePublished");
      expect(predecessorJson).not.toContain("dateModified");
    }
  );

  it("keeps the publication date and optional metadata when modified", async () => {
    const source = makeMaterialProjection("en", 1);
    const dates = normalizePublicationDates(source.metadata);
    const current = MaterialLessonProjectionSchema.make({
      ...source,
      metadata: {
        authors: source.metadata.authors,
        dateModified: "2026-08-24",
        datePublished: dates.datePublished,
        description: "Current description",
        subject: "Current subject",
        title: source.metadata.title,
      },
    });
    const predecessorJson = await Effect.runPromise(
      encodePredecessorProjection(current)
    );
    const predecessor = decodePredecessor(JSON.parse(predecessorJson), {
      onExcessProperty: "error",
    });

    expect(predecessor.metadata).toEqual({
      authors: current.metadata.authors,
      date: dates.datePublished,
      description: current.metadata.description,
      subject: current.metadata.subject,
      title: current.metadata.title,
    });
    expect(predecessorJson).not.toContain("dateModified");
  });

  it("preserves a legacy projection without changing its canonical bytes", async () => {
    const current = makeMaterialProjection("en", 1);
    const dates = normalizePublicationDates(current.metadata);
    const legacy = MaterialLessonProjectionSchema.make({
      ...current,
      metadata: {
        authors: current.metadata.authors,
        date: dates.datePublished,
        title: current.metadata.title,
      },
    });
    const canonical = canonicalizeMaterialProjection(legacy);

    await expect(
      Effect.runPromise(encodePredecessorProjection(legacy))
    ).resolves.toBe(canonical);
  });
});
