import { assert, describe, expect, it } from "@effect/vitest";
import { ACTIVE_APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import { convexMaterialLayer } from "@repo/backend/content/material/convex";
import { readMaterialNavigation } from "@repo/backend/content/material/navigation";
import {
  readMaterialDelivery,
  readMaterialLesson,
} from "@repo/backend/content/material/read";
import { api } from "@repo/backend/convex/_generated/api";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeMaterialProjection } from "@repo/backend/test/content/material";
import {
  insertTestState,
  insertZeroRelease,
} from "@repo/backend/test/content/state";
import {
  activateMaterialCatalog,
  advanceMaterialCatalog,
  MATERIAL_IDENTITY,
} from "@repo/backend/test/material/catalog";
import { convexTest } from "convex-test";
import { Effect } from "effect";

describe("material navigation reuse", () => {
  it("keeps lesson reads constant as the authenticated sibling group grows", async () => {
    const target = convexTest(schema, convexModules);
    const projections = ACTIVE_APP_LOCALE_CODES.flatMap((appLocale) =>
      Array.from({ length: 10 }, (_, index) =>
        makeMaterialProjection(appLocale, index + 1)
      )
    );
    await activateMaterialCatalog(target, projections);
    const requested = makeMaterialProjection("en", 1);
    const previous = await target.query(async (ctx) => {
      const result = await runConvexProgram(
        readMaterialDelivery("en", requested.publicPath).pipe(
          Effect.provide(convexMaterialLayer(ctx))
        )
      );
      return { result, metrics: await ctx.meta.getTransactionMetrics() };
    });
    const current = await target.query(async (ctx) => {
      const result = await runConvexProgram(
        readMaterialLesson("en", requested.publicPath).pipe(
          Effect.provide(convexMaterialLayer(ctx))
        )
      );
      return { result, metrics: await ctx.meta.getTransactionMetrics() };
    });
    const group = await target.query(async (ctx) => {
      const result = await runConvexProgram(
        readMaterialNavigation(
          "en",
          requested.materialKey,
          MATERIAL_IDENTITY.releaseId
        ).pipe(Effect.provide(convexMaterialLayer(ctx)))
      );
      return { result, metrics: await ctx.meta.getTransactionMetrics() };
    });
    const navigation = group.result;

    expect(current.result.runtimeJson).toBe(previous.result.runtimeJson);
    expect({
      ...current.result.model,
      siblingJson: navigation.siblingJson,
    }).toEqual(previous.result.model);
    expect(navigation.siblingJson).toHaveLength(10);
    expect(previous.metrics.databaseQueries.used).toBe(31);
    expect(current.metrics.databaseQueries.used).toBe(12);
    expect(group.metrics.databaseQueries.used).toBe(23);
    // The first cold pair costs 35 queries; reuse pays back on a second lesson.
    expect(
      current.metrics.databaseQueries.used * 2 +
        group.metrics.databaseQueries.used
    ).toBeLessThan(previous.metrics.databaseQueries.used * 2);
    expect(current.metrics.bytesRead.used).toBeLessThan(
      previous.metrics.bytesRead.used
    );
    const other = await target.query(api.contentRelease.material.lesson, {
      appLocale: "en",
      publicPath: makeMaterialProjection("en", 2).publicPath,
    });
    expect(other.materialKey).toBe(current.result.materialKey);
    expect(other.model.activeReleaseId).toBe(navigation.activeReleaseId);
  });

  it("returns an authenticated withdrawal without requesting a group", async () => {
    const target = convexTest(schema, convexModules);
    await activateMaterialCatalog(target);
    const result = await target.query(api.contentRelease.material.lesson, {
      appLocale: "en",
      publicPath: "subjects/test/missing",
    });
    expect(result).toMatchObject({ materialKey: null, runtimeJson: null });
    expect(result.model.projectionJson).toBeNull();
  });

  it("rejects navigation from a different active publication", async () => {
    const target = convexTest(schema, convexModules);
    await activateMaterialCatalog(target);
    const args = {
      appLocale: "en" as const,
      expectedActiveReleaseId: MATERIAL_IDENTITY.releaseId,
      materialKey: makeMaterialProjection("en", 1).materialKey,
    };
    const before = await target.query(
      api.contentRelease.material.navigation,
      args
    );
    await advanceMaterialCatalog(target);
    await expect(
      target.query(api.contentRelease.material.navigation, args)
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_STATE" } });
    const after = await target.query(api.contentRelease.material.navigation, {
      ...args,
      expectedActiveReleaseId: "release-next",
    });
    expect(after.siblingJson).toEqual(before.siblingJson);
    expect(after.activeReleaseId).not.toBe(before.activeReleaseId);
  });

  it("rejects missing groups and corrupted sibling provenance", async () => {
    const target = convexTest(schema, convexModules);
    await activateMaterialCatalog(target);
    const args = {
      appLocale: "en" as const,
      expectedActiveReleaseId: MATERIAL_IDENTITY.releaseId,
      materialKey: makeMaterialProjection("en", 1).materialKey,
    };
    await expect(
      target.query(api.contentRelease.material.navigation, {
        ...args,
        materialKey: "lesson.test.missing",
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_MISSING" } });
    await target.mutation(async (ctx) => {
      const row = await ctx.db
        .query("materialCatalog")
        .withIndex("by_slot_and_appLocale_and_publicPath", (index) =>
          index
            .eq("slot", "blue")
            .eq("appLocale", "en")
            .eq("publicPath", makeMaterialProjection("en", 2).publicPath)
        )
        .unique();
      assert(row);
      await ctx.db.patch("materialCatalog", row._id, { releaseId: "corrupt" });
    });
    await expect(
      target.query(api.contentRelease.material.navigation, args)
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
  });

  it("rejects a release that does not own material navigation", async () => {
    const target = convexTest(schema, convexModules);
    await target.mutation(async (ctx) => {
      await insertZeroRelease(ctx, {
        ...MATERIAL_IDENTITY,
        ownership: { base: [], result: [] },
        role: "candidate",
        status: "completed",
      });
      await insertTestState(ctx, {
        active: MATERIAL_IDENTITY,
        nextSequence: 2,
      });
    });
    await expect(
      target.query(api.contentRelease.material.navigation, {
        appLocale: "en",
        expectedActiveReleaseId: MATERIAL_IDENTITY.releaseId,
        materialKey: "lesson.test.functions",
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_MISSING" } });
  });
});
