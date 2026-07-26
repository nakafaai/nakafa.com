import { api } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { testProjectionJson } from "@repo/backend/test/content-release";
import {
  insertRuntimeRelease,
  TEST_RUNTIME_PATH,
  TEST_RUNTIME_RELEASE,
} from "@repo/backend/test/content-runtime";
import {
  insertRuntimeBinding,
  insertRuntimeHead,
  insertRuntimeVersion,
} from "@repo/backend/test/runtime-head";
import type { FunctionArgs } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const resolve = api.contentRelease.ownership.resolve;
const routeArgs: FunctionArgs<typeof resolve> = {
  family: "material",
  locale: "en",
  publicPath: TEST_RUNTIME_PATH,
};

describe("contentRelease/ownership", () => {
  it("distinguishes unmanaged paths from active published material", async () => {
    const empty = convexTest(schema, convexModules);
    await expect(empty.query(resolve, routeArgs)).resolves.toEqual({
      activeReleaseId: null,
      kind: "unmanaged",
    });

    const unmanaged = convexTest(schema, convexModules);
    await unmanaged.mutation((ctx) => insertRuntimeRelease(ctx, ["article"]));
    await expect(unmanaged.query(resolve, routeArgs)).resolves.toEqual({
      activeReleaseId: TEST_RUNTIME_RELEASE.releaseId,
      kind: "unmanaged",
    });

    const published = convexTest(schema, convexModules);
    await published.mutation(async (ctx) => {
      await insertRuntimeRelease(ctx);
      await insertRuntimeHead(ctx, "public", "test:published");
    });
    await expect(published.query(resolve, routeArgs)).resolves.toMatchObject({
      activeReleaseId: TEST_RUNTIME_RELEASE.releaseId,
      kind: "found",
    });
  });

  it("keeps candidate-only ownership unmanaged before activation", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertRuntimeRelease(ctx, ["article"]);
      await ctx.db.insert("contentPaths", {
        createdSequence: TEST_RUNTIME_RELEASE.sequence + 1,
        locale: "en",
        publicPath: TEST_RUNTIME_PATH,
      });
    });

    await expect(t.query(resolve, routeArgs)).resolves.toEqual({
      activeReleaseId: TEST_RUNTIME_RELEASE.releaseId,
      kind: "unmanaged",
    });
  });

  it("uses exact active ownership instead of permanent route history", async () => {
    const managed = convexTest(schema, convexModules);
    await managed.mutation(async (ctx) => {
      await insertRuntimeRelease(ctx, ["article"]);
      await insertRuntimeHead(ctx, "public", "test:exact");
      await ctx.db.insert("contentOwners", {
        contentKey: "test:exact",
        family: "material",
        locale: "en",
        managed: true,
        releaseId: TEST_RUNTIME_RELEASE.releaseId,
        sequence: TEST_RUNTIME_RELEASE.sequence,
      });
    });
    await expect(managed.query(resolve, routeArgs)).resolves.toMatchObject({
      activeReleaseId: TEST_RUNTIME_RELEASE.releaseId,
      kind: "found",
    });

    const restored = convexTest(schema, convexModules);
    await restored.mutation(async (ctx) => {
      await insertRuntimeRelease(ctx, ["article"]);
      await insertRuntimeHead(ctx, "public", "test:restored");
      await ctx.db.insert("contentOwners", {
        contentKey: "test:restored",
        family: "material",
        locale: "en",
        managed: false,
        releaseId: TEST_RUNTIME_RELEASE.releaseId,
        sequence: TEST_RUNTIME_RELEASE.sequence,
      });
    });
    await expect(restored.query(resolve, routeArgs)).resolves.toEqual({
      activeReleaseId: TEST_RUNTIME_RELEASE.releaseId,
      kind: "unmanaged",
    });
  });

  it("fails visibly when active bindings or heads lose their identity", async () => {
    const anonymous = convexTest(schema, convexModules);
    await anonymous.mutation(async (ctx) => {
      await insertRuntimeRelease(ctx);
      await insertRuntimeHead(ctx, "public", "test:anonymous");
      const binding = await ctx.db.query("contentBindings").unique();
      if (!binding) {
        throw new Error("Expected one route binding.");
      }
      await ctx.db.patch("contentBindings", binding._id, {
        contentKey: undefined,
      });
    });
    await expect(anonymous.query(resolve, routeArgs)).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });

    const privateHead = convexTest(schema, convexModules);
    await privateHead.mutation(async (ctx) => {
      await insertRuntimeRelease(ctx);
      await insertRuntimeHead(ctx, "authenticated", "test:private");
    });
    await expect(privateHead.query(resolve, routeArgs)).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });

    const disagreement = convexTest(schema, convexModules);
    await disagreement.mutation(async (ctx) => {
      await insertRuntimeRelease(ctx);
      await insertRuntimeHead(ctx, "public", "test:disagreement", {
        bindingReleaseId: "release-other",
      });
    });
    await expect(disagreement.query(resolve, routeArgs)).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("keeps owned absence and tombstones missing without source fallback", async () => {
    const absent = convexTest(schema, convexModules);
    await absent.mutation(async (ctx) => {
      await insertRuntimeRelease(ctx);
      await ctx.db.insert("contentPaths", {
        createdSequence: 1,
        locale: "en",
        publicPath: TEST_RUNTIME_PATH,
      });
    });
    await expect(absent.query(resolve, routeArgs)).resolves.toEqual({
      activeReleaseId: TEST_RUNTIME_RELEASE.releaseId,
      kind: "missing",
    });

    const deleted = convexTest(schema, convexModules);
    await deleted.mutation(async (ctx) => {
      await insertRuntimeRelease(ctx);
      await insertRuntimeHead(ctx, "public", "test:deleted", {
        bindingReleaseId: "release-one",
        bindingSequence: 1,
        headReleaseId: "release-one",
        headSequence: 1,
      });
      await insertRuntimeBinding(ctx, null);
    });
    await expect(deleted.query(resolve, routeArgs)).resolves.toEqual({
      activeReleaseId: TEST_RUNTIME_RELEASE.releaseId,
      kind: "missing",
    });
  });

  it("moves canonical ownership from a tombstoned path to its rename", async () => {
    const oldPath = "test/old";
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertRuntimeRelease(ctx);
      await insertRuntimeHead(ctx, "public", "test:renamed", {
        bindingReleaseId: "release-one",
        bindingSequence: 1,
        headReleaseId: "release-one",
        headSequence: 1,
        publicPath: oldPath,
      });
      await insertRuntimeVersion(ctx, "public", "test:renamed");
      await insertRuntimeBinding(ctx, null, { publicPath: oldPath });
      await insertRuntimeBinding(ctx, "test:renamed");
    });

    await expect(
      t.query(resolve, { ...routeArgs, publicPath: oldPath })
    ).resolves.toEqual({
      activeReleaseId: TEST_RUNTIME_RELEASE.releaseId,
      kind: "missing",
    });
    await expect(t.query(resolve, routeArgs)).resolves.toMatchObject({
      kind: "found",
    });
  });

  it("fails visibly for duplicate ownership and mismatched projections", async () => {
    const duplicate = convexTest(schema, convexModules);
    await duplicate.mutation(async (ctx) => {
      await insertRuntimeRelease(ctx, ["article"]);
      await insertRuntimeHead(ctx, "public", "test:duplicate");
      await ctx.db.insert("contentOwners", {
        contentKey: "test:duplicate",
        family: "material",
        locale: "en",
        managed: true,
        releaseId: "release-owner-one",
        sequence: TEST_RUNTIME_RELEASE.sequence,
      });
      await ctx.db.insert("contentOwners", {
        contentKey: "test:duplicate",
        family: "material",
        locale: "en",
        managed: true,
        releaseId: "release-owner-two",
        sequence: TEST_RUNTIME_RELEASE.sequence,
      });
    });
    await expect(duplicate.query(resolve, routeArgs)).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });

    const drift = convexTest(schema, convexModules);
    await drift.mutation(async (ctx) => {
      await insertRuntimeRelease(ctx);
      await insertRuntimeHead(ctx, "public", "test:drift", {
        projectionJson: testProjectionJson({
          contentKey: "test:drift",
          publicPath: "test/other",
        }),
      });
    });
    await expect(drift.query(resolve, routeArgs)).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_ROUTE" },
    });
  });
});
