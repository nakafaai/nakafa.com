import { describe, expect, it } from "@effect/vitest";
import type { ActiveAppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { internal } from "@repo/backend/convex/_generated/api";
import { loadActiveIdentity } from "@repo/backend/convex/contentRelease/runtime/active";
import type { PublicRuntimeRow } from "@repo/backend/convex/contentRelease/runtime/public/internal";
import {
  readPublicRuntime,
  resolvePublicRoute,
} from "@repo/backend/convex/contentRelease/runtime/public/internal";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  FUNCTION_MATERIAL_JSON,
  FUNCTION_MATERIAL_KEY,
  FUNCTION_MATERIAL_PATH,
  FUNCTION_MATERIAL_SOURCE,
  testProjectionJson,
} from "@repo/backend/test/content/material";
import { testTextHash } from "@repo/backend/test/content/release";
import {
  insertRuntimeRelease,
  TEST_ARTICLE_KEY,
  TEST_ARTICLE_PATH,
  TEST_ARTICLE_PROJECTION_JSON,
  TEST_ARTICLE_SOURCE,
} from "@repo/backend/test/content/runtime";
import {
  insertRuntimeBinding,
  insertRuntimeHead,
  insertRuntimeVersion,
} from "@repo/backend/test/runtime/head";
import {
  TEST_RUNTIME_PATH,
  TEST_RUNTIME_RELEASE,
} from "@repo/backend/test/runtime/values";
import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";

const routeArgs = {
  appLocale: "en",
  publicPath: TEST_RUNTIME_PATH,
} satisfies {
  readonly appLocale: ActiveAppLocaleCode;
  readonly publicPath: string;
};
const readPublic = internal.contentRelease.runtime.public.internal.read;
const readPublicBatch = makeFunctionReference<
  "query",
  {
    readonly requests: ReadonlyArray<{
      readonly appLocale: ActiveAppLocaleCode;
      readonly publicPath: string;
    }>;
  },
  readonly PublicRuntimeRow[]
>("contentRelease/runtime/public/internal:readBatch");

