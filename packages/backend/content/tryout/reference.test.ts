import { DatabaseReader as ConfectDatabaseReader } from "@confect/server";
import { assert, describe, expect, it } from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { resolveReferenceInput } from "@repo/backend/confect/contentRelease/reference/input";
import { convexModules } from "@repo/backend/confect/test.setup";
import { tryoutLayer } from "@repo/backend/content/tryout/confect";
import { readTryoutReference } from "@repo/backend/content/tryout/reference";
import schema from "@repo/backend/convex/schema";
import { activateTryoutSnapshot } from "@repo/backend/test/tryout/snapshot";
import {
  makeTryoutStartHierarchy,
  makeTryoutStartPlacement,
} from "@repo/backend/test/tryout/source";
import { convexTest } from "convex-test";
import { Array as Arr, Effect, Layer, Option, Struct } from "effect";

describe("try-out reference visibility", () => {
  it.effect(
    "does not invent a route for absent ownership, an absent asset, or an internal entry",
    () =>
      Effect.gen(function* () {
        const runtimeServices = yield* Effect.context<never>();
        const t = convexTest(schema, convexModules);
        const catalog = makeTryoutStartHierarchy("id", "internal-entry");
        const section = Arr.findFirst(catalog, (row) => row.kind === "section");
        if (Option.isNone(section)) {
          return yield* Effect.die("Expected a technical section.");
        }
        const input = yield* resolveReferenceInput({
          kind: "content",
          contentId: section.value.graph.assetId,
        });
        if (input === null) {
          return yield* Effect.die("Expected a classified try-out asset.");
        }
        expect(
          yield* Effect.promise(() =>
            t.query((ctx) =>
              Effect.runPromiseWith(runtimeServices)(
                readTryoutReference(input).pipe(
                  Effect.provide(
                    Layer.provideMerge(
                      tryoutLayer,
                      ConfectDatabaseReader.layer(confectSchema, ctx.db)
                    )
                  )
                )
              )
            )
          )
        ).toBeNull();
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            activateTryoutSnapshot(ctx, {
              catalog,
              placements: [makeTryoutStartPlacement("id")],
            })
          )
        );
        expect(
          yield* Effect.promise(() =>
            t.query((ctx) =>
              Effect.runPromiseWith(runtimeServices)(
                readTryoutReference(input).pipe(
                  Effect.provide(
                    Layer.provideMerge(
                      tryoutLayer,
                      ConfectDatabaseReader.layer(confectSchema, ctx.db)
                    )
                  )
                )
              )
            )
          )
        ).toBeNull();
        const absent = yield* resolveReferenceInput({
          kind: "content",
          contentId: `${section.value.graph.assetId}:absent`,
        });
        if (absent === null) {
          return yield* Effect.die(
            "Expected a classified absent try-out asset."
          );
        }
        expect(
          yield* Effect.promise(() =>
            t.query((ctx) =>
              Effect.runPromiseWith(runtimeServices)(
                readTryoutReference(absent).pipe(
                  Effect.provide(
                    Layer.provideMerge(
                      tryoutLayer,
                      ConfectDatabaseReader.layer(confectSchema, ctx.db)
                    )
                  )
                )
              )
            )
          )
        ).toBeNull();
      })
  );
});
it.effect(
  "preserves public descriptions and rejects duplicate graph identities",
  () =>
    Effect.gen(function* () {
      const runtimeServices = yield* Effect.context<never>();
      const t = convexTest(schema, convexModules);
      const catalog = Arr.map(
        makeTryoutStartHierarchy("id", "visible"),
        (row) => ({
          ...row,
          description: "Signed description",
        })
      );
      const country = Arr.findFirst(catalog, (row) => row.kind === "country");
      assert(Option.isSome(country));
      yield* Effect.promise(() =>
        t.mutation((ctx) =>
          activateTryoutSnapshot(ctx, {
            catalog,
            placements: [makeTryoutStartPlacement("id")],
          })
        )
      );
      const input = yield* resolveReferenceInput({
        kind: "content",
        contentId: country.value.graph.assetId,
      });
      assert(input);
      const read = () =>
        t.query((ctx) =>
          Effect.runPromiseWith(runtimeServices)(
            readTryoutReference(input).pipe(
              Effect.provide(
                Layer.provideMerge(
                  tryoutLayer,
                  ConfectDatabaseReader.layer(confectSchema, ctx.db)
                )
              )
            )
          )
        );
      expect(yield* Effect.promise(read)).toMatchObject({
        description: "Signed description",
      });
      yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          const row = await ctx.db
            .query("tryoutCatalog")
            .filter((q) =>
              q.eq(q.field("assetId"), country.value.graph.assetId)
            )
            .first();
          assert(row);
          await ctx.db.insert(
            "tryoutCatalog",
            Struct.omit(row, ["_id", "_creationTime"])
          );
        })
      );
      yield* Effect.promise(() =>
        expect(read()).rejects.toMatchObject({
          code: "CONTENT_RELEASE_INTEGRITY",
        })
      );
    })
);
