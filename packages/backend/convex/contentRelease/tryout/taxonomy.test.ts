import type { ActiveAppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { TryoutCatalogRowSchema } from "@nakafa/aksara-contracts/tryout/catalog";
import { readTryoutTaxonomy } from "@repo/backend/convex/contentRelease/tryout/taxonomy";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  activateTryoutSnapshot,
  makeTryoutCatalogRow,
  makeTryoutPlacementRow,
} from "@repo/backend/test/tryout-snapshot";
import { convexTest } from "convex-test";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

/** Builds one localized technical exam beneath the shared country fixture. */
function makeTryoutExam(locale: ActiveAppLocaleCode) {
  const descriptions = {
    de: "Technische Prüfung",
    en: "Technical exam",
    id: "Ujian teknis",
  } satisfies Record<ActiveAppLocaleCode, string>;
  return Schema.decodeSync(TryoutCatalogRowSchema)({
    countryKey: "indonesia",
    description: descriptions[locale],
    examKey: "snbt",
    graph: {
      alignmentId: "alignment:tryout:technical:exam",
      assetId: `asset:${locale}:tryout:technical:exam`,
      conceptId: "concept:tryout:technical:exam",
      learningObjectId: "lo:tryout-technical-exam",
      lensId: "lens:tryout:technical",
    },
    kind: "exam",
    appLocale: locale,
    order: 1,
    publicPath: "try-out/indonesia/snbt",
    scoringStrategy: "irt",
    sourceRevision: "technical-revision",
    title: "SNBT",
  });
}

describe("contentRelease/tryout/taxonomy", () => {
  it("requires one active signed Tryout publication", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.query((ctx) => runConvexProgram(readTryoutTaxonomy(ctx, "en")))
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_MISSING" } });
  });

  it("derives localized options and route count from one verified catalog", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) =>
      activateTryoutSnapshot(ctx, {
        catalog: [
          makeTryoutCatalogRow("en").record.row,
          makeTryoutExam("en"),
          makeTryoutCatalogRow("id").record.row,
          makeTryoutExam("id"),
          makeTryoutCatalogRow("de").record.row,
          makeTryoutExam("de"),
        ],
        placements: [
          makeTryoutPlacementRow("en").record.row,
          makeTryoutPlacementRow("id").record.row,
          makeTryoutPlacementRow("de").record.row,
        ],
      })
    );

    await expect(
      t.query((ctx) => runConvexProgram(readTryoutTaxonomy(ctx, "id")))
    ).resolves.toEqual({
      countries: [{ id: "indonesia", label: "Negara teknis" }],
      exams: [{ id: "snbt", label: "SNBT" }],
      routeCount: 2,
    });
  });
});
