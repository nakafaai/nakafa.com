import {
  type QuranSearchRow,
  QuranSearchRowSchema,
  QuranSurahRowSchema,
} from "@nakafa/aksara-contracts/quran/spec";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { readQuranChunks } from "@repo/backend/convex/contentRelease/quran/chunks";
import { quranSearchIdentity } from "@repo/backend/convex/contentRelease/quran/facts";
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

interface QuranReferenceLoadRequest extends QuranReferenceRequest {
  readonly expectedSnapshotId: null | string;
}

/** Loads one bounded verified Quran verse reference from the active snapshot. */
export const loadQuranReference = Effect.fn(
  "contentRelease.loadQuranReference"
)(function* (ctx: QueryCtx, request: QuranReferenceLoadRequest) {
  const input = yield* validateQuranReference(request);
  const owner = yield* loadQuranOwner(ctx);
  if (owner.snapshotId === null) {
    return { input, owner, reference: null };
  }
  if (
    request.expectedSnapshotId !== null &&
    owner.snapshotId !== request.expectedSnapshotId
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_CONFLICT",
      "The active Quran snapshot changed after this page was rendered."
    );
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
  const { chunks, search } = yield* Effect.all(
    {
      chunks: readQuranChunks(ctx, {
        fromVerse: input.fromVerse,
        numberOfVerses: surah.payload.numberOfVerses,
        snapshotId: owner.snapshotId,
        surahNumber: input.surahNumber,
        toVerse: input.toVerse,
      }),
      search: readQuranRow(
        ctx,
        owner.snapshotId,
        quranSearchIdentity(request.locale, input.surahNumber),
        QuranSearchRowSchema
      ),
    },
    { concurrency: "unbounded" }
  );
  return { input, owner, reference: { chunks, search, surah } };
});

/** Returns one bounded verified Quran range through the existing wire contract. */
export const readQuranReference = Effect.fn(
  "contentRelease.readQuranReference"
)(function* (ctx: QueryCtx, request: QuranReferenceRequest) {
  const loaded = yield* loadQuranReference(ctx, {
    ...request,
    expectedSnapshotId: null,
  });
  if (loaded.reference === null) {
    return {
      ...loaded.owner,
      chunkJson: [],
      fromVerse: loaded.input.fromVerse,
      searchJson: null,
      surahJson: null,
      toVerse: loaded.input.toVerse,
    };
  }

  return {
    ...loaded.owner,
    chunkJson: loaded.reference.chunks.rowJson,
    fromVerse: loaded.input.fromVerse,
    searchJson: loaded.reference.search.rowJson,
    surahJson: loaded.reference.surah.rowJson,
    toVerse: loaded.input.toVerse,
  };
});
