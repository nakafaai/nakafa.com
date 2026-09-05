import { assert, describe, expect, it } from "@effect/vitest";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { syncMaterials } from "@repo/backend/convex/contentRelease/material/sync";
import { decodeReleaseJson } from "@repo/backend/convex/contentRelease/parse";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeMaterialProjection } from "@repo/backend/test/content/material";
import {
  insertCompletedRelease,
  insertReleaseItem,
} from "@repo/backend/test/content/model";
import { insertMaterialProjection } from "@repo/backend/test/material/catalog";
import { convexTest } from "convex-test";
import { Effect } from "effect";

const identity = {
  manifestHash: `sha256:${"6".repeat(64)}`,
  releaseId: "material-sync-candidate",
  sequence: 1,
};

/** Stages real immutable heads and a durable build with a separate target slot. */
async function stageBuild(ctx: MutationCtx) {
  await insertCompletedRelease(ctx, identity, 2);
  for (let index = 0; index < 2; index += 1) {
    const projection = makeMaterialProjection("en", index + 1);
    await insertMaterialProjection(ctx, projection, identity);
    await insertReleaseItem(ctx, identity, projection.contentKey, index);
  }
  const id = await ctx.db.insert("contentModelBuilds", {
    base: { kind: "empty" },
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
  });
  const build = await ctx.db.get("contentModelBuilds", id);
  const release = await ctx.db.query("contentReleases").unique();
  assert(build && release);
  return { build, release };
}

describe("material inactive-buffer synchronization", () => {
  it.effect(
    "writes a complete changed page without changing the active material slot",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        const staged = yield* Effect.promise(() => t.mutation(stageBuild));
        const signed = yield* decodeReleaseJson(staged.release.releaseJson);
        const result = yield* Effect.promise(() =>
          t.mutation((ctx) =>
            runConvexProgram(
              syncMaterials(ctx, staged.build, staged.release, signed)
            )
          )
        );
        expect(result).toEqual({ done: true, itemIndex: 1, processed: 2 });
        const rows = yield* Effect.promise(() =>
          t.query((ctx) => ctx.db.query("materialCatalog").collect())
        );
        const active = rows.filter((row) => row.slot === "blue");
        const candidate = rows.filter((row) => row.slot === "green");
        expect(active).toHaveLength(2);
        expect(candidate).toHaveLength(2);
        expect(candidate.map((row) => row.contentKey)).toEqual(
          active.map((row) => row.contentKey)
        );
        expect(candidate.map((row) => row.projectionHash)).toEqual(
          active.map((row) => row.projectionHash)
        );
      })
  );

  it.effect(
    "removes a deleted identity from the candidate and permits safe replay",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        const staged = yield* Effect.promise(() => t.mutation(stageBuild));
        const signed = yield* decodeReleaseJson(staged.release.releaseJson);
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            runConvexProgram(
              syncMaterials(ctx, staged.build, staged.release, signed)
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
              runConvexProgram(
                syncMaterials(ctx, staged.build, staged.release, signed)
              )
            )
          );
        }
        const rows = yield* Effect.promise(() =>
          t.query((ctx) => ctx.db.query("materialCatalog").collect())
        );
        expect(rows.filter((row) => row.slot === "blue")).toHaveLength(2);
        expect(rows.filter((row) => row.slot === "green")).toMatchObject([
          { contentKey: makeMaterialProjection("en", 2).contentKey },
        ]);
      })
  );
});
