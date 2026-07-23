import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { testProjectionJson } from "@repo/backend/test/content-release";
import {
  insertRuntimeBinding,
  insertRuntimeHead,
  insertRuntimeRelease,
  insertRuntimeVersion,
  TEST_RUNTIME_PATH,
  TEST_RUNTIME_RELEASE,
} from "@repo/backend/test/content-runtime";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const routeArgs = {
  locale: "en",
  publicPath: TEST_RUNTIME_PATH,
} satisfies { readonly locale: "en" | "id"; readonly publicPath: string };
const readPublic = internal.contentRelease.runtime.readPublic;
const readAuthenticated = internal.contentRelease.runtime.readAuthenticated;
const readEntitled = internal.contentRelease.runtime.readEntitled;

describe("contentRelease/runtime", () => {
  it("separates public, authenticated, and entitled reads", async () => {
    for (const delivery of ["public", "authenticated", "entitled"] as const) {
      const t = convexTest(schema, convexModules);
      await t.mutation(async (ctx) => {
        await insertRuntimeRelease(ctx);
        await insertRuntimeHead(ctx, delivery, `test:${delivery}`);
      });

      const reads = {
        authenticated: await t.query(readAuthenticated, routeArgs),
        entitled: await t.query(readEntitled, routeArgs),
        public: await t.query(readPublic, routeArgs),
      };
      expect(reads[delivery]).toMatchObject({
        activeReleaseId: TEST_RUNTIME_RELEASE.releaseId,
        delivery,
      });
      for (const [kind, result] of Object.entries(reads)) {
        if (kind !== delivery) {
          expect(result).toBeNull();
        }
      }
    }
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
          publicPath: "test/different",
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
    await expect(changed.query(readEntitled, routeArgs)).resolves.toMatchObject(
      {
        delivery: "entitled",
      }
    );
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
        publicPath: "test/old",
      });
      await insertRuntimeVersion(ctx, "public", "test:renamed", {
        artifactHash: `sha256:${"2".repeat(64)}`,
        publicPath: TEST_RUNTIME_PATH,
      });
      await insertRuntimeBinding(ctx, null, { publicPath: "test/old" });
      await insertRuntimeBinding(ctx, "test:renamed");
    });

    await expect(
      t.query(readPublic, { locale: "en", publicPath: "test/old" })
    ).resolves.toBeNull();
    await expect(t.query(readPublic, routeArgs)).resolves.toMatchObject({
      delivery: "public",
    });
  });

  it("returns absence without active state and fails for a missing artifact", async () => {
    const empty = convexTest(schema, convexModules);
    await expect(empty.query(readPublic, routeArgs)).resolves.toBeNull();

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
});
