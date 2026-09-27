import { describe, expect, it } from "@effect/vitest";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { resolveReferenceInput } from "@repo/backend/confect/contentRelease/reference/input";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { quranLayer } from "@repo/backend/content/quran/confect";
import { readQuranReference } from "@repo/backend/content/quran/identity";
import { makeQuranSearch } from "@repo/backend/test/quran/rows";
import { activateQuranSnapshot } from "@repo/backend/test/quran/snapshot";
import { Effect } from "effect";

describe("Quran reference identity", () => {
  it.effect(
    "does not invent a reference without an active owner or graph asset",
    () =>
      Effect.gen(function* () {
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            const tCtx = yield* MutationCtx;
            const input = yield* resolveReferenceInput({
              kind: "content",
              contentId: makeQuranSearch("en", 1).graph.assetId,
            });
            expect(input).not.toBeNull();
            if (input === null) {
              return;
            }
            expect(
              yield* readQuranReference(input).pipe(Effect.provide(quranLayer))
            ).toBeNull();
            yield* Effect.promise(() =>
              activateQuranSnapshot(tCtx, [makeQuranSearch("en", 2)])
            );
            const route = yield* resolveReferenceInput({
              kind: "route",
              appLocale: "en",
              publicPath: "quran/2",
            });
            if (route === null) {
              return yield* Effect.die("Expected a canonical Quran reference.");
            }
            expect(
              yield* readQuranReference(route).pipe(Effect.provide(quranLayer))
            ).toMatchObject({
              route: "quran/2",
            });
            expect(
              yield* readQuranReference(input).pipe(Effect.provide(quranLayer))
            ).toBeNull();
          })
        );
      })
  );
  it.effect("rejects ambiguous assets and noncanonical surah routes", () =>
    Effect.gen(function* () {
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          const tCtx = yield* MutationCtx;
          yield* Effect.promise(() =>
            activateQuranSnapshot(tCtx, [
              makeQuranSearch("en", 1),
              makeQuranSearch("en", 1),
            ])
          );
          const input = yield* resolveReferenceInput({
            kind: "content",
            contentId: makeQuranSearch("en", 1).graph.assetId,
          });
          expect(input).not.toBeNull();
          if (input === null) {
            return;
          }
          expect(
            yield* readQuranReference(input).pipe(
              Effect.provide(quranLayer),
              Effect.flip
            )
          ).toMatchObject({
            code: "CONTENT_RELEASE_INTEGRITY",
          });
          for (const publicPath of [
            "quran/1/extra",
            "quran/0",
            "quran/01",
            "quran/text",
          ]) {
            const route = yield* resolveReferenceInput({
              kind: "route",
              appLocale: "en",
              publicPath,
            });
            expect(route).not.toBeNull();
            if (route === null) {
              return;
            }
            expect(
              yield* readQuranReference(route).pipe(Effect.provide(quranLayer))
            ).toBeNull();
          }
        })
      );
    })
  );
});
