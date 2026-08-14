import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import { AUDITED_QURAN_SEARCH_COUNT } from "@repo/backend/convex/contentRelease/cutover/inventory";
import { persistReferenceProof } from "@repo/backend/convex/contentRelease/cutover/referenceProofs";
import { requireCutoverPhase } from "@repo/backend/convex/contentRelease/cutover/state";
import { ensureDocumentSize } from "@repo/backend/convex/contentRelease/document";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { QURAN_SEARCH_DOCUMENT_LIMIT } from "@repo/backend/convex/contentRelease/quran/limits";
import { authenticateQuranSearchHit } from "@repo/backend/convex/contentRelease/quran/search";
import { loadActiveSnapshot } from "@repo/backend/convex/contentRelease/runtime/snapshot";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { v } from "convex/values";
import { Effect } from "effect";

/**
 * Three rows cap worst-case reads below 8 MiB from enforced row ceilings.
 *
 * The bound includes one lookahead row, three signed rows, and up to two
 * candidates from each of both reference indexes for every processed row.
 */
export const QURAN_REFERENCE_PAGE_LIMIT = 3;
const QURAN_REFERENCE_ROW_READ_LIMIT =
  QURAN_REFERENCE_PAGE_LIMIT + 1 + QURAN_REFERENCE_PAGE_LIMIT * 5;
export const QURAN_REFERENCE_READ_CEILING =
  QURAN_REFERENCE_ROW_READ_LIMIT * QURAN_SEARCH_DOCUMENT_LIMIT;

const quranReferencePageValidator = v.object({
  checked: v.number(),
  complete: v.boolean(),
  nextIndex: v.union(v.number(), v.null()),
  processed: v.number(),
  staged: v.number(),
});

interface QuranReferenceProgress {
  readonly afterIndex: number;
  readonly checked: number;
  readonly snapshotId: string;
}

/** Authenticates and stages one bounded Quran reference page. */
export const checkpointQuranReferencePage = Effect.fn(
  "contentRelease.cutover.checkpointQuranReferencePage"
)(function* (ctx: MutationCtx, expectedCount: number) {
  const state = yield* requireCutoverPhase(ctx, ["quiescent"]);
  const selected = yield* loadActiveSnapshot(ctx, "quran");
  if (!(selected && selected.snapshot.family === "quran")) {
    return yield* quranAssetFailure(
      "The active verified Quran snapshot is unavailable."
    );
  }
  if (selected.snapshot.manifest.searchCount !== expectedCount) {
    return yield* quranAssetFailure(
      `The signed snapshot declares ${selected.snapshot.manifest.searchCount} search rows instead of ${expectedCount}.`
    );
  }
  if (state.quranReferenceProof !== undefined) {
    if (
      state.quranReferenceProgress !== undefined ||
      state.quranReferenceProof.count !== expectedCount ||
      state.quranReferenceProof.provedAt < state.auditedAt
    ) {
      return yield* quranAssetFailure(
        "The completed Quran reference checkpoint is inconsistent."
      );
    }
    return pageReceipt(expectedCount, true, null, 0, 0);
  }

  const progress = yield* loadProgress(
    state.quranReferenceProgress,
    selected.snapshotId,
    expectedCount
  );
  const stored = yield* Effect.promise(() =>
    ctx.db
      .query("quranSearch")
      .withIndex("by_snapshotId_and_index", (index) =>
        index
          .eq("snapshotId", selected.snapshotId)
          .gt("index", progress.afterIndex)
      )
      .take(QURAN_REFERENCE_PAGE_LIMIT + 1)
  );
  const page = stored.slice(0, QURAN_REFERENCE_PAGE_LIMIT);
  if (page.length === 0) {
    return yield* quranAssetFailure(
      `The Quran reference proof ended after ${progress.checked} rows instead of ${expectedCount}.`
    );
  }

  let staged = 0;
  for (const row of page) {
    staged += yield* authenticateAndStageQuranReference(
      ctx,
      selected.snapshotId,
      row
    );
  }
  const checked = progress.checked + page.length;
  if (checked > expectedCount) {
    return yield* quranAssetFailure(
      `The Quran reference proof exceeded ${expectedCount} rows.`
    );
  }
  const afterIndex = page.at(-1)?.index;
  if (afterIndex === undefined) {
    return yield* quranAssetFailure("The Quran reference page has no cursor.");
  }
  const complete = stored.length <= QURAN_REFERENCE_PAGE_LIMIT;
  if (!complete) {
    yield* Effect.promise(() =>
      ctx.db.patch("contentCutoverState", state._id, {
        quranReferenceProgress: {
          afterIndex,
          checked,
          snapshotId: selected.snapshotId,
        },
        updatedAt: Date.now(),
      })
    );
    return pageReceipt(checked, false, afterIndex, page.length, staged);
  }
  if (checked !== expectedCount) {
    return yield* quranAssetFailure(
      `The Quran reference proof found ${checked} rows instead of ${expectedCount}.`
    );
  }

  yield* persistReferenceProof(ctx, "quran", checked, expectedCount);
  yield* Effect.promise(() =>
    ctx.db.patch("contentCutoverState", state._id, {
      quranReferenceProgress: undefined,
    })
  );
  return pageReceipt(checked, true, null, page.length, staged);
});

