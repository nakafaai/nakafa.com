import { describe, expect, it } from "@effect/vitest";
import { convexQuranLayer } from "@repo/backend/content/quran/convex";
import { readQuranReference } from "@repo/backend/content/quran/identity";
import { resolveReferenceInput } from "@repo/backend/convex/contentRelease/reference/input";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeQuranSearch } from "@repo/backend/test/quran/rows";
import { activateQuranSnapshot } from "@repo/backend/test/quran/snapshot";
import { convexTest } from "convex-test";
import { Effect } from "effect";

describe("Quran reference identity", () => {
  it.effect(
    "does not invent a reference without an active owner or graph asset",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        const input = yield* resolveReferenceInput({
          kind: "content",
          contentId: makeQuranSearch("en", 1).graph.assetId,
        });
        expect(input).not.toBeNull();
        if (input === null) {
          return;
        }
        expect(
          yield* Effect.promise(() =>
            t.query((ctx) =>
              runConvexProgram(
                readQuranReference(input).pipe(
                  Effect.provide(convexQuranLayer(ctx))
                )
              )
            )
          )
        ).toBeNull();
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            activateQuranSnapshot(ctx, [makeQuranSearch("en", 2)])
          )
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
          yield* Effect.promise(() =>
            t.query((ctx) =>
              runConvexProgram(
                readQuranReference(route).pipe(
                  Effect.provide(convexQuranLayer(ctx))
                )
              )
            )
          )
        ).toMatchObject({ route: "quran/2" });
        expect(
          yield* Effect.promise(() =>
            t.query((ctx) =>
              runConvexProgram(
                readQuranReference(input).pipe(
                  Effect.provide(convexQuranLayer(ctx))
                )
              )
            )
          )
        ).toBeNull();
      })
  );

  it.effect("rejects ambiguous assets and noncanonical surah routes", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      yield* Effect.promise(() =>
        t.mutation((ctx) =>
          activateQuranSnapshot(ctx, [
            makeQuranSearch("en", 1),
            makeQuranSearch("en", 1),
          ])
        )
      );
      const input = yield* resolveReferenceInput({
        kind: "content",
        contentId: makeQuranSearch("en", 1).graph.assetId,
      });
      expect(input).not.toBeNull();
      if (input === null) {
        return;
      }
      yield* Effect.promise(() =>
        expect(
          t.query((ctx) =>
            runConvexProgram(
              readQuranReference(input).pipe(
                Effect.provide(convexQuranLayer(ctx))
              )
            )
          )
        ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } })
      );
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
          yield* Effect.promise(() =>
            t.query((ctx) =>
              runConvexProgram(
                readQuranReference(route).pipe(
                  Effect.provide(convexQuranLayer(ctx))
                )
              )
            )
          )
        ).toBeNull();
      }
    })
  );
});
