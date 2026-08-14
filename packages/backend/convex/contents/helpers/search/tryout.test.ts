import type { ActiveAppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { TryoutCatalogRowSchema } from "@nakafa/aksara-contracts/tryout/catalog";
import { readSignedTryoutSearchDocuments } from "@repo/backend/convex/contents/helpers/search/tryout";
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

/** Builds one internal section that must never become a public search result. */
function makeInternalSection(appLocale: ActiveAppLocaleCode) {
  return Schema.decodeUnknownSync(TryoutCatalogRowSchema)({
    countryKey: "indonesia",
    description: "Internal entry",
    examKey: "snbt",
    graph: {
      alignmentId: "alignment:tryout:technical:internal-section",
      assetId: `asset:${appLocale}:tryout:technical:internal-section`,
      conceptId: "concept:tryout:technical:internal-section",
      learningObjectId: "lo:tryout-technical-internal-section",
      lensId: "lens:tryout:technical",
    },
    kind: "section",
    appLocale,
    order: 1,
    questionCount: 1,
    questionSourcePath:
      "packages/corpus/question-bank/tryout/indonesia/snbt/quantitative-knowledge/set-1/question-1",
    sectionKey: "quantitative-knowledge",
    setKey: "set-1",
    sourceRevision: "technical-revision",
    timeLimitSeconds: 60,
    title: "Internal entry",
    trackKey: "2027",
    visibility: "internal-entry",
  });
}

describe("contents/helpers/search/tryout", () => {
  it("returns no source fallback before signed Tryout activation", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readSignedTryoutSearchDocuments(
            ctx,
            {
              limit: 10,
              locale: "en",
              offset: 0,
              queries: ["technical"],
              section: "tryout",
            },
            ["technical"],
            10
          )
        )
      )
    ).resolves.toEqual([]);
  });

  it("searches only public rows from one verified localized catalog", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) =>
      activateTryoutSnapshot(ctx, {
        catalog: [
          makeTryoutCatalogRow("en").record.row,
          makeInternalSection("en"),
          makeTryoutCatalogRow("id").record.row,
          makeInternalSection("id"),
        ],
        placements: [
          makeTryoutPlacementRow("en").record.row,
          makeTryoutPlacementRow("id").record.row,
        ],
      })
    );

    const input = {
      limit: 10,
      locale: "en",
      offset: 0,
      section: "tryout",
    } satisfies Parameters<typeof readSignedTryoutSearchDocuments>[1];
    const exact = await t.query((ctx) =>
      runConvexProgram(
        readSignedTryoutSearchDocuments(
          ctx,
          { ...input, queries: ["try-out/indonesia"] },
          ["try-out/indonesia"],
          10
        )
      )
    );
    const internal = await t.query((ctx) =>
      runConvexProgram(
        readSignedTryoutSearchDocuments(
          ctx,
          { ...input, queries: ["Internal entry"] },
          ["Internal entry"],
          10
        )
      )
    );
    const browsed = await t.query((ctx) =>
      runConvexProgram(readSignedTryoutSearchDocuments(ctx, input, [], 10))
    );
    const empty = await t.query((ctx) =>
      runConvexProgram(readSignedTryoutSearchDocuments(ctx, input, [], 0))
    );

    expect(exact).toMatchObject([
      {
        content_id: "asset:en:tryout:technical:country",
        route: "try-out/indonesia",
        section: "tryout",
      },
    ]);
    expect(internal).toEqual([]);
    expect(browsed).toHaveLength(1);
    expect(empty).toEqual([]);
  });
});