/** Bounded production checkpoint; invoke repeatedly until complete. */
export const checkpoint = internalMutation({
  args: {},
  returns: quranReferencePageValidator,
  handler: (ctx) =>
    runConvexProgram(
      checkpointQuranReferencePage(ctx, AUDITED_QURAN_SEARCH_COUNT)
    ),
});

/** Authenticates one signed row, stages missing facts, and proves both indexes. */
const authenticateAndStageQuranReference = Effect.fn(
  "contentRelease.cutover.authenticateAndStageQuranReference"
)(function* (ctx: MutationCtx, snapshotId: string, row: Doc<"quranSearch">) {
  const signed = yield* authenticateQuranSearchHit(ctx, snapshotId, row);
  const assetId = signed.payload.graph.assetId;
  const publicPath = signed.payload.route;
  if (
    (row.assetId !== undefined && row.assetId !== assetId) ||
    (row.publicPath !== undefined && row.publicPath !== publicPath)
  ) {
    return yield* quranAssetFailure(
      `Quran search row ${row.identity} has different stored reference facts.`
    );
  }
  const staged = row.assetId !== assetId || row.publicPath !== publicPath;
  if (staged) {
    yield* ensureDocumentSize(
      `Quran search row ${row.identity}`,
      { ...row, assetId, publicPath },
      QURAN_SEARCH_DOCUMENT_LIMIT
    );
    yield* Effect.promise(() =>
      ctx.db.patch("quranSearch", row._id, { assetId, publicPath })
    );
  }
  const [assetRows, routeRows] = yield* Effect.all([
    Effect.promise(() =>
      ctx.db
        .query("quranSearch")
        .withIndex("by_snapshotId_and_assetId", (index) =>
          index.eq("snapshotId", snapshotId).eq("assetId", assetId)
        )
        .take(2)
    ),
    Effect.promise(() =>
      ctx.db
        .query("quranSearch")
        .withIndex("by_snapshotId_and_locale_and_publicPath", (index) =>
          index
            .eq("snapshotId", snapshotId)
            .eq("locale", row.locale)
            .eq("publicPath", publicPath)
        )
        .take(2)
    ),
  ]);
  if (assetRows.length !== 1 || assetRows[0]?._id !== row._id) {
    return yield* quranAssetFailure(
      `Quran asset ${row.locale}/${assetId} does not resolve exactly.`
    );
  }
  if (routeRows.length !== 1 || routeRows[0]?._id !== row._id) {
    return yield* quranAssetFailure(
      `Quran route ${row.locale}/${publicPath} does not resolve exactly.`
    );
  }
  return staged ? 1 : 0;
});

const loadProgress = Effect.fn("contentRelease.cutover.loadQuranProofProgress")(
  function* (
    stored: QuranReferenceProgress | undefined,
    snapshotId: string,
    expectedCount: number
  ) {
    const progress = stored ?? { afterIndex: -1, checked: 0, snapshotId };
    if (
      progress.snapshotId !== snapshotId ||
      !Number.isSafeInteger(progress.afterIndex) ||
      progress.afterIndex < -1 ||
      !Number.isSafeInteger(progress.checked) ||
      progress.checked < 0 ||
      progress.checked >= expectedCount
    ) {
      return yield* quranAssetFailure(
        "The durable Quran reference cursor is invalid."
      );
    }
    return progress;
  }
);

function pageReceipt(
  checked: number,
  complete: boolean,
  nextIndex: null | number,
  processed: number,
  staged: number
) {
  return { checked, complete, nextIndex, processed, staged };
}

function quranAssetFailure(message: string) {
  return releaseFail(
    "CONTENT_RELEASE_INTEGRITY",
    `Quran reader cutover: ${message}`
  );
}
