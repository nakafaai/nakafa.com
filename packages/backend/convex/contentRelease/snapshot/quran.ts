import type { ContentSnapshotRow } from "@nakafa/aksara-contracts/release/snapshot-data";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { ensureDocumentSize } from "@repo/backend/convex/contentRelease/document";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { Effect } from "effect";

type QuranRow = Extract<ContentSnapshotRow, { readonly family: "quran" }>;

/** Derives one collision-proof identity from a decoded Quran row. */
function rowIdentity(source: QuranRow) {
  const payload = source.record.payload;
  if (payload.kind === "quran-attribution") {
    return `attribution:${payload.sources.map(({ id }) => id).join(":")}`;
  }
  if (payload.kind === "quran-surah") {
    return `surah:${payload.number}`;
  }
  if (payload.kind === "quran-chunk") {
    return `chunk:${payload.surahNumber}:${payload.firstVerse}`;
  }
  return `search:${payload.locale}:${payload.surahNumber}`;
}

/** Derives only the indexed location fields owned by one Quran row kind. */
function rowLocation(source: QuranRow) {
  const payload = source.record.payload;
  if (payload.kind === "quran-attribution") {
    return {};
  }
  if (payload.kind === "quran-surah") {
    return { surahNumber: payload.number };
  }
  if (payload.kind === "quran-chunk") {
    return {
      firstVerse: payload.firstVerse,
      surahNumber: payload.surahNumber,
    };
  }
  return {
    locale: payload.locale,
    surahNumber: payload.surahNumber,
  };
}

/** Stores one immutable Quran row at its exact signed snapshot index. */
export const stageQuranRow = Effect.fn("contentRelease.stageQuranRow")(
  function* (
    ctx: MutationCtx,
    snapshotId: string,
    index: number,
    source: QuranRow,
    rowJson: string
  ) {
    if (source.record.snapshotId !== snapshotId) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Quran row ${index} is bound to another snapshot.`
      );
    }
    const payload = source.record.payload;
    const identity = rowIdentity(source);
    const byIndex = yield* Effect.promise(() =>
      ctx.db
        .query("quranRows")
        .withIndex("by_snapshotId_and_index", (query) =>
          query.eq("snapshotId", snapshotId).eq("index", index)
        )
        .unique()
    );
    const byIdentity = yield* Effect.promise(() =>
      ctx.db
        .query("quranRows")
        .withIndex("by_snapshotId_and_identity", (query) =>
          query.eq("snapshotId", snapshotId).eq("identity", identity)
        )
        .unique()
    );
    if (byIndex || byIdentity) {
      if (
        !(byIndex && byIdentity) ||
        byIndex._id !== byIdentity._id ||
        byIndex.rowJson !== rowJson ||
        byIndex.rowHash !== source.record.rowHash
      ) {
        return yield* releaseFail(
          "CONTENT_RELEASE_CONFLICT",
          `Quran snapshot ${snapshotId} has a row identity collision.`
        );
      }
      return true;
    }
    const row = {
      identity,
      index,
      kind: payload.kind,
      ...rowLocation(source),
      rowHash: source.record.rowHash,
      rowJson,
      snapshotId,
    };
    yield* ensureDocumentSize(`Quran snapshot ${snapshotId} row ${index}`, row);
    yield* Effect.promise(() => ctx.db.insert("quranRows", row));
    return false;
  }
);
