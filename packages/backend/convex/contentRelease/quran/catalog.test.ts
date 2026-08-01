import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import {
  QURAN_SURAH_COUNT,
  type QuranSearchRow,
} from "@nakafa/aksara-contracts/quran/spec";
import { decodeSnapshotRowJson } from "@repo/backend/convex/contentRelease/parse";
import {
  readQuranSitemap,
  readQuranSurahs,
} from "@repo/backend/convex/contentRelease/quran/catalog";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  TEST_MANIFEST_HASH,
  TEST_RELEASE_ID,
} from "@repo/backend/test/content-release";
import { makeQuranSearch, makeQuranSurah } from "@repo/backend/test/quran-rows";
import { activateQuranSnapshot } from "@repo/backend/test/quran-snapshot";
import { convexTest } from "convex-test";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

/** Builds the complete technical surah catalog. */
function makeSurahCatalog() {
  return Array.from({ length: QURAN_SURAH_COUNT }, (_, index) =>
    makeQuranSurah(index + 1)
  );
}

/** Builds every signed technical route for one locale. */
function makeRouteCatalog(locale: QuranSearchRow["locale"]) {
  return Array.from({ length: QURAN_SURAH_COUNT }, (_, index) =>
    makeQuranSearch(locale, index + 1)
  );
}

describe("contentRelease/quran/catalog", () => {
  it("returns unmanaged catalog and sitemap results before publication", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.query((ctx) => runConvexProgram(readQuranSurahs(ctx)))
    ).resolves.toMatchObject({ managed: false, rowJson: [] });
    await expect(
      t.query((ctx) => runConvexProgram(readQuranSitemap(ctx, "id")))
    ).resolves.toEqual({
      activeManifestHash: null,
      activeReleaseId: null,
      locale: "id",
      managed: false,
      routes: [],
      snapshotId: null,
      sourceRevision: null,
    });
  });

  it("returns the complete verified catalog and localized sitemap paths", async () => {
    const t = convexTest(schema, convexModules);
    const snapshotId = await t.mutation((ctx) =>
      activateQuranSnapshot(ctx, [
        ...makeSurahCatalog(),
        ...makeRouteCatalog("en"),
      ])
    );
    const catalog = await t.query((ctx) =>
      runConvexProgram(readQuranSurahs(ctx))
    );
    const first = await Effect.runPromise(
      decodeSnapshotRowJson(catalog.rowJson[0] ?? "")
    );

    expect(catalog).toMatchObject({ managed: true, snapshotId });
    expect(catalog.rowJson).toHaveLength(QURAN_SURAH_COUNT);
    expect(first).toMatchObject({
      family: "quran",
      record: { payload: { kind: "quran-surah", number: 1 } },
    });
    await expect(
      t.query((ctx) => runConvexProgram(readQuranSitemap(ctx, "en")))
    ).resolves.toEqual({
      activeManifestHash: TEST_MANIFEST_HASH,
      activeReleaseId: TEST_RELEASE_ID,
      locale: "en",
      managed: true,
      routes: Array.from(
        { length: QURAN_SURAH_COUNT },
        (_, index) => `quran/${index + 1}`
      ),
      snapshotId,
      sourceRevision: "a".repeat(40),
    });
  });

  it("fails closed for incomplete or noncanonical catalogs", async () => {
    const incomplete = convexTest(schema, convexModules);
    await incomplete.mutation((ctx) =>
      activateQuranSnapshot(
        ctx,
        makeSurahCatalog().slice(0, QURAN_SURAH_COUNT - 1)
      )
    );
    await expect(
      incomplete.query((ctx) => runConvexProgram(readQuranSurahs(ctx)))
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });

    const incompleteRoutes = convexTest(schema, convexModules);
    await incompleteRoutes.mutation((ctx) =>
      activateQuranSnapshot(
        ctx,
        makeRouteCatalog("en").slice(0, QURAN_SURAH_COUNT - 1)
      )
    );
    await expect(
      incompleteRoutes.query((ctx) =>
        runConvexProgram(readQuranSitemap(ctx, "en"))
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });

    const duplicate = convexTest(schema, convexModules);
    const rows = makeSurahCatalog();
    rows[QURAN_SURAH_COUNT - 1] = makeQuranSurah(QURAN_SURAH_COUNT - 1);
    await duplicate.mutation((ctx) => activateQuranSnapshot(ctx, rows));
    await expect(
      duplicate.query((ctx) => runConvexProgram(readQuranSurahs(ctx)))
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });

    const routes = convexTest(schema, convexModules);
    const routeRows = makeRouteCatalog("id");
    routeRows[QURAN_SURAH_COUNT - 1] = {
      ...makeQuranSearch("id", QURAN_SURAH_COUNT),
      route: PublicPathSchema.make("quran/noncanonical"),
    };
    await routes.mutation((ctx) => activateQuranSnapshot(ctx, routeRows));
    await expect(
      routes.query((ctx) => runConvexProgram(readQuranSitemap(ctx, "id")))
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });
});
