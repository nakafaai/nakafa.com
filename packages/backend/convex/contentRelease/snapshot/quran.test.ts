import {
  PublicPathSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import { canonicalizeContentSnapshotRow } from "@nakafa/aksara-contracts/release/snapshot/data";
import { QURAN_SEARCH_DOCUMENT_LIMIT } from "@repo/backend/convex/contentRelease/quran/limits";
import { stageQuranRow } from "@repo/backend/convex/contentRelease/snapshot/quran";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeQuranSearch, makeQuranSurah } from "@repo/backend/test/quran-rows";
import { makeQuranSnapshotRow } from "@repo/backend/test/quran-snapshot";
import { describe, expect, it } from "@repo/testing/effect";
import { convexTest } from "convex-test";
import { Effect } from "effect";

const snapshotId = Sha256HashSchema.make(`sha256:${"7".repeat(64)}`);

describe("contentRelease/snapshot/quran", () => {
  it.live("stores one snapshot-bound Quran row idempotently", () =>
    Effect.gen(function* () {
      const source = yield* makeQuranSnapshotRow(snapshotId);
      const rowJson = canonicalizeContentSnapshotRow(source);
      const t = convexTest(schema, convexModules);

      yield* Effect.promise(() =>
        expect(
          t.mutation((ctx) =>
            runConvexProgram(stageQuranRow(ctx, snapshotId, 0, source, rowJson))
          )
        ).resolves.toBe(false)
      );
      yield* Effect.promise(() =>
        expect(
          t.mutation((ctx) =>
            runConvexProgram(stageQuranRow(ctx, snapshotId, 0, source, rowJson))
          )
        ).resolves.toBe(true)
      );
      yield* Effect.promise(() =>
        expect(
          t.run((ctx) => ctx.db.query("quranRows").unique())
        ).resolves.toMatchObject({
          appLocale: "en",
          identity: "search:en:1",
          kind: "quran-search",
          surahNumber: 1,
        })
      );
      yield* Effect.promise(() =>
        expect(
          t.run((ctx) => ctx.db.query("quranSearch").unique())
        ).resolves.toMatchObject({
          appLocale: "en",
          assetId: "asset:en:quran:quran-surah:1",
          identity: "search:en:1",
          text: "Technical search text",
          surahNumber: 1,
        })
      );
    })
  );

  it.live("rejects cross-snapshot rows and identity collisions", () =>
    Effect.gen(function* () {
      const source = yield* makeQuranSnapshotRow(snapshotId);
      const rowJson = canonicalizeContentSnapshotRow(source);
      const otherId = Sha256HashSchema.make(`sha256:${"8".repeat(64)}`);
      const wrong = convexTest(schema, convexModules);
      yield* Effect.promise(() =>
        expect(
          wrong.mutation((ctx) =>
            runConvexProgram(stageQuranRow(ctx, otherId, 0, source, rowJson))
          )
        ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } })
      );

      const collision = convexTest(schema, convexModules);
      yield* Effect.promise(() =>
        collision.mutation((ctx) =>
          runConvexProgram(stageQuranRow(ctx, snapshotId, 0, source, rowJson))
        )
      );
      yield* Effect.promise(() =>
        expect(
          collision.mutation((ctx) =>
            runConvexProgram(stageQuranRow(ctx, snapshotId, 1, source, rowJson))
          )
        ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_CONFLICT" } })
      );
    })
  );

  it.live("rejects a search projection that collides with its signed row", () =>
    Effect.gen(function* () {
      const source = yield* makeQuranSnapshotRow(snapshotId);
      const rowJson = canonicalizeContentSnapshotRow(source);
      const t = convexTest(schema, convexModules);
      yield* Effect.promise(() =>
        t.mutation((ctx) =>
          runConvexProgram(stageQuranRow(ctx, snapshotId, 0, source, rowJson))
        )
      );
      yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          const search = await ctx.db.query("quranSearch").unique();
          if (!search) {
            throw new Error("Expected one technical Quran search projection.");
          }
          await ctx.db.patch("quranSearch", search._id, {
            assetId: "asset:en:quran:quran-surah:changed",
          });
        })
      );

      yield* Effect.promise(() =>
        expect(
          t.mutation((ctx) =>
            runConvexProgram(stageQuranRow(ctx, snapshotId, 0, source, rowJson))
          )
        ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_CONFLICT" } })
      );
    })
  );

  it.live("rejects an orphaned search projection", () =>
    Effect.gen(function* () {
      const source = yield* makeQuranSnapshotRow(snapshotId);
      const rowJson = canonicalizeContentSnapshotRow(source);
      const t = convexTest(schema, convexModules);
      yield* Effect.promise(() =>
        t.mutation((ctx) =>
          ctx.db.insert("quranSearch", {
            assetId: "asset:en:quran:quran-search:1",
            identity: "search:en:1",
            index: 0,
            appLocale: "en",
            rowHash: source.record.rowHash,
            snapshotId,
            surahNumber: 1,
            text: "Technical search text",
          })
        )
      );

      yield* Effect.promise(() =>
        expect(
          t.mutation((ctx) =>
            runConvexProgram(stageQuranRow(ctx, snapshotId, 0, source, rowJson))
          )
        ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_CONFLICT" } })
      );
    })
  );

  it.live("keeps non-search rows free from orphaned search projections", () =>
    Effect.gen(function* () {
      const source = yield* makeQuranSnapshotRow(snapshotId, makeQuranSurah(1));
      const rowJson = canonicalizeContentSnapshotRow(source);
      const t = convexTest(schema, convexModules);
      yield* Effect.promise(() =>
        t.mutation((ctx) =>
          runConvexProgram(stageQuranRow(ctx, snapshotId, 0, source, rowJson))
        )
      );
      yield* Effect.promise(() =>
        expect(
          t.mutation((ctx) =>
            runConvexProgram(stageQuranRow(ctx, snapshotId, 0, source, rowJson))
          )
        ).resolves.toBe(true)
      );
      yield* Effect.promise(() =>
        t.mutation((ctx) =>
          ctx.db.insert("quranSearch", {
            assetId: "asset:en:quran:quran-search:1",
            identity: "search:en:1",
            index: 0,
            appLocale: "en",
            rowHash: source.record.rowHash,
            snapshotId,
            surahNumber: 1,
            text: "orphaned",
          })
        )
      );

      yield* Effect.promise(() =>
        expect(
          t.mutation((ctx) =>
            runConvexProgram(stageQuranRow(ctx, snapshotId, 0, source, rowJson))
          )
        ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_CONFLICT" } })
      );
    })
  );

  it.live("rejects a noncanonical signed Quran route", () =>
    Effect.gen(function* () {
      const source = yield* makeQuranSnapshotRow(snapshotId, {
        ...makeQuranSearch("id", 1),
        route: PublicPathSchema.make("quran/noncanonical"),
      });
      const rowJson = canonicalizeContentSnapshotRow(source);
      const t = convexTest(schema, convexModules);

      yield* Effect.promise(() =>
        expect(
          t.mutation((ctx) =>
            runConvexProgram(stageQuranRow(ctx, snapshotId, 0, source, rowJson))
          )
        ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } })
      );
    })
  );

  it.live("rejects a search row above its aggregate transaction budget", () =>
    Effect.gen(function* () {
      const source = yield* makeQuranSnapshotRow(
        snapshotId,
        makeQuranSearch("en", 1, "x".repeat(QURAN_SEARCH_DOCUMENT_LIMIT))
      );
      const rowJson = canonicalizeContentSnapshotRow(source);
      const t = convexTest(schema, convexModules);

      yield* Effect.promise(() =>
        expect(
          t.mutation((ctx) =>
            runConvexProgram(stageQuranRow(ctx, snapshotId, 0, source, rowJson))
          )
        ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_SIZE" } })
      );
    })
  );
});
