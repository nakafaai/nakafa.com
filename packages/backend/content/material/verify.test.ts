import { assert, describe, expect, it } from "@effect/vitest";
import { verifyMaterial } from "@repo/backend/content/material/verify";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { TEST_ARTICLE_PROJECTION_JSON } from "@repo/backend/test/content/runtime";
import { activateMaterialCatalog } from "@repo/backend/test/material/catalog";
import { convexTest } from "convex-test";
import { Effect } from "effect";

describe("standalone material authentication", () => {
  it.effect(
    "authenticates stored bytes and rejects another content family",
    () =>
      Effect.gen(function* () {
        const target = convexTest(schema, convexModules);
        yield* Effect.promise(() => activateMaterialCatalog(target));
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
        ).toMatchObject({ code: "CONTENT_RELEASE_INTEGRITY" });
      })
  );
});
