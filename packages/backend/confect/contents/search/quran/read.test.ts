import { describe, expect, it } from "@effect/vitest";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { QURAN_SEARCH_DOCUMENT_LIMIT } from "@repo/backend/confect/contentRelease/quran/limits";
import { readSignedQuranSearchDocuments } from "@repo/backend/confect/contents/search/quran/read";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { makeQuranSearch } from "@repo/backend/test/quran/rows";
import { activateQuranSnapshot } from "@repo/backend/test/quran/snapshot";
import { Array as Arr, Effect } from "effect";

describe("contents/search/quran/read", () => {
  it.effect(
    "deduplicates equivalent canonical route variants before signed reads",
    () =>
      Effect.gen(function* () {
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            const tCtx = yield* MutationCtx;
            yield* Effect.promise(() =>
              activateQuranSnapshot(tCtx, [makeQuranSearch("en", 1)])
            );
            const queries = ["quran/1", "en/quran/1", "/quran/1/"];
            const documents = yield* readSignedQuranSearchDocuments(
              {
                limit: 2,
                locale: "en",
                offset: 0,
                queries,
                section: "quran",
              },
              queries,
              2
            );
            expect(Arr.map(documents, ({ route }) => route)).toEqual([
              "quran/1",
            ]);
          })
        );
      })
  );
  it.effect(
    "returns only selected authenticated candidates when query prefixes exceed capacity",
    () =>
      Effect.gen(function* () {
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            const tCtx = yield* MutationCtx;
            yield* Effect.promise(() =>
              activateQuranSnapshot(tCtx, [
                makeQuranSearch("en", 1, "mercy"),
                makeQuranSearch("en", 2, "wisdom"),
              ])
            );
            const queries = ["mercy", "wisdom"];
            const documents = yield* readSignedQuranSearchDocuments(
              {
                limit: 1,
                locale: "en",
                offset: 0,
                queries,
                section: "quran",
              },
              queries,
              1
            );
            expect(Arr.map(documents, ({ route }) => route)).toEqual([
              "quran/1",
            ]);
            expect(documents[0]).toMatchObject({
              content_id: "asset:en:quran:quran-surah:1",
              text: expect.stringContaining("mercy"),
            });
          })
        );
      })
  );
  it.effect("returns no source fallback before signed Quran activation", () =>
    Effect.gen(function* () {
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          expect(
            yield* readSignedQuranSearchDocuments(
              {
                limit: 10,
                locale: "en",
                offset: 0,
                queries: ["mercy"],
                section: "quran",
              },
              ["mercy"],
              10
            )
          ).toEqual([]);
        })
      );
    })
  );
  it.effect(
    "authenticates full-text and exact-route hits from one signed snapshot",
    () =>
      Effect.gen(function* () {
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            const tCtx = yield* MutationCtx;
            yield* Effect.promise(() =>
              activateQuranSnapshot(tCtx, [
                makeQuranSearch("en", 1, "mercy guidance"),
                makeQuranSearch("en", 2, "wisdom"),
                makeQuranSearch("id", 1, "rahmat petunjuk"),
              ])
            );
            const queries = [
              "quran/2",
              "mercy",
              "articles/not-quran",
              "quran/999",
            ];
            const documents = yield* readSignedQuranSearchDocuments(
              {
                limit: 2,
                locale: "en",
                offset: 0,
                queries,
                section: "quran",
              },
              queries,
              2
            );
            expect(documents).toMatchObject([
              {
                content_id: "asset:en:quran:quran-surah:2",
                route: "quran/2",
                section: "quran",
                title: "Technical Surah 2",
              },
              {
                content_id: "asset:en:quran:quran-surah:1",
                route: "quran/1",
                section: "quran",
                title: "Technical Surah 1",
              },
            ]);
          })
        );
      })
  );
  it.effect("authenticates a corpus-sized signed Quran search row", () =>
    Effect.gen(function* () {
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          const tCtx = yield* MutationCtx;
          const text = `mercy ${"x".repeat(QURAN_SEARCH_DOCUMENT_LIMIT - 16 * 1024)}`;
          yield* Effect.promise(() =>
            activateQuranSnapshot(tCtx, [makeQuranSearch("en", 1, text)])
          );
          const documents = yield* readSignedQuranSearchDocuments(
            {
              limit: 1,
              locale: "en",
              offset: 0,
              queries: ["mercy"],
              section: "quran",
            },
            ["mercy"],
            1
          );
          expect(documents).toHaveLength(1);
          expect(documents[0]).toMatchObject({
            route: "quran/1",
            section: "quran",
          });
        })
      );
    })
  );
  it.effect("prioritizes an exact route from the final query variant", () =>
    Effect.gen(function* () {
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          const tCtx = yield* MutationCtx;
          yield* Effect.promise(() =>
            activateQuranSnapshot(tCtx, [
              makeQuranSearch("en", 1, "mercy guidance"),
              makeQuranSearch("en", 2, "wisdom"),
            ])
          );
          const queries = ["mercy", "guidance", "missing", "quran/2"];
          const documents = yield* readSignedQuranSearchDocuments(
            {
              limit: 1,
              locale: "en",
              offset: 0,
              queries,
              section: "quran",
            },
            queries,
            1
          );
          expect(documents).toMatchObject([
            {
              route: "quran/2",
            },
          ]);
        })
      );
    })
  );
  it.effect("searches route-shaped text that is not an exact Quran route", () =>
    Effect.gen(function* () {
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          const tCtx = yield* MutationCtx;
          yield* Effect.promise(() =>
            activateQuranSnapshot(tCtx, [
              makeQuranSearch("en", 1, "articles science example"),
              makeQuranSearch("en", 2, "quran 999 reference"),
            ])
          );
          const queries = ["articles/science/example", "quran/999"];
          const documents = yield* readSignedQuranSearchDocuments(
            {
              limit: 2,
              locale: "en",
              offset: 0,
              queries,
              section: "quran",
            },
            queries,
            2
          );
          expect(Arr.map(documents, ({ route }) => route)).toEqual([
            "quran/1",
            "quran/2",
          ]);
        })
      );
    })
  );
  it.effect(
    "preserves text capacity when an exact route overlaps its hits",
    () =>
      Effect.gen(function* () {
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            const tCtx = yield* MutationCtx;
            yield* Effect.promise(() =>
              activateQuranSnapshot(tCtx, [
                makeQuranSearch("en", 1, "mercy"),
                makeQuranSearch("en", 2, "mercy"),
              ])
            );
            const queries = ["quran/1", "mercy"];
            const documents = yield* readSignedQuranSearchDocuments(
              {
                limit: 2,
                locale: "en",
                offset: 0,
                queries,
                section: "quran",
              },
              queries,
              2
            );
            expect(Arr.map(documents, ({ route }) => route)).toEqual([
              "quran/1",
              "quran/2",
            ]);
          })
        );
      })
  );
  it.effect(
    "browses only the requested signed locale and respects zero limits",
    () =>
      Effect.gen(function* () {
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            const tCtx = yield* MutationCtx;
            yield* Effect.promise(() =>
              activateQuranSnapshot(tCtx, [
                makeQuranSearch("en", 1),
                makeQuranSearch("id", 1),
              ])
            );
            const input = {
              limit: 10,
              locale: "id",
              offset: 0,
              section: "quran",
            } satisfies Parameters<typeof readSignedQuranSearchDocuments>[0];
            const browsed = yield* readSignedQuranSearchDocuments(
              input,
              [],
              10
            );
            const empty = yield* readSignedQuranSearchDocuments(input, [], 0);
            expect(Arr.map(browsed, ({ locale }) => locale)).toEqual(["id"]);
            expect(empty).toEqual([]);
          })
        );
      })
  );
});
