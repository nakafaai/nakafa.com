import { expect, it } from "@effect/vitest";
import { decodeRouteJson } from "@repo/backend/convex/contentRelease/parse";
import { stageRouteVersion } from "@repo/backend/convex/contentRelease/route";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { insertProofItem } from "@repo/backend/test/content/proof";
import {
  TEST_DIGEST,
  TEST_RELEASE_ID,
  testRouteJson,
} from "@repo/backend/test/content/release";
import { insertRoute } from "@repo/backend/test/content/rollback";
import { insertRuntimeVersion } from "@repo/backend/test/runtime/head";
import { convexTest } from "convex-test";
import { Effect } from "effect";

it.each(["missing", "deleted", "prior-missing", "prior-upsert"] as const)(
  "validates the bound content in the result snapshot: %s",
  async (state) => {
    const t = convexTest(schema, convexModules);
    if (state === "deleted") {
      await t.mutation((ctx) => insertProofItem(ctx, 0, "delete"));
    }
    if (state === "prior-upsert") {
      await t.mutation((ctx) =>
        insertRuntimeVersion(ctx, "public", "test:head-0", { headSequence: 1 })
      );
    }
    const routeJson = testRouteJson();
    const result = t.mutation((ctx) =>
      runConvexProgram(
        Effect.gen(function* () {
          const route = yield* decodeRouteJson(routeJson);
          yield* stageRouteVersion(
            ctx,
            route,
            routeJson,
            0,
            TEST_DIGEST,
            2,
            state.startsWith("prior") ? 1 : undefined
          );
        })
      )
    );
    if (state === "prior-upsert") {
      await result;
      expect(
        await t.query((ctx) => ctx.db.query("contentBindings").unique())
      ).toMatchObject({ contentKey: "test:head-0", operation: "bind" });
    } else {
      await expect(result).rejects.toMatchObject({
        data: {
          code:
            state === "deleted"
              ? "CONTENT_RELEASE_ROUTE"
              : "CONTENT_RELEASE_MISSING",
        },
      });
    }
  }
);

it.each([
  "index",
  "path",
  "unchanged",
  "missing-delete",
  "delete",
  "corrupt-delete",
] as const)("preserves immutable route ownership: %s", async (scenario) => {
  const t = convexTest(schema, convexModules);
  const publicPath = "subjects/test/route";
  const deleting = scenario.includes("delete");
  await t.mutation(async (ctx) => {
    if (scenario !== "missing-delete") {
      const id = await insertRoute(ctx, {
        contentKey: "test:head-0",
        index: scenario === "path" ? 1 : 0,
        publicPath: scenario === "index" ? "subjects/test/other" : publicPath,
        releaseId:
          scenario === "index" || scenario === "path"
            ? TEST_RELEASE_ID
            : "prior",
        sequence: 1,
      });
      if (scenario === "corrupt-delete") {
        await ctx.db.patch("contentBindings", id, { contentKey: undefined });
      }
    }
    await insertProofItem(ctx, 0);
  });
  const routeJson = testRouteJson({
    publicPath,
    operation: deleting ? "delete" : "bind",
  });
  const result = t.mutation((ctx) =>
    runConvexProgram(
      Effect.gen(function* () {
        const route = yield* decodeRouteJson(routeJson);
        yield* stageRouteVersion(ctx, route, routeJson, 0, TEST_DIGEST, 2, 1);
      })
    )
  );
  if (scenario === "delete") {
    await result;
    expect(
      await t.query((ctx) => ctx.db.query("contentBindings").collect())
    ).toContainEqual(
      expect.objectContaining({
        releaseId: TEST_RELEASE_ID,
        operation: "delete",
        contentKey: "test:head-0",
      })
    );
  } else {
    await expect(result).rejects.toMatchObject({
      data: {
        code: {
          "missing-delete": "CONTENT_RELEASE_MISSING",
          "corrupt-delete": "CONTENT_RELEASE_INTEGRITY",
          index: "CONTENT_RELEASE_CONFLICT",
          path: "CONTENT_RELEASE_CONFLICT",
          unchanged: "CONTENT_RELEASE_CONFLICT",
        }[scenario],
      },
    });
  }
});
