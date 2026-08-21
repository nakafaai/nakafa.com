import type { ActiveAppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { TryoutCatalogRowSchema } from "@nakafa/aksara-contracts/tryout/catalog";
import {
  readTryoutSitemapCount,
  readTryoutSitemapPage,
} from "@repo/backend/convex/contentRelease/tryout/sitemap";
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

/** Creates one public country row with a deterministic technical identity. */
function makeCountry(
  locale: ActiveAppLocaleCode,
  countryKey: string,
  publicPath: string,
  order: number
) {
  const source = makeTryoutCatalogRow(locale).record.row;
  if (source.kind !== "country") {
    throw new Error("Expected the shared try-out fixture to be a country.");
  }
  return Schema.decodeSync(TryoutCatalogRowSchema)({
    ...source,
    countryKey,
    graph: {
      ...source.graph,
      assetId: `asset:${locale}:tryout:${countryKey}:country`,
      learningObjectId: `lo:tryout-${countryKey}-country`,
    },
    order,
    publicPath,
  });
}

/** Creates one internal entry section that must never enter a sitemap. */
function makeInternalSection(locale: ActiveAppLocaleCode) {
  const source = makeTryoutCatalogRow(locale).record.row;
  return Schema.decodeSync(TryoutCatalogRowSchema)({
    countryKey: "indonesia",
    examKey: "snbt",
    graph: {
      ...source.graph,
      assetId: `asset:${locale}:tryout:entry:section`,
      learningObjectId: "lo:tryout-entry-section",
    },
    kind: "section",
    appLocale: locale,
    order: 1,
    questionCount: 1,
    questionSourcePath:
      "packages/corpus/question-bank/tryout/indonesia/snbt/quantitative-knowledge/set-1",
    sectionKey: "quantitative-knowledge",
    setKey: "set-1",
    sourceRevision: "technical-revision",
    timeLimitSeconds: 60,
    title: "Technical entry section",
    trackKey: "2027",
    visibility: "internal-entry",
  });
}

describe("contentRelease/tryout/sitemap", () => {
  it("requires an active signed try-out publication", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.query((ctx) => runConvexProgram(readTryoutSitemapCount(ctx, "en")))
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_MISSING" } });
    await expect(
      t.query((ctx) => runConvexProgram(readTryoutSitemapPage(ctx, "en", 0)))
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_MISSING" } });
  });

  it("returns only sorted public paths from the active signed catalog", async () => {
    const t = convexTest(schema, convexModules);
    const catalog = [
      makeCountry("en", "zeta", "try-out/zeta", 2),
      makeCountry("en", "alpha", "try-out/alpha", 1),
      makeInternalSection("en"),
      makeCountry("id", "zeta", "try-out/zeta", 2),
      makeCountry("id", "alpha", "try-out/alpha", 1),
      makeInternalSection("id"),
      makeCountry("de", "zeta", "try-out/zeta", 2),
      makeCountry("de", "alpha", "try-out/alpha", 1),
      makeInternalSection("de"),
    ];
    await t.mutation((ctx) =>
      activateTryoutSnapshot(ctx, {
        catalog,
        placements: [
          makeTryoutPlacementRow("en").record.row,
          makeTryoutPlacementRow("id").record.row,
          makeTryoutPlacementRow("de").record.row,
        ],
      })
    );

    await expect(
      t.query((ctx) => runConvexProgram(readTryoutSitemapCount(ctx, "en")))
    ).resolves.toEqual({ pageCount: 1, routeCount: 2 });
    await expect(
      t.query((ctx) => runConvexProgram(readTryoutSitemapPage(ctx, "en", 0)))
    ).resolves.toEqual({ paths: ["try-out/alpha", "try-out/zeta"] });
    await expect(
      t.query((ctx) => runConvexProgram(readTryoutSitemapPage(ctx, "en", 1)))
    ).resolves.toBeNull();
    await expect(
      t.query((ctx) => runConvexProgram(readTryoutSitemapPage(ctx, "en", -1)))
    ).resolves.toBeNull();
  });
});
