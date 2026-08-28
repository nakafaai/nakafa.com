import { strict as assert } from "node:assert/strict";
import {
  ContentKeySchema,
  CorpusSourcePathSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  AppLocaleSchema,
  ArtifactLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import { canonicalizeContentSnapshotRow } from "@nakafa/aksara-contracts/release/snapshot/data";
import { makeTryoutCatalogRecord } from "@nakafa/aksara-contracts/tryout/catalog-hash";
import {
  deliveryLanguageForSection,
  questionArtifactLocaleForSection,
} from "@nakafa/aksara-contracts/tryout/language";
import { TryoutPlacementSchema } from "@nakafa/aksara-contracts/tryout/placement";
import { makeTryoutPlacementRecord } from "@nakafa/aksara-contracts/tryout/placement-hash";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  tryoutCatalogFacts,
  tryoutPlacementFacts,
} from "@repo/backend/convex/contentRelease/tryout/facts";
import type schema from "@repo/backend/convex/schema";
import { CLEANUP_SOURCE_SNAPSHOT } from "@repo/backend/test/migration/state";
import { TEST_STORED_TRYOUT_PLACEMENT } from "@repo/backend/test/tryout/history";
import { makeTryoutPlacementRow } from "@repo/backend/test/tryout/snapshot";
import { makeTryoutStartCatalog } from "@repo/backend/test/tryout/source";
import type { TestConvex } from "convex-test";
import { Schema } from "effect";

export const RETAINED_SECTION_KEY = "general-reasoning";
type CleanupTest = TestConvex<typeof schema>;

/** Converts the fixed immutable history vector through the real locale rules. */
function makeRetainedRepairPlacement() {
  const historical = TEST_STORED_TRYOUT_PLACEMENT.record.row;
  const appLocale = AppLocaleSchema.make(historical.locale);
  return {
    family: "tryout",
    record: makeTryoutPlacementRecord(
      Schema.decodeSync(TryoutPlacementSchema)({
        answerArtifactHash: historical.answerArtifactHash,
        answerArtifactLocale: ArtifactLocaleSchema.make(historical.locale),
        answerContentKey: historical.answerContentKey,
        appLocale,
        choices: historical.choices,
        contentHash: historical.contentHash,
        countryKey: historical.countryKey,
        deliveryLanguage: deliveryLanguageForSection(
          historical.sectionKey,
          appLocale
        ),
        examKey: historical.examKey,
        questionArtifactHash: historical.questionArtifactHash,
        questionArtifactLocale: questionArtifactLocaleForSection(
          historical.sectionKey,
          appLocale
        ),
        questionContentKey: historical.questionContentKey,
        questionOrder: historical.questionOrder,
        questionSourcePath: historical.questionSourcePath,
        rendererDomain: historical.rendererDomain,
        scope: historical.scope,
        sectionKey: historical.sectionKey,
        setKey: historical.setKey,
        sourceRevision: historical.sourceRevision,
        trackKey: historical.trackKey,
      })
    ),
    rowKind: "placement",
  } as const;
}

/** Builds one signed section and placement selected by the repair graph. */
export function makeRepairSource(sectionKey: string, order: number) {
  const baseSection = makeTryoutStartCatalog("en", "visible", "irt").find(
    (row) => row.kind === "section"
  );
  assert.ok(baseSection?.kind === "section");
  const retained = sectionKey === RETAINED_SECTION_KEY && order === 1;
  const setKey = retained ? "set-1" : "set-2";
  const section = {
    family: "tryout",
    record: makeTryoutCatalogRecord({
      ...baseSection,
      examKey: "snbt",
      order,
      questionCount: 1,
      sectionKey,
      setKey,
      trackKey: "2027",
    }),
    rowKind: "catalog",
  } as const;
  if (retained) {
    return {
      historical: TEST_STORED_TRYOUT_PLACEMENT,
      placement: makeRetainedRepairPlacement(),
      section,
    };
  }
  const basePlacement = makeTryoutPlacementRow("en");
  const questionRoot = `question-bank/tryout/indonesia/snbt/${sectionKey}/${setKey}/question-1`;
  return {
    historical: undefined,
    placement: {
      family: "tryout",
      record: makeTryoutPlacementRecord({
        ...basePlacement.record.row,
        answerContentKey: ContentKeySchema.make(`${questionRoot}/answer`),
        examKey: "snbt",
        questionContentKey: ContentKeySchema.make(`${questionRoot}/question`),
        questionOrder: 1,
        questionSourcePath: CorpusSourcePathSchema.make(
          `packages/corpus/${questionRoot}`
        ),
        sectionKey,
        setKey,
        trackKey: "2027",
      }),
      rowKind: "placement",
    } as const,
    section,
  };
}

