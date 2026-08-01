import {
  type QuranSearchRow,
  QuranSearchRowSchema,
} from "@nakafa/aksara-contracts/quran/spec";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { ensureDocumentSize } from "@repo/backend/convex/contentRelease/document";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { quranSearchFacts } from "@repo/backend/convex/contentRelease/quran/facts";
import {
  QURAN_SEARCH_CHARACTER_LIMIT,
  QURAN_SEARCH_DOCUMENT_LIMIT,
  QURAN_SEARCH_RESULT_LIMIT,
} from "@repo/backend/convex/contentRelease/quran/limits";
import { loadQuranOwner } from "@repo/backend/convex/contentRelease/quran/owner";
import { readQuranRow } from "@repo/backend/convex/contentRelease/quran/row";
import { validateSearchQuery } from "@repo/backend/convex/contentRelease/search/input";
import { Effect } from "effect";

/** Resolves one search hit back to its exact authenticated Quran row. */
const resolveQuranSearchHit = Effect.fn("contentRelease.resolveQuranSearchHit")(
  function* (ctx: QueryCtx, snapshotId: string, hit: Doc<"quranSearch">) {
    yield* ensureDocumentSize(
      `Quran search row ${hit.identity}`,
      {
        identity: hit.identity,
        index: hit.index,
        locale: hit.locale,
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
      facts.identity !== hit.identity ||
      facts.locale !== hit.locale ||
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
    return signed.rowJson;
  }
);

/** Searches only bounded localized rows from the active Quran snapshot. */
export const searchQuran = Effect.fn("contentRelease.searchQuran")(function* (
  ctx: QueryCtx,
  locale: QuranSearchRow["locale"],
  sourceQuery: string
) {
  const query = yield* validateSearchQuery(sourceQuery, {
    characterLimit: QURAN_SEARCH_CHARACTER_LIMIT,
  });
  const owner = yield* loadQuranOwner(ctx);
  if (owner.snapshotId === null) {
    return {
      ...owner,
      rowJson: [],
    };
  }
  const stored = yield* Effect.promise(() =>
    ctx.db
      .query("quranSearch")
      .withSearchIndex("search_text", (search) =>
        search
          .search("text", query)
          .eq("snapshotId", owner.snapshotId)
          .eq("locale", locale)
      )
      .take(QURAN_SEARCH_RESULT_LIMIT)
  );
  const rowJson = yield* Effect.forEach(stored, (hit) =>
    resolveQuranSearchHit(ctx, owner.snapshotId, hit)
  );
  return {
    ...owner,
    rowJson,
  };
});
