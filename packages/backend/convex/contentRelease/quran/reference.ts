import { QuranSearchRowSchema } from "@nakafa/aksara-contracts/quran/snapshot/row";
import { separateQuranRuntimeBismillah } from "@repo/backend/content/quran/bismillah";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  quranBismillahValidator,
  readQuranBismillah,
  verifyQuranBismillah,
} from "@repo/backend/convex/contentRelease/quran/bismillah";
import { readQuranChunks } from "@repo/backend/convex/contentRelease/quran/chunks";
import { quranSearchIdentity } from "@repo/backend/convex/contentRelease/quran/facts";
import { validateQuranReference } from "@repo/backend/convex/contentRelease/quran/input";
import { QURAN_PAGE_VERSE_LIMIT } from "@repo/backend/convex/contentRelease/quran/limits";
import { loadQuranOwner } from "@repo/backend/convex/contentRelease/quran/owner";
import { readQuranRow } from "@repo/backend/convex/contentRelease/quran/row";
import { readQuranLocaleSources } from "@repo/backend/convex/contentRelease/quran/sources";
import {
  type QuranReferenceArgs,
  quranReadingSourcesValidator,
  quranSourceFields,
  quranTafsirAccessValidator,
} from "@repo/backend/convex/contentRelease/quran/spec";
import { readQuranSurahRow } from "@repo/backend/convex/contentRelease/quran/surah";
import { v } from "convex/values";
import { Effect } from "effect";

const quranPassageFields = {
  ...quranSourceFields,
  chunkJson: v.array(v.string()),
  fromVerse: v.number(),
  searchJson: v.union(v.string(), v.null()),
  sources: v.union(quranReadingSourcesValidator, v.null()),
  surahJson: v.union(v.string(), v.null()),
  tafsirAccess: v.union(quranTafsirAccessValidator, v.null()),
  toVerse: v.number(),
};

/** Exact bounded Quran passage returned to product and agent readers. */
export const quranPassageValidator = v.object({
  ...quranPassageFields,
  preBismillah: v.union(quranBismillahValidator, v.null()),
});

type QuranPassageSourceRequest = Omit<QuranReferenceArgs, "appLocale"> & {
  readonly expectedSnapshotId: null | string;
};

/** Loads the active signed surah and validated range for one reference. */
const loadQuranPassageSource = Effect.fn(
  "contentRelease.loadQuranPassageSource"
)(function* (ctx: QueryCtx, request: QuranPassageSourceRequest) {
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
const readQuranPassageChunks = Effect.fn(
  "contentRelease.readQuranPassageChunks"
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
  function* (ctx: QueryCtx, request: QuranPassageSourceRequest) {
    const loaded = yield* loadQuranPassageSource(ctx, request);
    if (loaded.source === null || loaded.owner.snapshotId === null) {
      return { input: loaded.input, owner: loaded.owner, passage: null };
    }
    const chunks = yield* readQuranPassageChunks(
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

/** Returns one bounded signed Quran passage with a dedicated Bismillah. */
export const readQuranPassage = Effect.fn("contentRelease.readQuranPassage")(
  function* (ctx: QueryCtx, request: QuranReferenceArgs) {
    const loaded = yield* loadQuranPassage(ctx, {
      expectedSnapshotId: null,
      fromVerse: request.fromVerse,
      surahNumber: request.surahNumber,
      toVerse: request.toVerse,
    });
    if (loaded.passage === null || loaded.owner.snapshotId === null) {
      return {
        ...loaded.owner,
        chunkJson: [],
        fromVerse: loaded.input.fromVerse,
        preBismillah: null,
        searchJson: null,
        sources: null,
        surahJson: null,
        tafsirAccess: null,
        toVerse: loaded.input.toVerse,
      };
    }
    const { bismillah, localeSources, search } = yield* Effect.all(
      {
        bismillah: readQuranBismillah(
          ctx,
          loaded.owner.snapshotId,
          request.appLocale,
          loaded.input.surahNumber,
          loaded.input.fromVerse
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
    const selectedVerses = loaded.passage.chunks.rows
      .flatMap((chunk) => chunk.verses)
      .filter(
        (verse) =>
          verse.number.inSurah >= loaded.input.fromVerse &&
          verse.number.inSurah <= loaded.input.toVerse
      );
    const projected = separateQuranRuntimeBismillah(bismillah, selectedVerses);
    yield* verifyQuranBismillah(bismillah, projected.preBismillah);

    return {
      ...loaded.owner,
      chunkJson: loaded.passage.chunks.rowJson,
      fromVerse: loaded.input.fromVerse,
      preBismillah: projected.preBismillah,
      searchJson: search.rowJson,
      sources: localeSources.sources,
      surahJson: loaded.passage.surah.rowJson,
      tafsirAccess: localeSources.tafsirAccess,
      toVerse: loaded.input.toVerse,
    };
  }
);
