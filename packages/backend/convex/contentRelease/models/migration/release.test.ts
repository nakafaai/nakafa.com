import { describe, expect, it } from "@effect/vitest";
import { internal } from "@repo/backend/convex/_generated/api";
import {
  cleanReleasePage,
  verifyReleasePage,
} from "@repo/backend/convex/contentRelease/models/migration/release";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { insertZeroRelease } from "@repo/backend/test/content/state";
import { convexTest } from "convex-test";

const ACTIVE = {
  manifestHash: `sha256:${"a".repeat(64)}`,
  releaseId: "release-model-progress",
  sequence: 1,
} as const;

const LEGACY_FIELDS = [
  "articleCursor",
  "articleIndex",
  "articleSyncedAt",
  "materialCursor",
  "materialIndex",
  "materialSyncedAt",
  "searchIndex",
  "searchSyncedAt",
  "syncGeneration",
  "syncJobId",
] as const;

describe("contentRelease/models/migration/release", () => {
  it("removes and verifies every predecessor read-model progress field", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertZeroRelease(ctx, {
        ...ACTIVE,
        ownership: { base: [], result: [] },
        role: "candidate",
        status: "completed",
      });
      const release = await ctx.db.query("contentReleases").unique();
      expect(release).not.toBeNull();
      if (release) {
        const syncJobId = await ctx.scheduler.runAfter(
          60_000,
          internal.contentRelease.models.migrate.run,
          {}
        );
        await ctx.db.patch("contentReleases", release._id, {
          articleCursor: "article-cursor",
          articleIndex: 1,
          articleSyncedAt: 1,
          materialCursor: "material-cursor",
          materialIndex: 1,
          materialSyncedAt: 1,
          searchIndex: 1,
          searchSyncedAt: 1,
          syncGeneration: 1,
          syncJobId,
        });
      }
      await ctx.db.insert("contentModelMigrations", {
        activeManifestHash: ACTIVE.manifestHash,
        activeReleaseId: ACTIVE.releaseId,
        activeSequence: ACTIVE.sequence,
        key: "primary",
        phase: "backfill",
        scannedRows: 0,
        table: "contentReleases",
        updatedAt: 1,
      });
    });

    await expect(
      t.mutation(async (ctx) => {
        const migration = await ctx.db.query("contentModelMigrations").unique();
        expect(migration).not.toBeNull();
        if (migration) {
          await runConvexProgram(verifyReleasePage(ctx, migration));
        }
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });

    await t.mutation(async (ctx) => {
      const migration = await ctx.db.query("contentModelMigrations").unique();
      expect(migration).not.toBeNull();
      if (migration) {
        await runConvexProgram(cleanReleasePage(ctx, migration));
      }
    });
    await t.mutation(async (ctx) => {
      const migration = await ctx.db.query("contentModelMigrations").unique();
      expect(migration).not.toBeNull();
      if (migration) {
        await runConvexProgram(verifyReleasePage(ctx, migration));
      }
    });
    const release = await t.run((ctx) =>
      ctx.db.query("contentReleases").unique()
    );
    for (const field of LEGACY_FIELDS) {
      expect(release).not.toHaveProperty(field);
    }
  });
});
