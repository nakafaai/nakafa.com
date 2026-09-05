import { assert, describe, expect, it } from "@effect/vitest";
import { convexMaterialLayer } from "@repo/backend/content/material/convex";
import { readMaterialReference } from "@repo/backend/content/material/reference";
import { resolveReferenceInput } from "@repo/backend/convex/contentRelease/reference/input";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeMaterialProjection } from "@repo/backend/test/content/material";
import { activateMaterialCatalog } from "@repo/backend/test/material/catalog";
import { convexTest } from "convex-test";
import { Effect } from "effect";

describe("material reference integrity", () => {
  it.effect(
    "returns absent references before ownership and after publication",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        const input = yield* resolveReferenceInput({
          kind: "route",
          appLocale: "en",
          publicPath: "subjects/missing",
        });
        assert(input);
        for (const published of [false, true]) {
          if (published) {
            yield* Effect.promise(() => activateMaterialCatalog(t));
          }
          const result = yield* Effect.promise(() =>
            t.query((ctx) =>
              runConvexProgram(
                readMaterialReference(input).pipe(
                  Effect.provide(convexMaterialLayer(ctx))
                )
              )
            )
          );
          expect(result).toBeNull();
        }
      })
  );

  it.effect("rejects duplicate lesson paths and graph identities", () =>
    Effect.gen(function* () {
      const projection = makeMaterialProjection("en", 1);
      for (const kind of ["route", "content"] as const) {
        const t = convexTest(schema, convexModules);
        yield* Effect.promise(() => activateMaterialCatalog(t));
        yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            const rows = await ctx.db.query("materialCatalog").collect();
            const other = rows.find(
              (row) =>
                row.appLocale === "en" &&
                row.contentKey !== projection.contentKey
            );
            assert(other);
            await ctx.db.patch("materialCatalog", other._id, {
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
                readMaterialReference(input).pipe(
                  Effect.provide(convexMaterialLayer(ctx))
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

  it.effect(
    "rejects a topic identity that disagrees with its signed lesson",
    () =>
      Effect.gen(function* () {
        const projection = makeMaterialProjection("en", 1);
        const t = convexTest(schema, convexModules);
        yield* Effect.promise(() => activateMaterialCatalog(t));
        yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            const rows = await ctx.db.query("materialCatalog").collect();
            for (const row of rows.filter(
              (candidate) => candidate.appLocale === "en"
            )) {
              await ctx.db.patch("materialCatalog", row._id, {
                topicAssetId: "foreign-topic-identity",
              });
            }
          })
        );
        const input = yield* resolveReferenceInput({
          kind: "route",
          appLocale: "en",
          publicPath: projection.parentPath,
        });
        assert(input);
        yield* Effect.promise(() =>
          expect(
            t.query((ctx) =>
              runConvexProgram(
                readMaterialReference(input).pipe(
                  Effect.provide(convexMaterialLayer(ctx))
                )
              )
            )
          ).rejects.toMatchObject({
            data: { code: "CONTENT_RELEASE_INTEGRITY" },
          })
        );
      })
  );
});
