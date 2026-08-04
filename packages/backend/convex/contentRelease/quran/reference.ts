import {
  type QuranSearchRow,
  QuranSearchRowSchema,
  QuranSurahRowSchema,
} from "@nakafa/aksara-contracts/quran/spec";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { readQuranChunks } from "@repo/backend/convex/contentRelease/quran/chunks";
import { validateQuranReference } from "@repo/backend/convex/contentRelease/quran/input";
import { QURAN_PAGE_VERSE_LIMIT } from "@repo/backend/convex/contentRelease/quran/limits";
import { loadQuranOwner } from "@repo/backend/convex/contentRelease/quran/owner";
import { readQuranRow } from "@repo/backend/convex/contentRelease/quran/row";
import { Effect } from "effect";

interface QuranReferenceRequest {
  readonly fromVerse: number;
  readonly locale: QuranSearchRow["locale"];
  readonly surahNumber: number;
  readonly toVerse?: number;
}

/** Loads one bounded verified Quran verse reference from the active snapshot. */
export const readQuranReference = Effect.fn(
  "contentRelease.readQuranReference"
)(function* (ctx: QueryCtx, request: QuranReferenceRequest) {
  const input = yield* validateQuranReference(request);
  const owner = yield* loadQuranOwner(ctx);
  if (owner.snapshotId === null) {
    return {
      ...owner,
      chunkJson: [],
      fromVerse: input.fromVerse,
      searchJson: null,
      surahJson: null,
      toVerse: input.toVerse,
    };
  }
  const surah = yield* readQuranRow(
    ctx,
    owner.snapshotId,
    `surah:${input.surahNumber}`,
    QuranSurahRowSchema
  );
  if (surah.payload.numberOfVerses > QURAN_PAGE_VERSE_LIMIT) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Quran surah ${input.surahNumber} exceeds ${QURAN_PAGE_VERSE_LIMIT} verses.`
    );
  }
  if (input.toVerse > surah.payload.numberOfVerses) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INVALID_REQUEST",
      `Quran surah ${input.surahNumber} ends at verse ${surah.payload.numberOfVerses}.`
    );
  }
  const chunks = yield* readQuranChunks(ctx, {
    fromVerse: input.fromVerse,
    numberOfVerses: surah.payload.numberOfVerses,
    snapshotId: owner.snapshotId,
    surahNumber: input.surahNumber,
    toVerse: input.toVerse,
  });
  const search = yield* readQuranRow(
    ctx,
    owner.snapshotId,
    `search:${request.locale}:${input.surahNumber}`,
    QuranSearchRowSchema
  );
  return {
    ...owner,
    chunkJson: chunks.rowJson,
    fromVerse: input.fromVerse,
    searchJson: search.rowJson,
    surahJson: surah.rowJson,
    toVerse: input.toVerse,
  };
});
