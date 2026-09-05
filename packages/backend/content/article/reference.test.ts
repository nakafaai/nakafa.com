import { assert, describe, expect, it } from "@effect/vitest";
import { convexArticleLayer } from "@repo/backend/content/article/convex";
import { readArticleReference } from "@repo/backend/content/article/reference";
import { resolveReferenceInput } from "@repo/backend/convex/contentRelease/reference/input";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  insertRuntimeArticles,
  testArticleProjection,
} from "@repo/backend/test/content/runtime";
import { convexTest } from "convex-test";
import { Effect } from "effect";

describe("article reference integrity", () => {
  it.effect(
    "returns absent references before ownership and after publication",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        const input = yield* resolveReferenceInput({
          kind: "route",
          appLocale: "en",
          publicPath: "articles/missing",
        });
        assert(input);
        for (const published of [false, true]) {
          if (published) {
            yield* Effect.promise(() =>
              t.mutation((ctx) => insertRuntimeArticles(ctx, 1))
            );
          }
          const result = yield* Effect.promise(() =>
            t.query((ctx) =>
              runConvexProgram(
                readArticleReference(input).pipe(
                  Effect.provide(convexArticleLayer(ctx))
                )
              )
            )
          );
          expect(result).toBeNull();
        }
      })
  );

  it.effect(
    "rejects duplicate public paths and graph identities before returning search content",
    () =>
      Effect.gen(function* () {
        const projection = testArticleProjection(0);
        for (const kind of ["route", "content"] as const) {
          const t = convexTest(schema, convexModules);
          yield* Effect.promise(() =>
            t.mutation(async (ctx) => {
              await insertRuntimeArticles(ctx, 2);
              const rows = await ctx.db.query("articleCatalog").collect();
              const other = rows.find(
                (row) => row.contentKey !== projection.contentKey
              );
              assert(other);
              await ctx.db.patch("articleCatalog", other._id, {
                assetId: projection.graph.assetId,
                publicPath: projection.publicPath,
              });
            })
          );
          const input = yield* resolveReferenceInput(
            kind === "route"
              ? { kind, appLocale: "en", publicPath: projection.publicPath }
              : { kind, contentId: projection.graph.assetId }
          );
          assert(input);
          yield* Effect.promise(() =>
            expect(
              t.query((ctx) =>
                runConvexProgram(
                  readArticleReference(input).pipe(
                    Effect.provide(convexArticleLayer(ctx))
                  )
                )
              )
            ).rejects.toMatchObject({
              data: { code: "CONTENT_RELEASE_INTEGRITY" },
            })
          );
        }
      })
  );
});
