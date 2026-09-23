import { assert, describe, expect, it } from "@effect/vitest";
import { convexTryoutLayer } from "@repo/backend/content/tryout/convex";
import { readTryoutReference } from "@repo/backend/content/tryout/reference";
import { resolveReferenceInput } from "@repo/backend/convex/contentRelease/reference/input";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { activateTryoutSnapshot } from "@repo/backend/test/tryout/snapshot";
import {
  makeTryoutStartHierarchy,
  makeTryoutStartPlacement,
} from "@repo/backend/test/tryout/source";
import { convexTest } from "convex-test";
import { Effect, Struct } from "effect";

describe("try-out reference visibility", () => {
  it.effect(
    "does not invent a route for absent ownership, an absent asset, or an internal entry",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        const catalog = makeTryoutStartHierarchy("id", "internal-entry");
        const section = catalog.find((row) => row.kind === "section");
        if (section === undefined) {
          return yield* Effect.die("Expected a technical section.");
        }
        const input = yield* resolveReferenceInput({
          kind: "content",
          contentId: section.graph.assetId,
        });
        if (input === null) {
          return yield* Effect.die("Expected a classified try-out asset.");
        }
        expect(
          yield* Effect.promise(() =>
            t.query((ctx) =>
              runConvexProgram(
                readTryoutReference(input).pipe(
                  Effect.provide(convexTryoutLayer(ctx))
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
              runConvexProgram(
                readTryoutReference(input).pipe(
                  Effect.provide(convexTryoutLayer(ctx))
                )
              )
            )
          )
        ).toBeNull();
        const absent = yield* resolveReferenceInput({
          kind: "content",
          contentId: `${section.graph.assetId}:absent`,
        });
        if (absent === null) {
          return yield* Effect.die(
            "Expected a classified absent try-out asset."
          );
        }
        expect(
          yield* Effect.promise(() =>
            t.query((ctx) =>
              runConvexProgram(
                readTryoutReference(absent).pipe(
                  Effect.provide(convexTryoutLayer(ctx))
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
      const t = convexTest(schema, convexModules);
      const catalog = makeTryoutStartHierarchy("id", "visible").map((row) => ({
        ...row,
        description: "Signed description",
      }));
      const country = catalog.find((row) => row.kind === "country");
      assert(country);
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
        contentId: country.graph.assetId,
      });
      assert(input);
      const read = () =>
        t.query((ctx) =>
          runConvexProgram(
            readTryoutReference(input).pipe(
              Effect.provide(convexTryoutLayer(ctx))
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
            .filter((q) => q.eq(q.field("assetId"), country.graph.assetId))
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
          data: { code: "CONTENT_RELEASE_INTEGRITY" },
        })
      );
    })
);
