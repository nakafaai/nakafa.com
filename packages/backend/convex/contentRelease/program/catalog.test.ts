import { decodeSnapshotRowJson } from "@repo/backend/convex/contentRelease/parse";
import { readProgramCatalog } from "@repo/backend/convex/contentRelease/program/catalog";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  TEST_MANIFEST_HASH,
  TEST_RELEASE_ID,
} from "@repo/backend/test/content-release";
import {
  activateProgramSnapshot,
  makeProgramSnapshotData,
} from "@repo/backend/test/program-snapshot";
import { convexTest } from "convex-test";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

describe("contentRelease/program/catalog", () => {
  it("returns an empty unmanaged catalog before program publication", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.query((ctx) => runConvexProgram(readProgramCatalog(ctx, "en")))
    ).resolves.toMatchObject({
      managed: false,
      programJson: [],
      routeJson: [],
      sourceRevision: null,
    });
  });

  it("returns verified programs and localized root routes in source order", async () => {
    const data = await Effect.runPromise(makeProgramSnapshotData());
    const t = convexTest(schema, convexModules);
    await activateProgramSnapshot(t, data);
    const result = await t.query((ctx) =>
      runConvexProgram(readProgramCatalog(ctx, "id"))
    );
    const programs = await Effect.runPromise(
      Effect.forEach(result.programJson, decodeSnapshotRowJson)
    );
    const routes = await Effect.runPromise(
      Effect.forEach(result.routeJson, decodeSnapshotRowJson)
    );

    expect(result).toMatchObject({
      activeManifestHash: TEST_MANIFEST_HASH,
      activeReleaseId: TEST_RELEASE_ID,
      managed: true,
      snapshotId: data.snapshotId,
      sourceRevision: "a".repeat(40),
    });
    expect(programs).toMatchObject([
      {
        family: "program",
        record: { kind: "program", row: { key: "technical-program-1" } },
      },
      {
        family: "program",
        record: { kind: "program", row: { key: "technical-program-2" } },
      },
    ]);
    expect(routes).toMatchObject([
      {
        family: "program",
        record: {
          kind: "curriculum",
          row: { publicPath: "kurikulum/program-teknis-1" },
        },
      },
      {
        family: "program",
        record: {
          kind: "curriculum",
          row: { publicPath: "kurikulum/program-teknis-2" },
        },
      },
    ]);
  });

  it("rejects a root route whose program row disappeared", async () => {
    const data = await Effect.runPromise(makeProgramSnapshotData());
    const t = convexTest(schema, convexModules);
    await activateProgramSnapshot(t, data);
    await t.mutation(async (ctx) => {
      const program = await ctx.db
        .query("programCatalog")
        .withIndex("by_snapshotId_and_programKey", (index) =>
          index
            .eq("snapshotId", data.snapshotId)
            .eq("programKey", "technical-program-1")
        )
        .unique();
      if (!program) {
        throw new Error("Expected one technical program.");
      }
      await ctx.db.delete(program._id);
    });

    await expect(
      t.query((ctx) => runConvexProgram(readProgramCatalog(ctx, "en")))
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("rejects a program whose localized root disappeared", async () => {
    const data = await Effect.runPromise(makeProgramSnapshotData());
    const t = convexTest(schema, convexModules);
    await activateProgramSnapshot(t, data);
    await t.mutation(async (ctx) => {
      const root = await ctx.db
        .query("curriculumRoutes")
        .withIndex("by_snapshotId_and_locale_and_path", (index) =>
          index
            .eq("snapshotId", data.snapshotId)
            .eq("locale", "en")
            .eq("path", "curriculum/technical-program-1")
        )
        .unique();
      if (!root) {
        throw new Error("Expected one English technical program root.");
      }
      await ctx.db.delete(root._id);
    });

    await expect(
      t.query((ctx) => runConvexProgram(readProgramCatalog(ctx, "en")))
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("rejects a program catalog beyond its bounded read contract", async () => {
    const data = await Effect.runPromise(makeProgramSnapshotData());
    const t = convexTest(schema, convexModules);
    await activateProgramSnapshot(t, data);
    await t.mutation(async (ctx) => {
      for (let index = 2; index < 101; index += 1) {
        await ctx.db.insert("programCatalog", {
          displayOrder: index,
          index: index + 4,
          programKey: `overflow-program-${index}`,
          rowHash: "not-read",
          rowJson: "not-read",
          snapshotId: data.snapshotId,
        });
      }
    });

    await expect(
      t.query((ctx) => runConvexProgram(readProgramCatalog(ctx, "en")))
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_LIMIT" },
    });
  });
});
