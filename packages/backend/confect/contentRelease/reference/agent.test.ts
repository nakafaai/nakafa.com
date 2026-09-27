import { describe, expect, it } from "@effect/vitest";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { readAgentContentSource } from "@repo/backend/confect/contentRelease/reference/agent";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import {
  makeQuranAttribution,
  makeQuranChunk,
  makeQuranSearch,
  makeQuranSurah,
} from "@repo/backend/test/quran/rows";
import { activateQuranSnapshot } from "@repo/backend/test/quran/snapshot";
import { Effect } from "effect";

describe("contentRelease/reference/agent", () => {
  it.effect("rejects a route outside signed content namespaces", () =>
    Effect.gen(function* () {
      const test = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* test.run(
        Effect.gen(function* () {
          expect(
            yield* readAgentContentSource({
              appLocale: "en",
              kind: "route",
              publicPath: "unknown/path",
            })
          ).toBeNull();
        })
      );
    })
  );
  it.effect("returns no source when the signed reference is absent", () =>
    Effect.gen(function* () {
      const test = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* test.run(
        Effect.gen(function* () {
          expect(
            yield* readAgentContentSource({
              appLocale: "en",
              kind: "route",
              publicPath: "quran/1",
            })
          ).toBeNull();
        })
      );
    })
  );
  it.effect("returns the Quran reference and markdown from one query", () =>
    Effect.gen(function* () {
      const test = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* test.run(
        Effect.gen(function* () {
          const testCtx = yield* MutationCtx;
          yield* Effect.promise(() =>
            activateQuranSnapshot(testCtx, [
              makeQuranAttribution(),
              makeQuranSurah(1),
              makeQuranChunk({
                firstQuranNumber: 1,
                firstVerse: 1,
                surahNumber: 1,
                verseCount: 1,
              }),
              makeQuranSearch("en", 1),
            ])
          );
          const source = yield* readAgentContentSource({
            appLocale: "en",
            kind: "route",
            publicPath: "quran/1",
          });
          expect(source).toMatchObject({
            kind: "quran",
            markdown: {
              appLocale: "en",
              surah: {
                number: 1,
              },
              verses: [
                {
                  number: {
                    inSurah: 1,
                  },
                },
              ],
            },
            reference: {
              content_id: "asset:en:quran:quran-surah:1",
              locale: "en",
              route: "quran/1",
              section: "quran",
            },
          });
        })
      );
    })
  );
});