export type RepairSource = ReturnType<typeof makeRepairSource>;

/** Replaces placeholder fixtures with authenticated source and history rows. */
export async function seedRepairSource(
  ctx: MutationCtx,
  source: readonly RepairSource[]
) {
  const catalogs = await ctx.db
    .query("tryoutCatalog")
    .withIndex("by_snapshotId_and_index", (query) =>
      query.eq("snapshotId", CLEANUP_SOURCE_SNAPSHOT)
    )
    .take(source.length);
  const placements = await ctx.db
    .query("tryoutPlacements")
    .withIndex("by_snapshotId_and_index", (query) =>
      query.eq("snapshotId", CLEANUP_SOURCE_SNAPSHOT)
    )
    .take(source.length);
  const historicalCatalog = await ctx.db
    .query("tryoutHistoryRows")
    .withIndex("by_snapshotId_and_rowKind_and_index", (query) =>
      query.eq("snapshotId", CLEANUP_SOURCE_SNAPSHOT).eq("rowKind", "catalog")
    )
    .take(source.length);
  const historicalPlacements = await ctx.db
    .query("tryoutHistoryRows")
    .withIndex("by_snapshotId_and_rowKind_and_index", (query) =>
      query.eq("snapshotId", CLEANUP_SOURCE_SNAPSHOT).eq("rowKind", "placement")
    )
    .take(source.length);
  assert.ok(
    catalogs.length === source.length &&
      historicalCatalog.length === source.length &&
      placements[0]
  );
  for (const [index, row] of source.entries()) {
    const catalog = catalogs[index];
    const archivedCatalog = historicalCatalog[index];
    assert.ok(catalog && archivedCatalog);
    const catalogJson = canonicalizeContentSnapshotRow(row.section);
    await ctx.db.replace("tryoutCatalog", catalog._id, {
      ...tryoutCatalogFacts(row.section.record),
      index: catalog.index,
      rowHash: row.section.record.rowHash,
      rowJson: catalogJson,
      snapshotId: CLEANUP_SOURCE_SNAPSHOT,
    });
    await ctx.db.replace("tryoutHistoryRows", archivedCatalog._id, {
      index: archivedCatalog.index,
      rowHash: row.section.record.rowHash,
      rowJson: catalogJson,
      rowKind: "catalog",
      snapshotId: CLEANUP_SOURCE_SNAPSHOT,
    });
    const stored = placements[index];
    const placementJson = canonicalizeContentSnapshotRow(row.placement);
    const next = {
      ...tryoutPlacementFacts(row.placement.record),
      index: stored?.index ?? index + 1,
      rowHash: row.placement.record.rowHash,
      rowJson: placementJson,
      snapshotId: CLEANUP_SOURCE_SNAPSHOT,
    };
    if (stored) {
      await ctx.db.replace("tryoutPlacements", stored._id, next);
    } else {
      await ctx.db.insert("tryoutPlacements", next);
    }
    const archivedPlacement = historicalPlacements[index];
    const historical = row.historical;
    const history = {
      answerArtifactHash:
        historical?.record.row.answerArtifactHash ??
        row.placement.record.row.answerArtifactHash,
      index: archivedPlacement?.index ?? 33 + index,
      questionArtifactHash:
        historical?.record.row.questionArtifactHash ??
        row.placement.record.row.questionArtifactHash,
      rowHash: historical?.record.rowHash ?? row.placement.record.rowHash,
      rowJson: historical ? JSON.stringify(historical) : placementJson,
      rowKind: "placement" as const,
      snapshotId: CLEANUP_SOURCE_SNAPSHOT,
    };
    if (archivedPlacement) {
      await ctx.db.replace("tryoutHistoryRows", archivedPlacement._id, history);
    } else {
      await ctx.db.insert("tryoutHistoryRows", history);
    }
  }
}

/** Reproduces production after normal content cleanup retired live source rows. */
export function retireRepairSourceRows(test: CleanupTest) {
  return test.mutation(async (ctx) => {
    const [catalog, placements] = await Promise.all([
      ctx.db
        .query("tryoutCatalog")
        .withIndex("by_snapshotId_and_index", (query) =>
          query.eq("snapshotId", CLEANUP_SOURCE_SNAPSHOT)
        )
        .collect(),
      ctx.db
        .query("tryoutPlacements")
        .withIndex("by_snapshotId_and_index", (query) =>
          query.eq("snapshotId", CLEANUP_SOURCE_SNAPSHOT)
        )
        .collect(),
    ]);
    await Promise.all(
      [...catalog, ...placements].map((row) => ctx.db.delete(row._id))
    );
  });
}
