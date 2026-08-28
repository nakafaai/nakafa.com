import { describe, expect, it } from "@effect/vitest";
import { ActiveAppLocaleListSchema } from "@nakafa/aksara-contracts/locale";
import { decodeSnapshotRowJson } from "@repo/backend/convex/contentRelease/parse";
import { readQuranAttribution } from "@repo/backend/convex/contentRelease/quran/attribution";
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
