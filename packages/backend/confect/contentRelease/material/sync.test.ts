import { RegisteredConvexFunction } from "@confect/server";
import { assert, describe, expect, it } from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import contentReleases from "@repo/backend/confect/_generated/tables/contentReleases";
import { syncMaterials } from "@repo/backend/confect/contentRelease/material/sync";
import { decodeReleaseJson } from "@repo/backend/confect/contentRelease/parse";
import { convexModules } from "@repo/backend/confect/test.setup";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import { makeMaterialProjection } from "@repo/backend/test/content/material";
import {
  insertCompletedRelease,
  insertReleaseItem,
} from "@repo/backend/test/content/model";
import { insertMaterialProjection } from "@repo/backend/test/material/catalog";
import { convexTest } from "convex-test";
import { Array as Arr, Effect, Schema } from "effect";

const identity = {
  manifestHash: `sha256:${"6".repeat(64)}`,
  releaseId: "material-sync-candidate",
  sequence: 1,
};

/** Stages real immutable heads and a durable build with a separate target slot. */
function stageBuild(ctx: MutationCtx) {
  return Effect.gen(function* () {
    yield* Effect.promise(() => insertCompletedRelease(ctx, identity, 2));
    for (let index = 0; index < 2; index += 1) {
      const projection = makeMaterialProjection("en", index + 1);
      yield* insertMaterialProjection(projection, identity).pipe(
        Effect.provide(
          RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
        )
      );
      yield* Effect.promise(() =>
        insertReleaseItem(ctx, identity, projection.contentKey, index)
      );
    }
    const id = yield* Effect.promise(() =>
      ctx.db.insert("contentModelBuilds", {
        base: {
          kind: "empty",
        },
        generation: 1,
        itemIndex: -1,
        key: "primary",
        manifestHash: identity.manifestHash,
        phase: "materialApply",
        releaseId: identity.releaseId,
        sequence: identity.sequence,
        slots: {
          articleBaseSlot: "blue",
          articleTargetSlot: "blue",
          materialBaseSlot: "blue",
          materialTargetSlot: "green",
          searchBaseSlot: "blue",
          searchTargetSlot: "green",
        },
        updatedAt: 1,
      })
    );
    const build = yield* Effect.promise(() =>
      ctx.db.get("contentModelBuilds", id)
    );
    const release = yield* Effect.promise(() =>
      ctx.db.query("contentReleases").unique()
    );
    assert(build && release);
    return {
      build,
      release: yield* Schema.decodeEffect(contentReleases.Doc)(release),
    };
  });
}
describe("material inactive-buffer synchronization", () => {
  it.effect(
    "writes a complete changed page without changing the active material slot",
    () =>
      Effect.gen(function* () {
        const runtimeServices = yield* Effect.context<never>();
        const t = convexTest(schema, convexModules);
        const staged = yield* Effect.promise(() =>
          t.mutation((ctx) =>
            Effect.runPromiseWith(runtimeServices)(stageBuild(ctx))
          )
        );
        const signed = yield* decodeReleaseJson(staged.release.releaseJson);
        const result = yield* Effect.promise(() =>
          t.mutation((ctx) =>
            Effect.runPromiseWith(runtimeServices)(
              syncMaterials(staged.build, staged.release, signed).pipe(
                Effect.provide(
                  RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
                )
              )
            )
          )
        );
        expect(result).toEqual({
          done: true,
          itemIndex: 1,
          processed: 2,
        });
        const rows = yield* Effect.promise(() =>
          t.query((ctx) => ctx.db.query("materialCatalog").collect())
        );
        const active = Arr.filter(rows, (row) => row.slot === "blue");
        const candidate = Arr.filter(rows, (row) => row.slot === "green");
        expect(active).toHaveLength(2);
        expect(candidate).toHaveLength(2);
        expect(Arr.map(candidate, (row) => row.contentKey)).toEqual(
          Arr.map(active, (row) => row.contentKey)
        );
        expect(Arr.map(candidate, (row) => row.projectionHash)).toEqual(
          Arr.map(active, (row) => row.projectionHash)
        );
      })
  );
  it.effect(
    "removes a deleted identity from the candidate and permits safe replay",
    () =>
      Effect.gen(function* () {
        const runtimeServices = yield* Effect.context<never>();
        const t = convexTest(schema, convexModules);
        const staged = yield* Effect.promise(() =>
          t.mutation((ctx) =>
            Effect.runPromiseWith(runtimeServices)(stageBuild(ctx))
          )
        );
        const signed = yield* decodeReleaseJson(staged.release.releaseJson);
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            Effect.runPromiseWith(runtimeServices)(
              syncMaterials(staged.build, staged.release, signed).pipe(
                Effect.provide(
                  RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
                )
              )
            )
          )
        );
        const deleted = makeMaterialProjection("en", 1);
        yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            const heads = await ctx.db.query("contentHeads").collect();
            const head = heads.find(
              (row) => row.contentKey === deleted.contentKey
            );
            assert(head);
            await ctx.db.patch("contentHeads", head._id, {
              operation: "delete",
            });
          })
        );
        for (let replay = 0; replay < 2; replay += 1) {
          yield* Effect.promise(() =>
            t.mutation((ctx) =>
              Effect.runPromiseWith(runtimeServices)(
                syncMaterials(staged.build, staged.release, signed).pipe(
                  Effect.provide(
                    RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
                  )
                )
              )
            )
          );
        }
        const rows = yield* Effect.promise(() =>
          t.query((ctx) => ctx.db.query("materialCatalog").collect())
        );
        expect(Arr.filter(rows, (row) => row.slot === "blue")).toHaveLength(2);
        expect(Arr.filter(rows, (row) => row.slot === "green")).toMatchObject([
          {
            contentKey: makeMaterialProjection("en", 2).contentKey,
          },
        ]);
      })
  );
});
