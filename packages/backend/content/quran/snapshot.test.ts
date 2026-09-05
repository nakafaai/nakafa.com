import { describe, expect, it } from "@effect/vitest";
import { ACTIVE_APP_LOCALES } from "@nakafa/aksara-contracts/locale";
import {
  QURAN_CHUNK_SIZE,
  QURAN_SURAH_COUNT,
} from "@nakafa/aksara-contracts/quran/spec";
import { snapshotPublicationLayer } from "@repo/backend/content/publication/snapshot";
import { readQuranSurahs } from "@repo/backend/content/quran/catalog";
import { convexQuranLayer } from "@repo/backend/content/quran/convex";
import { readQuranReference } from "@repo/backend/content/quran/identity";
import { readQuranPassage } from "@repo/backend/content/quran/reference";
import { snapshotQuranLayer } from "@repo/backend/content/quran/snapshot";
import { QuranSource } from "@repo/backend/content/quran/source";
import { readQuranSurahRow } from "@repo/backend/content/quran/surah";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  makeQuranAttribution,
  makeQuranChunk,
  makeQuranSearch,
  makeQuranSurah,
} from "@repo/backend/test/quran/rows";
import { activateQuranSnapshot } from "@repo/backend/test/quran/snapshot";
import { convexTest } from "convex-test";
import { Effect, Layer, Option, Struct } from "effect";

/** Copies immutable fixture values at the Convex query boundary. */
async function quranSnapshot(ctx: QueryCtx) {
  return {
    contentKeys: (await ctx.db.query("contentKeys").collect()).map((row) =>
      Struct.omit(row, ["_id", "_creationTime"])
    ),
    contentState: (await ctx.db.query("contentState").collect()).map((row) =>
      Struct.omit(row, ["_id", "_creationTime"])
    ),
    contentReleases: (await ctx.db.query("contentReleases").collect()).map(
      (row) => Struct.omit(row, ["_id", "_creationTime"])
    ),
    contentHeads: (await ctx.db.query("contentHeads").collect()).map((row) =>
      Struct.omit(row, ["_id", "_creationTime"])
    ),
    contentBindings: (await ctx.db.query("contentBindings").collect()).map(
      (row) => Struct.omit(row, ["_id", "_creationTime"])
    ),
    contentArtifacts: (await ctx.db.query("contentArtifacts").collect()).map(
      (row) => Struct.omit(row, ["_id", "_creationTime"])
    ),
    contentSnapshots: (await ctx.db.query("contentSnapshots").collect()).map(
      (row) => Struct.omit(row, ["_id", "_creationTime"])
    ),
    quranRows: (await ctx.db.query("quranRows").collect()).map((row) =>
      Struct.omit(row, ["_id", "_creationTime"])
    ),
    quranSearch: (await ctx.db.query("quranSearch").collect()).map((row) =>
      Struct.omit(row, ["_id", "_creationTime"])
    ),
  };
}

