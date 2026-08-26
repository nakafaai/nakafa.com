import { QuranSearchRowSchema } from "@nakafa/aksara-contracts/quran/snapshot/row";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { readQuranChunks } from "@repo/backend/convex/contentRelease/quran/chunks";
import { quranSearchIdentity } from "@repo/backend/convex/contentRelease/quran/facts";
import { validateQuranReference } from "@repo/backend/convex/contentRelease/quran/input";
import { QURAN_PAGE_VERSE_LIMIT } from "@repo/backend/convex/contentRelease/quran/limits";
import { loadQuranOwner } from "@repo/backend/convex/contentRelease/quran/owner";
import { readQuranRow } from "@repo/backend/convex/contentRelease/quran/row";
import { readQuranLocaleSources } from "@repo/backend/convex/contentRelease/quran/sources";
import type { QuranReferenceArgs } from "@repo/backend/convex/contentRelease/quran/spec";
import { readQuranSurahRow } from "@repo/backend/convex/contentRelease/quran/surah";
import { Effect } from "effect";

type QuranReferenceSourceRequest = Omit<QuranReferenceArgs, "appLocale"> & {
  readonly expectedSnapshotId: null | string;
};

/** Loads the active signed surah and validated range for one reference. */
const loadQuranReferenceSource = Effect.fn(
  "contentRelease.loadQuranReferenceSource"
)(function* (ctx: QueryCtx, request: QuranReferenceSourceRequest) {
  const input = yield* validateQuranReference(request);
  const owner = yield* loadQuranOwner(ctx);
  if (
    request.expectedSnapshotId !== null &&
    owner.snapshotId !== request.expectedSnapshotId
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_CONFLICT",
      "The active Quran snapshot changed after this page was rendered."
    );
  }
  if (owner.snapshotId === null) {
    return { input, owner, source: null };
  }
  const surah = yield* readQuranSurahRow(
    ctx,
    owner.snapshotId,
    input.surahNumber
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
  return { input, owner, source: { surah } };
});

/** Reads only the immutable chunks covering one validated Quran range. */
const readQuranReferenceChunks = Effect.fn(
  "contentRelease.readQuranReferenceChunks"
)(function* (
  ctx: QueryCtx,
  snapshotId: string,
  input: {
    readonly fromVerse: number;
    readonly surahNumber: number;
    readonly toVerse: number;
  },
  numberOfVerses: number
) {
  return yield* readQuranChunks(ctx, {
    fromVerse: input.fromVerse,
    numberOfVerses,
    snapshotId,
    surahNumber: input.surahNumber,
    toVerse: input.toVerse,
  });
});

/** Loads one signed passage without reading an unrelated search document. */
export const loadQuranPassage = Effect.fn("contentRelease.loadQuranPassage")(
  function* (ctx: QueryCtx, request: QuranReferenceSourceRequest) {
    const loaded = yield* loadQuranReferenceSource(ctx, request);
    if (loaded.source === null || loaded.owner.snapshotId === null) {
      return { input: loaded.input, owner: loaded.owner, passage: null };
    }
    const chunks = yield* readQuranReferenceChunks(
      ctx,
      loaded.owner.snapshotId,
      loaded.input,
      loaded.source.surah.payload.numberOfVerses
    );
    return {
      input: loaded.input,
      owner: loaded.owner,
      passage: { chunks, surah: loaded.source.surah },
    };
  }
);

/** Returns one bounded verified Quran range through the existing wire contract. */
export const readQuranReference = Effect.fn(
  "contentRelease.readQuranReference"
)(function* (ctx: QueryCtx, request: QuranReferenceArgs) {
  const loaded = yield* loadQuranReferenceSource(ctx, {
    expectedSnapshotId: null,
    fromVerse: request.fromVerse,
    surahNumber: request.surahNumber,
    toVerse: request.toVerse,
  });
  if (loaded.source === null || loaded.owner.snapshotId === null) {
    return {
      ...loaded.owner,
      chunkJson: [],
      fromVerse: loaded.input.fromVerse,
      searchJson: null,
      sources: null,
      surahJson: null,
      tafsirAccess: null,
      toVerse: loaded.input.toVerse,
    };
  }
  const { chunks, localeSources, search } = yield* Effect.all(
    {
      chunks: readQuranReferenceChunks(
        ctx,
        loaded.owner.snapshotId,
        loaded.input,
        loaded.source.surah.payload.numberOfVerses
      ),
      localeSources: readQuranLocaleSources(
        ctx,
        loaded.owner.snapshotId,
        request.appLocale
      ),
      search: readQuranRow(
        ctx,
        loaded.owner.snapshotId,
        quranSearchIdentity(request.appLocale, loaded.input.surahNumber),
        QuranSearchRowSchema
      ),
    },
    { concurrency: "unbounded" }
  );

  return {
    ...loaded.owner,
    chunkJson: chunks.rowJson,
    fromVerse: loaded.input.fromVerse,
    searchJson: search.rowJson,
    sources: localeSources.sources,
    surahJson: loaded.source.surah.rowJson,
    tafsirAccess: localeSources.tafsirAccess,
    toVerse: loaded.input.toVerse,
  };
});
