import { QuranSearchRowSchema } from "@nakafa/aksara-contracts/quran/spec";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { ensureDocumentSize } from "@repo/backend/convex/contentRelease/document";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { quranSearchFacts } from "@repo/backend/convex/contentRelease/quran/facts";
import { QURAN_SEARCH_DOCUMENT_LIMIT } from "@repo/backend/convex/contentRelease/quran/limits";
import { readQuranRow } from "@repo/backend/convex/contentRelease/quran/row";
import { Effect } from "effect";

/** Resolves one search hit back to its exact authenticated Quran row. */
export const authenticateQuranSearchHit = Effect.fn(
  "contents.search.authenticateQuranSearchHit"
)(function* (ctx: QueryCtx, snapshotId: string, hit: Doc<"quranSearch">) {
  yield* ensureDocumentSize(
    `Quran search row ${hit.identity}`,
    {
      assetId: hit.assetId,
      identity: hit.identity,
      index: hit.index,
      locale: hit.locale,
      publicPath: hit.publicPath,
      rowHash: hit.rowHash,
      snapshotId: hit.snapshotId,
      surahNumber: hit.surahNumber,
      text: hit.text,
    },
    QURAN_SEARCH_DOCUMENT_LIMIT
  );
  const signed = yield* readQuranRow(
    ctx,
    snapshotId,
    hit.identity,
    QuranSearchRowSchema
  );
  const facts = quranSearchFacts(signed.payload);
  if (
    (hit.assetId !== undefined && facts.assetId !== hit.assetId) ||
    facts.identity !== hit.identity ||
    facts.locale !== hit.locale ||
    (hit.publicPath !== undefined && facts.publicPath !== hit.publicPath) ||
    facts.surahNumber !== hit.surahNumber ||
    facts.text !== hit.text ||
    signed.index !== hit.index ||
    signed.rowHash !== hit.rowHash
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Quran search row ${hit.identity} changed its signed projection.`
    );
  }
  return signed;
});
