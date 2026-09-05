import { assert, describe, expect, it } from "@effect/vitest";
import { api } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeMaterialProjection } from "@repo/backend/test/content/material";
import { insertRuntimeRelease } from "@repo/backend/test/content/runtime";
import { activateMaterialCatalog } from "@repo/backend/test/material/catalog";
import { convexTest } from "convex-test";
import { Effect } from "effect";

describe("material read-model ownership", () => {
  it.effect(
    "does not claim an unbuilt material model from an article-only release",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          t.mutation((ctx) => insertRuntimeRelease(ctx, ["article"]))
        );
        const result = yield* Effect.promise(() =>
          t.query(api.contentRelease.material.latest, {
            appLocale: "en",
            limit: 1,
          })
        );
        expect(result).toMatchObject({ managed: false, materials: [] });
      })
  );

  it.effect(
    "rejects both discovery and route reads until the selected model catches up",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        yield* Effect.promise(() => activateMaterialCatalog(t));
        yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            const state = await ctx.db.query("contentState").unique();
            assert(state);
            await ctx.db.patch("contentState", state._id, {
              materialSequence: undefined,
            });
          })
        );
        yield* Effect.promise(() =>
          expect(
            t.query(api.contentRelease.material.latest, {
              appLocale: "en",
              limit: 1,
            })
          ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_STATE" } })
        );
        yield* Effect.promise(() =>
          expect(
            t.query(api.contentRelease.material.publication, {
              appLocale: "en",
              publicPath: makeMaterialProjection("en", 1).publicPath,
            })
          ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_STATE" } })
        );
      })
  );
});