describe("contentRelease/runtime/public/internal", () => {
  it("uses five indexed operations for one current public body", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertRuntimeRelease(ctx);
      await insertRuntimeHead(ctx, "public", "test:public");
    });

    const { metrics, result } = await t.query(async (ctx) => {
      const result = await runConvexProgram(
        resolvePublicRoute(ctx, "en", TEST_RUNTIME_PATH)
      );
      return {
        metrics: await ctx.meta.getTransactionMetrics(),
        result,
      };
    });

    expect(result).toMatchObject({ delivery: "public" });
    expect(metrics.databaseQueries.used).toBe(5);
  });

  it("returns at most eight routes in exact request order", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertRuntimeRelease(ctx);
      await insertRuntimeHead(ctx, "public", "test:public");
    });
    const missingRoute = {
      appLocale: "en",
      publicPath: "test/missing",
    } satisfies typeof routeArgs;
    const requests = [
      routeArgs,
      missingRoute,
      ...Array.from({ length: 6 }, () => routeArgs),
    ];

    const rows = await t.query(readPublicBatch, { requests });

    expect(rows).toHaveLength(8);
    expect(rows.map((row) => row?.delivery ?? null)).toEqual([
      "public",
      null,
      "public",
      "public",
      "public",
      "public",
      "public",
      "public",
    ]);
    await expect(
      t.query(readPublicBatch, {
        requests: Array.from({ length: 9 }, () => routeArgs),
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
  });

  it("returns public heads without exposing restricted delivery classes", async () => {
    for (const delivery of ["public", "authenticated", "entitled"] as const) {
      const t = convexTest(schema, convexModules);
      await t.mutation(async (ctx) => {
        await insertRuntimeRelease(ctx);
        await insertRuntimeHead(ctx, delivery, `test:${delivery}`);
      });

      const result = await t.query(readPublic, routeArgs);
      if (delivery === "public") {
        expect(result).toMatchObject({
          activeReleaseId: TEST_RUNTIME_RELEASE.releaseId,
          delivery,
        });
      } else {
        expect(result).toBeNull();
      }
    }
  });

  it("returns the exact pair-grouped article through the public read", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertRuntimeRelease(ctx);
      await insertRuntimeHead(ctx, "public", TEST_ARTICLE_KEY, {
        projectionJson: TEST_ARTICLE_PROJECTION_JSON,
        publicPath: TEST_ARTICLE_PATH,
        rendererDomain: "politics",
        sourcePath: TEST_ARTICLE_SOURCE,
      });
    });

    const found = await t.query(readPublic, {
      appLocale: "en",
      publicPath: TEST_ARTICLE_PATH,
    });

    expect(found).toMatchObject({
      activeReleaseId: TEST_RUNTIME_RELEASE.releaseId,
      delivery: "public",
      projectionJson: TEST_ARTICLE_PROJECTION_JSON,
      sourcePath: TEST_ARTICLE_SOURCE,
    });
  });

  it("returns the exact active canonical material and projection hash", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertRuntimeRelease(ctx);
      await insertRuntimeHead(ctx, "public", FUNCTION_MATERIAL_KEY, {
        projectionJson: FUNCTION_MATERIAL_JSON,
        publicPath: FUNCTION_MATERIAL_PATH,
        rendererDomain: "mathematics",
        sourcePath: FUNCTION_MATERIAL_SOURCE,
      });
    });

    await expect(
      t.query(readPublic, {
        appLocale: "en",
        publicPath: FUNCTION_MATERIAL_PATH,
      })
    ).resolves.toMatchObject({
      projectionHash: testTextHash(FUNCTION_MATERIAL_JSON),
      projectionJson: FUNCTION_MATERIAL_JSON,
      sourcePath: FUNCTION_MATERIAL_SOURCE,
    });
  });

  it("reuses an older binding with the latest active content head", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertRuntimeRelease(ctx);
      await insertRuntimeBinding(ctx, "test:structural", {
        bindingReleaseId: "release-sequence-1",
        bindingSequence: 1,
      });
      await insertRuntimeVersion(ctx, "public", "test:structural", {
        headSequence: TEST_RUNTIME_RELEASE.sequence,
      });
    });

    await expect(t.query(readPublic, routeArgs)).resolves.toMatchObject({
      activeReleaseId: TEST_RUNTIME_RELEASE.releaseId,
      delivery: "public",
    });
  });

  it("rejects same-sequence release mismatch and projection path drift", async () => {
    const mismatch = convexTest(schema, convexModules);
    await mismatch.mutation(async (ctx) => {
      await insertRuntimeRelease(ctx);
      await insertRuntimeBinding(ctx, "test:mismatch", {
        bindingReleaseId: "release-wrong",
      });
      await insertRuntimeVersion(ctx, "public", "test:mismatch");
    });
    await expect(mismatch.query(readPublic, routeArgs)).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });

    const drift = convexTest(schema, convexModules);
    await drift.mutation(async (ctx) => {
      await insertRuntimeRelease(ctx);
      await insertRuntimeHead(ctx, "public", "test:drift", {
        projectionJson: testProjectionJson({
          contentKey: "test:drift",
          publicPath: "subjects/test/different",
        }),
      });
    });
    await expect(drift.query(readPublic, routeArgs)).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("applies route tombstones and newer delivery policy", async () => {
    const deleted = convexTest(schema, convexModules);
    await deleted.mutation(async (ctx) => {
      await insertRuntimeRelease(ctx);
      await insertRuntimeHead(ctx, "public", "test:deleted", {
        bindingReleaseId: "release-sequence-1",
        bindingSequence: 1,
        headReleaseId: "release-sequence-1",
        headSequence: 1,
      });
      await insertRuntimeBinding(ctx, null, {
        bindingSequence: TEST_RUNTIME_RELEASE.sequence,
      });
    });
    await expect(deleted.query(readPublic, routeArgs)).resolves.toBeNull();

    const changed = convexTest(schema, convexModules);
    await changed.mutation(async (ctx) => {
      await insertRuntimeRelease(ctx);
      await insertRuntimeBinding(ctx, "test:delivery", {
        bindingReleaseId: "release-sequence-1",
        bindingSequence: 1,
      });
      await insertRuntimeVersion(ctx, "public", "test:delivery", {
        artifactHash: `sha256:${"f".repeat(64)}`,
        headReleaseId: "release-sequence-1",
        headSequence: 1,
      });
      await insertRuntimeVersion(ctx, "entitled", "test:delivery");
    });
    await expect(changed.query(readPublic, routeArgs)).resolves.toBeNull();
  });

  it("makes a canonical rename visible only at its new projection path", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertRuntimeRelease(ctx);
      await insertRuntimeHead(ctx, "public", "test:renamed", {
        artifactHash: `sha256:${"1".repeat(64)}`,
        bindingReleaseId: "release-sequence-1",
        bindingSequence: 1,
        headReleaseId: "release-sequence-1",
        headSequence: 1,
        publicPath: "subjects/test/old",
      });
      await insertRuntimeVersion(ctx, "public", "test:renamed", {
        artifactHash: `sha256:${"2".repeat(64)}`,
        publicPath: TEST_RUNTIME_PATH,
      });
      await insertRuntimeBinding(ctx, null, {
        publicPath: "subjects/test/old",
      });
      await insertRuntimeBinding(ctx, "test:renamed");
    });

    await expect(
      t.query(readPublic, {
        appLocale: "en",
        publicPath: "subjects/test/old",
      })
    ).resolves.toBeNull();
    await expect(t.query(readPublic, routeArgs)).resolves.toMatchObject({
      delivery: "public",
    });
  });

  it("returns absence without active state and fails for a missing artifact", async () => {
    const empty = convexTest(schema, convexModules);
    await expect(empty.query(readPublic, routeArgs)).resolves.toBeNull();
    await expect(
      empty.query(readPublicBatch, { requests: [routeArgs, routeArgs] })
    ).resolves.toEqual([null, null]);

    const missing = convexTest(schema, convexModules);
    await missing.mutation(async (ctx) => {
      await insertRuntimeRelease(ctx);
      await insertRuntimeHead(ctx, "public", "test:missing");
      const artifact = await ctx.db.query("contentArtifacts").unique();
      if (!artifact) {
        throw new Error("Expected runtime artifact.");
      }
      await ctx.db.delete("contentArtifacts", artifact._id);
    });
    await expect(missing.query(readPublic, routeArgs)).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_MISSING" },
    });
  });

  it("fails closed for duplicate versions at one sequence", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertRuntimeRelease(ctx);
      await insertRuntimeHead(ctx, "public", "test:duplicate");
      await insertRuntimeVersion(ctx, "public", "test:duplicate", {
        artifactHash: `sha256:${"e".repeat(64)}`,
      });
    });

    await expect(t.query(readPublic, routeArgs)).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("fails closed for deleted, incomplete, orphaned, and anonymous routes", async () => {
    const deleted = convexTest(schema, convexModules);
    await deleted.mutation(async (ctx) => {
      await insertRuntimeRelease(ctx);
      await insertRuntimeHead(ctx, "public", "test:deleted-head");
      const head = await ctx.db.query("contentHeads").unique();
      if (!head) {
        return expect.fail("Expected one deletable runtime head.");
      }
      await ctx.db.delete("contentHeads", head._id);
      await ctx.db.insert("contentHeads", {
        artifactLocale: head.artifactLocale,
        contentKey: head.contentKey,
        family: head.family,
        index: head.index,
        operation: "delete",
        releaseId: head.releaseId,
        sequence: head.sequence,
      });
    });
    await expect(deleted.query(readPublic, routeArgs)).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
    await expect(
      deleted.query(async (ctx) => {
        const active = await runConvexProgram(loadActiveIdentity(ctx));
        const head = await ctx.db.query("contentHeads").unique();
        if (!(active && head)) {
          throw new Error("Expected one active delete-head fixture.");
        }
        return await runConvexProgram(
          readPublicRuntime(
            ctx,
            active,
            head,
            routeArgs.appLocale,
            routeArgs.publicPath
          )
        );
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });

    const incomplete = convexTest(schema, convexModules);
    await incomplete.mutation(async (ctx) => {
      await insertRuntimeRelease(ctx);
      await insertRuntimeHead(ctx, "public", "test:incomplete");
      const head = await ctx.db.query("contentHeads").unique();
      if (!head) {
        return expect.fail("Expected one incomplete runtime head.");
      }
      await ctx.db.patch("contentHeads", head._id, {
        compilerConfigHash: undefined,
      });
    });
    await expect(incomplete.query(readPublic, routeArgs)).rejects.toMatchObject(
      {
        data: { code: "CONTENT_RELEASE_INTEGRITY" },
      }
    );

    const orphaned = convexTest(schema, convexModules);
    await orphaned.mutation(async (ctx) => {
      await insertRuntimeRelease(ctx);
      await insertRuntimeBinding(ctx, "test:orphaned");
    });
    await expect(orphaned.query(readPublic, routeArgs)).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });

    const anonymous = convexTest(schema, convexModules);
    await anonymous.mutation(async (ctx) => {
      await insertRuntimeRelease(ctx);
      await insertRuntimeHead(ctx, "public", "test:anonymous");
      const binding = await ctx.db.query("contentBindings").unique();
      if (!binding) {
        return expect.fail("Expected one anonymizable route binding.");
      }
      await ctx.db.patch("contentBindings", binding._id, {
        contentKey: undefined,
      });
    });
    await expect(anonymous.query(readPublic, routeArgs)).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });
});
