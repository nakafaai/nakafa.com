import { describe, expect, it } from "@effect/vitest";
import { ActiveAppLocaleListSchema } from "@nakafa/aksara-contracts/locale";
import { Sha256HashSchema as StoredSha256HashSchema } from "@nakafa/aksara-transition/ids";
import { QuranSourceIdSchema as StoredQuranSourceIdSchema } from "@nakafa/aksara-transition/quran/identity";
import { bindQuranRow as bindStoredQuranRow } from "@nakafa/aksara-transition/quran/snapshot/row/hash";
import { QuranAttributionRowSchema as StoredQuranAttributionRowSchema } from "@nakafa/aksara-transition/quran/source";
import { canonicalizeContentSnapshotRow as canonicalizeStoredQuranRow } from "@nakafa/aksara-transition/release/snapshot/data";
import { decodeSnapshotRowJson } from "@repo/backend/convex/contentRelease/parse";
import { readQuranAttribution } from "@repo/backend/convex/contentRelease/quran/attribution";
import { quranRowFacts } from "@repo/backend/convex/contentRelease/quran/facts";
import { readQuranLocaleSources } from "@repo/backend/convex/contentRelease/quran/sources";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeQuranAttribution } from "@repo/backend/test/quran/rows";
import { activateQuranSnapshot } from "@repo/backend/test/quran/snapshot";
import { convexTest } from "convex-test";
import { Effect, Schema } from "effect";

describe("contentRelease/quran/attribution", () => {
  it.live(
    "distinguishes unmanaged content from active signed attribution",
    () =>
      Effect.gen(function* () {
        const empty = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          expect(
            empty.query((ctx) => runConvexProgram(readQuranAttribution(ctx)))
          ).resolves.toMatchObject({ managed: false, rowJson: null })
        );

        const active = convexTest(schema, convexModules);
        const snapshotId = yield* Effect.promise(() =>
          active.mutation((ctx) =>
            activateQuranSnapshot(ctx, [makeQuranAttribution()])
          )
        );
        const result = yield* Effect.promise(() =>
          active.query((ctx) => runConvexProgram(readQuranAttribution(ctx)))
        );
        const decoded = yield* decodeSnapshotRowJson(result.rowJson ?? "");

        expect(result).toMatchObject({ managed: true, snapshotId });
        expect(decoded).toMatchObject({
          family: "quran",
          record: { payload: { kind: "quran-attribution" } },
        });
        yield* Effect.promise(() =>
          expect(
            active.query((ctx) =>
              runConvexProgram(readQuranLocaleSources(ctx, snapshotId, "id"))
            )
          ).resolves.toMatchObject({
            sources: {
              arabic: { id: "tanzil-text", kind: "embedded" },
              translation: {
                id: "quranenc-indonesian",
                kind: "embedded",
              },
            },
            tafsirAccess: {
              appLocale: "id",
              kind: "embedded",
              notice: "Catatan teknis tafsir Indonesia.",
              source: {
                id: "quranenc-tafsir",
                label: "Technical source quranenc-tafsir id",
                updateUrl: "https://example.test/quranenc-tafsir/updates",
              },
            },
          })
        );
      })
  );

  it.live(
    "reads the exact predecessor attribution during the data switch",
    () =>
      Effect.gen(function* () {
        const active = convexTest(schema, convexModules);
        const currentAttribution = makeQuranAttribution();
        const snapshotId = yield* Effect.promise(() =>
          active.mutation((ctx) =>
            activateQuranSnapshot(ctx, [currentAttribution])
          )
        );
        const storedAttribution = yield* Schema.decodeUnknownEffect(
          StoredQuranAttributionRowSchema
        )({
          ...currentAttribution,
          sources: currentAttribution.sources.filter((source) =>
            Schema.is(StoredQuranSourceIdSchema)(source.id)
          ),
        });
        const record = yield* bindStoredQuranRow(
          StoredSha256HashSchema.make(snapshotId),
          storedAttribution
        );
        yield* Effect.promise(() =>
          active.mutation(async (ctx) => {
            const row = await ctx.db.query("quranRows").unique();
            expect(row).toBeDefined();
            if (!row) {
              return;
            }
            await ctx.db.patch("quranRows", row._id, {
              ...quranRowFacts(record),
              rowHash: record.rowHash,
              rowJson: canonicalizeStoredQuranRow({ family: "quran", record }),
            });
          })
        );

        const locales = yield* Effect.all(
          {
            de: Effect.promise(() =>
              active.query((ctx) =>
                runConvexProgram(readQuranLocaleSources(ctx, snapshotId, "de"))
              )
            ),
            en: Effect.promise(() =>
              active.query((ctx) =>
                runConvexProgram(readQuranLocaleSources(ctx, snapshotId, "en"))
              )
            ),
            id: Effect.promise(() =>
              active.query((ctx) =>
                runConvexProgram(readQuranLocaleSources(ctx, snapshotId, "id"))
              )
            ),
          },
          { concurrency: "unbounded" }
        );

        expect(locales).toMatchObject({
          de: {
            sources: { translation: { id: "quranenc-german" } },
            tafsirAccess: {
              appLocale: "de",
              kind: "external",
              source: { id: "mokhtasar-german" },
            },
          },
          en: {
            sources: { translation: { id: "quranenc-english" } },
            tafsirAccess: {
              appLocale: "en",
              kind: "external",
              source: { id: "mokhtasar-english" },
            },
          },
          id: {
            sources: { translation: { id: "quranenc-indonesian" } },
            tafsirAccess: {
              appLocale: "id",
              kind: "embedded",
              source: { id: "quranenc-tafsir" },
            },
          },
        });
      })
  );

  it.live("fails closed when the signed locale set excludes a request", () =>
    Effect.gen(function* () {
      const active = convexTest(schema, convexModules);
      const indonesianOnly = yield* Schema.decodeEffect(
        ActiveAppLocaleListSchema
      )(["id"]);
      const snapshotId = yield* Effect.promise(() =>
        active.mutation((ctx) =>
          activateQuranSnapshot(ctx, [makeQuranAttribution(indonesianOnly)])
        )
      );

      yield* Effect.promise(() =>
        expect(
          active.query((ctx) =>
            runConvexProgram(readQuranLocaleSources(ctx, snapshotId, "en"))
          )
        ).rejects.toMatchObject({
          data: { code: "CONTENT_RELEASE_INTEGRITY" },
        })
      );
    })
  );
});
