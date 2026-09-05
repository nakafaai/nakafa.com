import { QuranSearchRowSchema } from "@nakafa/aksara-contracts/quran/snapshot/row";
import type { PublicationRow } from "@repo/backend/content/publication/source";
import { readQuranRow } from "@repo/backend/content/quran/row";
import { ensureDocumentSize } from "@repo/backend/convex/contentRelease/document";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { quranSearchFacts } from "@repo/backend/convex/contentRelease/quran/facts";
import { QURAN_SEARCH_DOCUMENT_LIMIT } from "@repo/backend/convex/contentRelease/quran/limits";
import { Effect } from "effect";

/** Resolves one search hit back to its exact authenticated Quran row. */
export const authenticateQuranSearchHit = Effect.fn(
  "contents.search.authenticateQuranSearchHit"
)(function* (snapshotId: string, hit: PublicationRow<"quranSearch">) {
  yield* ensureDocumentSize(
    `Quran search row ${hit.identity}`,
    {
      appLocale: hit.appLocale,
      assetId: hit.assetId,
      identity: hit.identity,
      index: hit.index,
      rowHash: hit.rowHash,
      snapshotId: hit.snapshotId,
      surahNumber: hit.surahNumber,
      text: hit.text,
    },
    QURAN_SEARCH_DOCUMENT_LIMIT
  );
  const signed = yield* readQuranRow(
    snapshotId,
    hit.identity,
    QuranSearchRowSchema
  );
  const facts = quranSearchFacts(signed.payload);
  if (
    facts.identity !== hit.identity ||
    facts.appLocale !== hit.appLocale ||
    facts.assetId !== hit.assetId ||
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
