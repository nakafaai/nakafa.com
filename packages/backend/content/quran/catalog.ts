import { QURAN_SURAH_COUNT } from "@nakafa/aksara-contracts/quran/spec";
import { loadQuranOwner } from "@repo/backend/content/quran/owner";
import { QuranSource } from "@repo/backend/content/quran/source";
import { verifyQuranSurahRow } from "@repo/backend/content/quran/surah";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { Effect } from "effect";

/** Loads and authenticates the complete ordered Quran surah catalog. */
const loadQuranCatalog = Effect.fn("contentRelease.loadQuranCatalog")(
  function* () {
    const owner = yield* loadQuranOwner();
    if (owner.snapshotId === null) {
      return { owner, stored: null };
    }
    const source = yield* QuranSource;
    const stored = yield* source.metadata(
      owner.snapshotId,
      "quran-surah",
      QURAN_SURAH_COUNT + 1
    );
    if (stored.length !== QURAN_SURAH_COUNT) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Active Quran catalog does not contain exactly 114 surahs."
      );
    }
    const surahs = yield* Effect.forEach(stored, (row) =>
      verifyQuranSurahRow(row, owner.snapshotId)
    );
    const invalid = surahs.find((surah, index) => surah.number !== index + 1);
    if (invalid) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Active Quran catalog lost its canonical surah order."
      );
    }
    return { owner, stored, surahs };
  }
);

/** Returns all verified Quran metadata rows without loading verse bodies. */
export const readQuranSurahs = Effect.fn("contentRelease.readQuranSurahs")(
  function* () {
    const catalog = yield* loadQuranCatalog();
    if (catalog.stored === null) {
      return {
        ...catalog.owner,
        rowJson: [],
      };
    }
    return {
      ...catalog.owner,
      rowJson: catalog.stored.map(({ rowJson }) => rowJson),
    };
  }
);