describe("portable Quran reads", () => {
  it.effect(
    "matches native signed catalogs, localized passages, references, and bounded chunk order",
    () =>
      Effect.gen(function* () {
        const target = convexTest(schema, convexModules);
        const snapshotId = yield* Effect.promise(() =>
          target.mutation((ctx) =>
            activateQuranSnapshot(
              ctx,
              [
                makeQuranAttribution(),
                ...Array.from({ length: QURAN_SURAH_COUNT }, (_, index) =>
                  makeQuranSurah(
                    index + 1,
                    index === 0 ? 2 * QURAN_CHUNK_SIZE + 1 : 1
                  )
                ),
                ...[1, QURAN_CHUNK_SIZE + 1, 2 * QURAN_CHUNK_SIZE + 1].map(
                  (firstVerse) =>
                    makeQuranChunk({
                      firstQuranNumber: firstVerse,
                      firstVerse,
                      surahNumber: 1,
                      verseCount:
                        firstVerse > 2 * QURAN_CHUNK_SIZE
                          ? 1
                          : QURAN_CHUNK_SIZE,
                    })
                ),
                ...ACTIVE_APP_LOCALES.map((appLocale) =>
                  makeQuranSearch(appLocale, 1)
                ),
              ].reverse()
            )
          )
        );
        const tables = yield* Effect.promise(() => target.query(quranSnapshot));
        const layer = Layer.merge(
          snapshotPublicationLayer(tables),
          snapshotQuranLayer(tables)
        );
        for (const appLocale of ACTIVE_APP_LOCALES) {
          const program = Effect.gen(function* () {
            const source = yield* QuranSource;
            return yield* Effect.all({
              catalog: readQuranSurahs(),
              passage: readQuranPassage({
                appLocale,
                surahNumber: 1,
                fromVerse: QURAN_CHUNK_SIZE,
                toVerse: QURAN_CHUNK_SIZE + 1,
              }),
              reference: readQuranReference({
                kind: "content",
                contentId: makeQuranSearch(appLocale, 1).graph.assetId,
                appLocale,
                publicLocale: appLocale,
                family: "quran",
              }),
              metadata: source
                .metadata(snapshotId, "quran-surah", 2)
                .pipe(
                  Effect.map((rows) =>
                    rows.map(({ surahNumber }) => surahNumber)
                  )
                ),
              chunk: source
                .chunks(
                  snapshotId,
                  1,
                  QURAN_CHUNK_SIZE + 1,
                  2 * QURAN_CHUNK_SIZE + 1,
                  1
                )
                .pipe(
                  Effect.map((rows) => rows.map(({ firstVerse }) => firstVerse))
                ),
              excluded: source.chunks(snapshotId, 1, 2, QURAN_CHUNK_SIZE, 3),
              foreign: source.chunks("other-snapshot", 1, 1, 100, 3),
            });
          });
          const native = yield* Effect.promise(() =>
            target.query((ctx) =>
              runConvexProgram(
                program.pipe(Effect.provide(convexQuranLayer(ctx)))
              )
            )
          );
          const portable = yield* program.pipe(Effect.provide(layer));
          expect(portable).toEqual(native);
          expect(portable.catalog.rowJson).toHaveLength(QURAN_SURAH_COUNT);
          expect(portable.passage.chunkJson).toHaveLength(2);
          expect(portable.reference).toMatchObject({
            locale: appLocale,
            route: "quran/1",
          });
          expect(portable.metadata).toEqual([1, 2]);
          expect(portable.chunk).toEqual([QURAN_CHUNK_SIZE + 1]);
          expect(portable.excluded).toEqual([]);
          expect(portable.foreign).toEqual([]);
        }
        for (const quranRows of [
          tables.quranRows.map((row) =>
            row.kind === "quran-surah"
              ? { ...row, surahNumber: undefined }
              : row
          ),
          tables.quranRows.map((row) =>
            row.kind === "quran-chunk" ? { ...row, firstVerse: undefined } : row
          ),
        ]) {
          expect(
            yield* readQuranPassage({
              appLocale: ACTIVE_APP_LOCALES[0],
              surahNumber: 1,
              fromVerse: QURAN_CHUNK_SIZE,
              toVerse: QURAN_CHUNK_SIZE + 1,
            }).pipe(
              Effect.provide(
                Layer.merge(
                  snapshotPublicationLayer(tables),
                  snapshotQuranLayer({ ...tables, quranRows })
                )
              ),
              Effect.flip
            )
          ).toMatchObject({
            _tag: "ReleaseError",
            code: "CONTENT_RELEASE_INTEGRITY",
          });
        }
      })
  );

  it.effect(
    "returns empty bounded lookups when a snapshot or identity is absent",
    () =>
      Effect.gen(function* () {
        const source = yield* QuranSource;
        expect(Option.isNone(yield* source.row("missing", "surah:1"))).toBe(
          true
        );
        expect(yield* source.metadata("missing", "quran-surah", 1)).toEqual([]);
        expect(yield* source.chunks("missing", 1, 1, 1, 1)).toEqual([]);
        expect(
          yield* source.search("missing", ACTIVE_APP_LOCALES[0], "absent")
        ).toEqual([]);
      }).pipe(
        Effect.provide(snapshotQuranLayer({ quranRows: [], quranSearch: [] }))
      )
  );

  it.effect(
    "rejects duplicate immutable rows and changed signed bytes or indexed surah facts",
    () =>
      Effect.gen(function* () {
        const target = convexTest(schema, convexModules);
        const snapshotId = yield* Effect.promise(() =>
          target.mutation((ctx) =>
            activateQuranSnapshot(ctx, [makeQuranSurah(1)])
          )
        );
        const tables = yield* Effect.promise(() => target.query(quranSnapshot));
        const [row] = tables.quranRows;
        if (!row) {
          return yield* Effect.die("Expected an immutable Quran fixture row.");
        }
        for (const quranRows of [
          [row, row],
          [{ ...row, rowJson: "{" }],
          [{ ...row, rowHash: `sha256:${"0".repeat(64)}` }],
          [{ ...row, surahNumber: 2 }],
        ]) {
          expect(
            yield* readQuranSurahRow(snapshotId, 1).pipe(
              Effect.provide(snapshotQuranLayer({ ...tables, quranRows })),
              Effect.flip
            )
          ).toMatchObject({
            _tag: "ReleaseError",
            code: "CONTENT_RELEASE_INTEGRITY",
          });
        }
      })
  );

  it.effect(
    "rejects duplicated semantic assets and unauthenticated search projections",
    () =>
      Effect.gen(function* () {
        const target = convexTest(schema, convexModules);
        const appLocale = ACTIVE_APP_LOCALES[0];
        const payload = makeQuranSearch(appLocale, 1);
        yield* Effect.promise(() =>
          target.mutation((ctx) => activateQuranSnapshot(ctx, [payload]))
        );
        const tables = yield* Effect.promise(() => target.query(quranSnapshot));
        const [row] = tables.quranSearch;
        if (!row) {
          return yield* Effect.die("Expected one Quran search fixture.");
        }
        const program = readQuranReference({
          kind: "content",
          contentId: payload.graph.assetId,
          appLocale,
          publicLocale: appLocale,
          family: "quran",
        });
        for (const quranSearch of [
          [row, row, row],
          [{ ...row, text: "Changed search text" }],
        ]) {
          expect(
            yield* program.pipe(
              Effect.provide(
                Layer.merge(
                  snapshotPublicationLayer(tables),
                  snapshotQuranLayer({ ...tables, quranSearch })
                )
              ),
              Effect.flip
            )
          ).toMatchObject({
            _tag: "ReleaseError",
            code: "CONTENT_RELEASE_INTEGRITY",
          });
        }
      })
  );
});
