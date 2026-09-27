import { RegisteredConvexFunction } from "@confect/server";
import { assert, describe, expect, it } from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { convexModules } from "@repo/backend/confect/test.setup";
import { verifyMaterial } from "@repo/backend/content/material/verify";
import schema from "@repo/backend/convex/schema";
import { TEST_ARTICLE_PROJECTION_JSON } from "@repo/backend/test/content/runtime";
import { activateMaterialCatalog } from "@repo/backend/test/material/catalog";
import { convexTest } from "convex-test";
import { Effect } from "effect";

describe("standalone material authentication", () => {
  it.effect(
    "authenticates stored bytes and rejects another content family",
    () =>
      Effect.gen(function* () {
        const runtimeServices = yield* Effect.context<never>();
        const target = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          target.mutation((ctx) =>
            Effect.runPromiseWith(runtimeServices)(
              activateMaterialCatalog().pipe(
                Effect.provide(
                  RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
                )
              )
            )
          )
        );
        const row = yield* Effect.promise(() =>
          target.query((ctx) => ctx.db.query("materialCatalog").first())
        );
        assert(row);
        const verified = yield* verifyMaterial(row);
        expect(verified.projection.contentKey).toBe(row.contentKey);
        expect(verified.projectionJson).toBe(row.projectionJson);
        expect(
          yield* verifyMaterial({
            ...row,
            projectionJson: TEST_ARTICLE_PROJECTION_JSON,
          }).pipe(Effect.flip)
        ).toMatchObject({
          code: "CONTENT_RELEASE_INTEGRITY",
        });
      })
  );
});
