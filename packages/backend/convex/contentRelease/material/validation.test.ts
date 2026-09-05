import { assert, describe, expect, it } from "@effect/vitest";
import { validateMaterialModel } from "@repo/backend/convex/contentRelease/material/validation";
import { copyMaterialModel } from "@repo/backend/convex/contentRelease/models/material";
import { MODEL_BUILD_PAGE_ROWS } from "@repo/backend/convex/contentRelease/models/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeMaterialProjection } from "@repo/backend/test/content/material";
import {
  activateMaterialCatalog,
  MATERIAL_IDENTITY,
} from "@repo/backend/test/material/catalog";
import { convexTest } from "convex-test";
import { Effect } from "effect";

describe("inactive material validation pages", () => {
  it.effect(
    "copies and verifies every candidate projection across a durable page boundary",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        const projections = Array.from(
          { length: MODEL_BUILD_PAGE_ROWS + 1 },
          (_, index) => makeMaterialProjection("en", index + 1)
        );
        yield* Effect.promise(() => activateMaterialCatalog(t, projections));
        const stored = yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            const id = await ctx.db.insert("contentModelBuilds", {
              base: { kind: "release", ...MATERIAL_IDENTITY },
              generation: 1,
              itemIndex: -1,
              key: "primary",
              manifestHash: MATERIAL_IDENTITY.manifestHash,
              phase: "materialCopyCatalog",
              releaseId: MATERIAL_IDENTITY.releaseId,
              sequence: MATERIAL_IDENTITY.sequence,
              updatedAt: 1,
              slots: {
                articleBaseSlot: "blue",
                articleTargetSlot: "blue",
                materialBaseSlot: "blue",
                materialTargetSlot: "green",
                searchBaseSlot: "blue",
                searchTargetSlot: "green",
              },
            });
            return ctx.db.get("contentModelBuilds", id);
          })
        );
        assert(stored);
        const firstCopy = yield* Effect.promise(() =>
          t.mutation((ctx) => runConvexProgram(copyMaterialModel(ctx, stored)))
        );
        expect(firstCopy).toMatchObject({
          done: false,
          processed: MODEL_BUILD_PAGE_ROWS,
        });
        const secondCopy = yield* Effect.promise(() =>
          t.mutation((ctx) =>
            runConvexProgram(
              copyMaterialModel(ctx, {
                ...stored,
                cursor: firstCopy.cursor,
              })
            )
          )
        );
        expect(secondCopy).toMatchObject({ done: true, processed: 1 });
        const first = yield* Effect.promise(() =>
          t.mutation((ctx) =>
            runConvexProgram(
              validateMaterialModel(ctx, {
                ...stored,
                phase: "materialVerify",
              })
            )
          )
        );
        expect(first).toMatchObject({
          done: false,
          processed: MODEL_BUILD_PAGE_ROWS,
          cursor: expect.any(String),
        });
        const second = yield* Effect.promise(() =>
          t.mutation((ctx) =>
            runConvexProgram(
              validateMaterialModel(ctx, {
                ...stored,
                cursor: first.cursor,
                phase: "materialVerify",
              })
            )
          )
        );
        expect(second).toEqual({ cursor: undefined, done: true, processed: 1 });
      })
  );
});
