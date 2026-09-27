import { assert, expect, it } from "@effect/vitest";
import { ROUTE_CATALOG_PAGE_LIMIT } from "@repo/backend/confect/contentRelease/spec";
import { convexModules } from "@repo/backend/confect/test.setup";
import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { TEST_QUESTION_PROJECTION_JSON } from "@repo/backend/test/content/question";
import { TEST_RELEASE_ID } from "@repo/backend/test/content/release";
import {
  beginFixture,
  stageUpsertFixture,
} from "@repo/backend/test/content/verify";
import { convexTest } from "convex-test";

const readRoutes = internal.contentRelease.proof.routes.routes;
const input = { releaseId: TEST_RELEASE_ID, cursor: null };

it.each([
  {
    name: "missing content key",
    binding: { contentKey: undefined },
    code: "CONTENT_RELEASE_INTEGRITY",
  },
  {
    name: "missing head",
    binding: { contentKey: "missing-content" },
    code: "CONTENT_RELEASE_ROUTE",
  },
  {
    name: "deleted head",
    head: { operation: "delete" },
    code: "CONTENT_RELEASE_ROUTE",
  },
  {
    name: "missing projection",
    head: { projectionJson: undefined },
    code: "CONTENT_RELEASE_INTEGRITY",
  },
  {
    name: "protected question",
    head: { projectionJson: TEST_QUESTION_PROJECTION_JSON },
    code: "CONTENT_RELEASE_ROUTE",
  },
  {
    name: "wrong family",
    head: { family: "article" },
    code: "CONTENT_RELEASE_ROUTE",
  },
  {
    name: "conflicting release at the same sequence",
    binding: { releaseId: "conflicting-release" },
    code: "CONTENT_RELEASE_INTEGRITY",
  },
] as const)("rejects a bound route with $name", async (corruption) => {
  const t = convexTest(schema, convexModules);
  await stageUpsertFixture(t);
  await beginFixture(t);
  await t.mutation(internal.contentRelease.verify.verifyItems, {
    releaseId: TEST_RELEASE_ID,
    afterIndex: -1,
  });
  await expect(t.query(readRoutes, input)).resolves.toEqual({
    checked: 1,
    done: true,
    nextCursor: null,
  });
  await t.mutation(async (ctx) => {
    const binding = await ctx.db.query("contentBindings").unique();
    const head = await ctx.db.query("contentHeads").unique();
    assert(binding && head);
    if ("binding" in corruption && corruption.binding) {
      await ctx.db.patch("contentBindings", binding._id, corruption.binding);
    }
    if ("head" in corruption && corruption.head) {
      await ctx.db.patch("contentHeads", head._id, corruption.head);
    }
  });
  await expect(t.query(readRoutes, input)).rejects.toMatchObject({
    data: { code: corruption.code },
  });
});

it.each(["deleted", "absent"])(
  "ignores permanent paths whose binding is %s",
  async (bindingState) => {
    const t = convexTest(schema, convexModules);
    await stageUpsertFixture(t);
    await beginFixture(t);
    await t.mutation(async (ctx) => {
      const binding = await ctx.db.query("contentBindings").unique();
      assert(binding);
      if (bindingState === "deleted") {
        await ctx.db.patch("contentBindings", binding._id, {
          operation: "delete",
          contentKey: undefined,
        });
      } else {
        await ctx.db.delete("contentBindings", binding._id);
      }
    });
    await expect(t.query(readRoutes, input)).resolves.toEqual({
      checked: 1,
      done: true,
      nextCursor: null,
    });
  }
);

it("visits every permanent path across bounded catalog pages", async () => {
  const t = convexTest(schema, convexModules);
  await stageUpsertFixture(t);
  await beginFixture(t);
  await t.mutation(internal.contentRelease.verify.verifyItems, {
    releaseId: TEST_RELEASE_ID,
    afterIndex: -1,
  });
  await t.mutation(async (ctx) => {
    for (let index = 0; index < ROUTE_CATALOG_PAGE_LIMIT; index += 1) {
      await ctx.db.insert("contentPaths", {
        appLocale: "en",
        publicPath: `articles/retired-${index}`,
        createdSequence: 1,
      });
    }
  });
  const first = await t.query(readRoutes, input);
  expect(first).toMatchObject({
    checked: ROUTE_CATALOG_PAGE_LIMIT,
    done: false,
  });
  expect(first.nextCursor).toEqual(expect.any(String));
  await expect(
    t.query(readRoutes, { ...input, cursor: first.nextCursor })
  ).resolves.toEqual({ checked: 1, done: true, nextCursor: null });
});
