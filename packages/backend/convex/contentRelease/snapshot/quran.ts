import type { ContentSnapshotRow } from "@nakafa/aksara-contracts/release/snapshot/data";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { ensureDocumentSize } from "@repo/backend/convex/contentRelease/document";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  quranRowFacts,
  quranSearchFacts,
} from "@repo/backend/convex/contentRelease/quran/facts";
import {
  QURAN_SEARCH_DOCUMENT_LIMIT,
  quranRowDocumentLimit,
} from "@repo/backend/convex/contentRelease/quran/limits";
import { Effect } from "effect";

type QuranRow = Extract<ContentSnapshotRow, { readonly family: "quran" }>;

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
    if (
      source.record.payload.kind === "quran-search" &&
      source.record.payload.route !==
        `quran/${source.record.payload.surahNumber}`
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Quran search row ${index} has a noncanonical route.`
      );
    }
    const facts = quranRowFacts(source.record);
    const searchFacts =
      source.record.payload.kind === "quran-search"
        ? quranSearchFacts(source.record.payload)
        : null;
    const stored = {
      ...facts,
      index,
      rowHash: source.record.rowHash,
      rowJson,
      snapshotId,
    };
    const searchStored =
      searchFacts === null
        ? null
        : {
            ...searchFacts,
            index,
            rowHash: source.record.rowHash,
            snapshotId,
          };
    yield* ensureDocumentSize(
      `Quran snapshot ${snapshotId} row ${index}`,
      stored,
      quranRowDocumentLimit(source.record.payload.kind)
    );
    if (searchStored !== null) {
      yield* ensureDocumentSize(
        `Quran snapshot ${snapshotId} search row ${index}`,
        searchStored,
        QURAN_SEARCH_DOCUMENT_LIMIT
      );
    }
    const [byIndex, byIdentity, searchByIndex, searchByIdentity] =
      yield* Effect.all([
        Effect.promise(() =>
          ctx.db
            .query("quranRows")
            .withIndex("by_snapshotId_and_index", (query) =>
              query.eq("snapshotId", snapshotId).eq("index", index)
            )
            .unique()
        ),
        Effect.promise(() =>
          ctx.db
            .query("quranRows")
            .withIndex("by_snapshotId_and_identity", (query) =>
              query.eq("snapshotId", snapshotId).eq("identity", facts.identity)
            )
            .unique()
        ),
        Effect.promise(() =>
          ctx.db
            .query("quranSearch")
            .withIndex("by_snapshotId_and_index", (query) =>
              query.eq("snapshotId", snapshotId).eq("index", index)
            )
            .unique()
        ),
        searchStored === null
          ? Effect.succeed(null)
          : Effect.promise(() =>
              ctx.db
                .query("quranSearch")
                .withIndex("by_snapshotId_and_identity", (query) =>
                  query
                    .eq("snapshotId", snapshotId)
                    .eq("identity", searchStored.identity)
                )
                .unique()
            ),
      ]);
    if (byIndex || byIdentity) {
      if (
        !(byIndex && byIdentity) ||
        byIndex._id !== byIdentity._id ||
        byIndex.firstVerse !== stored.firstVerse ||
        byIndex.identity !== stored.identity ||
        byIndex.kind !== stored.kind ||
        byIndex.locale !== stored.locale ||
        byIndex.rowJson !== rowJson ||
        byIndex.rowHash !== source.record.rowHash ||
        byIndex.surahNumber !== stored.surahNumber
      ) {
        return yield* releaseFail(
          "CONTENT_RELEASE_CONFLICT",
          `Quran snapshot ${snapshotId} has a row identity collision.`
        );
      }
      if (searchStored === null) {
        if (searchByIndex !== null) {
          return yield* releaseFail(
            "CONTENT_RELEASE_CONFLICT",
            `Quran snapshot ${snapshotId} has an orphaned search row.`
          );
        }
        return true;
      }
      if (
        !(searchByIndex && searchByIdentity) ||
        searchByIndex._id !== searchByIdentity._id ||
        (searchByIndex.assetId !== undefined &&
          searchByIndex.assetId !== searchStored.assetId) ||
        searchByIndex.identity !== searchStored.identity ||
        searchByIndex.locale !== searchStored.locale ||
        searchByIndex.rowHash !== searchStored.rowHash ||
        searchByIndex.surahNumber !== searchStored.surahNumber ||
        searchByIndex.text !== searchStored.text
      ) {
        return yield* releaseFail(
          "CONTENT_RELEASE_CONFLICT",
          `Quran snapshot ${snapshotId} has a search identity collision.`
        );
      }
      return true;
    }
    if (searchByIndex || searchByIdentity) {
      return yield* releaseFail(
        "CONTENT_RELEASE_CONFLICT",
        `Quran snapshot ${snapshotId} has an orphaned search row.`
      );
    }
    yield* Effect.promise(() => ctx.db.insert("quranRows", stored));
    if (searchStored !== null) {
      yield* Effect.promise(() => ctx.db.insert("quranSearch", searchStored));
    }
    return false;
  }
);
