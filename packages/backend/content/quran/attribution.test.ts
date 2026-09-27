import { describe, expect, it } from "@effect/vitest";
import { ActiveAppLocaleListSchema } from "@nakafa/aksara-contracts/locale";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { decodeSnapshotRowJson } from "@repo/backend/confect/contentRelease/parse";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { readQuranAttribution } from "@repo/backend/content/quran/attribution";
import { quranLayer } from "@repo/backend/content/quran/confect";
import { readQuranLocaleSources } from "@repo/backend/content/quran/sources";
import {
  makeQuranAttribution,
  makeQuranSurah,
} from "@repo/backend/test/quran/rows";
import { activateQuranSnapshot } from "@repo/backend/test/quran/snapshot";
import { Effect, Schema } from "effect";

describe("contentRelease/quran/attribution", () => {
  it.effect(
    "rejects an active snapshot with missing or duplicate attribution",
    () =>
      Effect.gen(function* () {
        for (const payloads of [
          [makeQuranSurah(1)],
          [makeQuranAttribution(), makeQuranAttribution()],
        ]) {
          const t = yield* Confect.pipe(Effect.provide(confectLayer));
          yield* t.run(
            Effect.gen(function* () {
              const tCtx = yield* MutationCtx;
              yield* Effect.promise(() =>
                activateQuranSnapshot(tCtx, payloads)
              );
              expect(
                yield* readQuranAttribution().pipe(
                  Effect.provide(quranLayer),
                  Effect.flip
                )
              ).toMatchObject({
                code: "CONTENT_RELEASE_INTEGRITY",
                message: expect.stringContaining("unique attribution"),
              });
            })
          );
        }
      })
  );
  it.live(
    "distinguishes unmanaged content from active signed attribution",
    () =>
      Effect.gen(function* () {
        const empty = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* empty.run(
          Effect.gen(function* () {
            const _emptyCtx = yield* MutationCtx;
            expect(
              yield* readQuranAttribution().pipe(Effect.provide(quranLayer))
            ).toMatchObject({
              managed: false,
              rowJson: null,
            });
            const active = yield* Confect.pipe(Effect.provide(confectLayer));
            yield* active.run(
              Effect.gen(function* () {
                const activeCtx = yield* MutationCtx;
                const snapshotId = yield* Effect.promise(() =>
                  activateQuranSnapshot(activeCtx, [makeQuranAttribution()])
                );
                const result = yield* readQuranAttribution().pipe(
                  Effect.provide(quranLayer)
                );
                const decoded = yield* decodeSnapshotRowJson(
                  result.rowJson ?? ""
                );
                expect(result).toMatchObject({
                  managed: true,
                  snapshotId,
                });
                expect(decoded).toMatchObject({
                  family: "quran",
                  record: {
                    payload: {
                      kind: "quran-attribution",
                    },
                  },
                });
                expect(
                  yield* readQuranLocaleSources(snapshotId, "id").pipe(
                    Effect.provide(quranLayer)
                  )
                ).toMatchObject({
                  sources: {
                    arabic: {
                      id: "tanzil-text",
                      kind: "embedded",
                    },
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
                });
              })
            );
          })
        );
      })
  );
  it.live("fails closed when the signed locale set excludes a request", () =>
    Effect.gen(function* () {
      const active = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* active.run(
        Effect.gen(function* () {
          const activeCtx = yield* MutationCtx;
          const indonesianOnly = yield* Schema.decodeEffect(
            ActiveAppLocaleListSchema
          )(["id"]);
          const snapshotId = yield* Effect.promise(() =>
            activateQuranSnapshot(activeCtx, [
              makeQuranAttribution(indonesianOnly),
            ])
          );
          expect(
            yield* readQuranLocaleSources(snapshotId, "en").pipe(
              Effect.provide(quranLayer),
              Effect.flip
            )
          ).toMatchObject({
            code: "CONTENT_RELEASE_INTEGRITY",
          });
        })
      );
    })
  );
});
