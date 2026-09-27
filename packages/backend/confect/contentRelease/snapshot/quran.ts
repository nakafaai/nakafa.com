import { DatabaseReader, DatabaseWriter } from "@confect/server";
import type { ContentSnapshotRow } from "@nakafa/aksara-contracts/release/snapshot/data";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { ensureDocumentSize } from "@repo/backend/confect/contentRelease/document";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import {
  quranRowFacts,
  quranSearchFacts,
} from "@repo/backend/confect/contentRelease/quran/facts";
import {
  QURAN_SEARCH_DOCUMENT_LIMIT,
  quranRowDocumentLimit,
} from "@repo/backend/confect/contentRelease/quran/limits";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type { WithoutSystemFields } from "convex/server";
import { Effect } from "effect";

type QuranRow = Extract<
  ContentSnapshotRow,
  {
    readonly family: "quran";
  }
>;

/** Validates the complete search companion of an existing immutable Quran row. */
const verifySearchReplay = Effect.fn("contentRelease.verifyQuranSearchReplay")(
  function* (
    snapshotId: string,
    searchStored: WithoutSystemFields<Doc<"quranSearch">> | null,
    searchByIndex: Doc<"quranSearch"> | null,
    searchByIdentity: Doc<"quranSearch"> | null
  ) {
    if (searchStored === null) {
      if (searchByIndex !== null) {
        return yield* releaseFail(
          "CONTENT_RELEASE_CONFLICT",
          `Quran snapshot ${snapshotId} has an orphaned search row.`
        );
      }
      return;
    }
    if (
      !(searchByIndex && searchByIdentity) ||
      searchByIndex._id !== searchByIdentity._id ||
      searchByIndex.assetId !== searchStored.assetId ||
      searchByIndex.identity !== searchStored.identity ||
      searchByIndex.appLocale !== searchStored.appLocale ||
      searchByIndex.rowHash !== searchStored.rowHash ||
      searchByIndex.surahNumber !== searchStored.surahNumber ||
      searchByIndex.text !== searchStored.text
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_CONFLICT",
        `Quran snapshot ${snapshotId} has a search identity collision.`
      );
    }
  }
);

/** Stores one immutable Quran row at its exact signed snapshot index. */
export const stageQuranRow = Effect.fn("contentRelease.stageQuranRow")(
  function* (
    ctx: MutationCtx,
    snapshotId: string,
    index: number,
    source: QuranRow,
    rowJson: string
  ) {
    const database = DatabaseReader.make(databaseSchema, ctx.db);
    const writer = DatabaseWriter.make(databaseSchema, ctx.db);
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
        database
          .table("quranRows")
          .get("by_snapshotId_and_index", snapshotId, index)
          .pipe(
            Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
            Effect.orDie
          ),
        database
          .table("quranRows")
          .get("by_snapshotId_and_identity", snapshotId, facts.identity)
          .pipe(
            Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
            Effect.orDie
          ),
        database
          .table("quranSearch")
          .get("by_snapshotId_and_index", snapshotId, index)
          .pipe(
            Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
            Effect.orDie
          ),
        searchStored === null
          ? Effect.succeed(null)
          : database
              .table("quranSearch")
              .get(
                "by_snapshotId_and_identity",
                snapshotId,
                searchStored.identity
              )
              .pipe(
                Effect.catchTag("GetByIndexFailure", () =>
                  Effect.succeed(null)
                ),
                Effect.orDie
              ),
      ]);
    if (byIndex || byIdentity) {
      if (
        !(byIndex && byIdentity) ||
        byIndex._id !== byIdentity._id ||
        byIndex.firstVerse !== stored.firstVerse ||
        byIndex.identity !== stored.identity ||
        byIndex.kind !== stored.kind ||
        byIndex.appLocale !== stored.appLocale ||
        byIndex.rowJson !== rowJson ||
        byIndex.rowHash !== source.record.rowHash ||
        byIndex.surahNumber !== stored.surahNumber
      ) {
        return yield* releaseFail(
          "CONTENT_RELEASE_CONFLICT",
          `Quran snapshot ${snapshotId} has a row identity collision.`
        );
      }
      yield* verifySearchReplay(
        snapshotId,
        searchStored,
        searchByIndex,
        searchByIdentity
      );
      return true;
    }
    if (searchByIndex || searchByIdentity) {
      return yield* releaseFail(
        "CONTENT_RELEASE_CONFLICT",
        `Quran snapshot ${snapshotId} has an orphaned search row.`
      );
    }
    yield* writer.table("quranRows").insert(stored).pipe(Effect.orDie);
    if (searchStored !== null) {
      yield* writer
        .table("quranSearch")
        .insert(searchStored)
        .pipe(Effect.orDie);
    }
    return false;
  }
);
