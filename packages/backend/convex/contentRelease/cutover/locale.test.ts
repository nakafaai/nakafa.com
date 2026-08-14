import { retireLegacyTryoutFields } from "@repo/backend/convex/contentRelease/cutover/locale";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { insertProvedCutoverInventory } from "@repo/backend/test/content-cutover";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

describe("contentRelease/cutover/locale", () => {
  it("removes the exact retained legacy fields and retries idempotently", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) => insertProvedCutoverInventory(ctx));

    await expect(
      t.mutation((ctx) => runConvexProgram(retireLegacyTryoutFields(ctx)))
    ).resolves.toEqual({
      attempts: 21,
      localeRemoved: 31,
      placements: 1720,
      progress: 10,
      titleRemoved: 1720,
    });
    await expect(
      t.mutation((ctx) => runConvexProgram(retireLegacyTryoutFields(ctx)))
    ).resolves.toEqual({
      attempts: 21,
      localeRemoved: 0,
      placements: 1720,
      progress: 10,
      titleRemoved: 0,
    });

    await expect(
      t.run(async (ctx) => ({
        attempts: (await ctx.db.query("tryoutAttempts").collect()).every(
          (row) => !("locale" in row)
        ),
        placements: (
          await ctx.db.query("tryoutAttemptPlacements").collect()
        ).every((row) => !("title" in row)),
        progress: (await ctx.db.query("tryoutSetProgress").collect()).every(
          (row) => !("locale" in row)
        ),
      }))
    ).resolves.toEqual({ attempts: true, placements: true, progress: true });
  });

  it("fails closed on a mixed locale state without patching another row", async () => {
    const t = convexTest(schema, convexModules);
    const fixture = await t.mutation((ctx) =>
      insertProvedCutoverInventory(ctx)
    );
    await t.mutation((ctx) =>
      ctx.db.patch("tryoutAttempts", fixture.attemptIds[0], {
        locale: undefined,
      })
    );

    await expect(
      t.mutation((ctx) => runConvexProgram(retireLegacyTryoutFields(ctx)))
    ).rejects.toMatchObject({
      data: {
        code: "CONTENT_RELEASE_INTEGRITY",
        message: expect.stringContaining("partially present"),
      },
    });
    await expect(
      t.run((ctx) => ctx.db.get("tryoutAttempts", fixture.attemptIds[1]))
    ).resolves.toMatchObject({ locale: "id" });
  });

  it("fails closed on a mixed placement title state", async () => {
    const t = convexTest(schema, convexModules);
    const fixture = await t.mutation((ctx) =>
      insertProvedCutoverInventory(ctx)
    );
    await t.mutation((ctx) =>
      ctx.db.patch("tryoutAttemptPlacements", fixture.placementIds[0], {
        title: undefined,
      })
    );

    await expect(
      t.mutation((ctx) => runConvexProgram(retireLegacyTryoutFields(ctx)))
    ).rejects.toMatchObject({
      data: {
        code: "CONTENT_RELEASE_INTEGRITY",
        message: expect.stringContaining("titles are only partially present"),
      },
    });
    await expect(
      t.run((ctx) =>
        ctx.db.get("tryoutAttemptPlacements", fixture.placementIds[1])
      )
    ).resolves.toMatchObject({ title: "Question 2" });
  });

  it("rejects a locale mismatch before changing the inventory", async () => {
    const t = convexTest(schema, convexModules);
    const fixture = await t.mutation((ctx) =>
      insertProvedCutoverInventory(ctx)
    );
    await t.mutation((ctx) =>
      ctx.db.patch("tryoutAttempts", fixture.attemptIds[0], { locale: "en" })
    );

    await expect(
      t.mutation((ctx) => runConvexProgram(retireLegacyTryoutFields(ctx)))
    ).rejects.toMatchObject({
      data: {
        code: "CONTENT_RELEASE_INTEGRITY",
        message: expect.stringContaining("proved locale"),
      },
    });
    await expect(
      t.run((ctx) => ctx.db.get("tryoutAttempts", fixture.attemptIds[1]))
    ).resolves.toMatchObject({ locale: "id" });
  });

  it("rejects a progress row that does not select the latest attempt", async () => {
    const t = convexTest(schema, convexModules);
    const fixture = await t.mutation((ctx) =>
      insertProvedCutoverInventory(ctx)
    );
    await t.mutation(async (ctx) => {
      const row = await ctx.db.get(fixture.progressIds[0]);
      if (!row) {
        throw new Error("Expected locale retirement progress fixture.");
      }
      const earlier = fixture.attemptIds[0];
      await ctx.db.patch("tryoutSetProgress", row._id, {
        attemptNumber: 1,
        latestAttemptId: earlier,
      });
    });

    await expect(
      t.mutation((ctx) => runConvexProgram(retireLegacyTryoutFields(ctx)))
    ).rejects.toMatchObject({
      data: {
        code: "CONTENT_RELEASE_INTEGRITY",
        message: expect.stringContaining("latest retained attempt"),
      },
    });
  });

  it("requires the proved checkpoint and exact row counts", async () => {
    const t = convexTest(schema, convexModules);
    const fixture = await t.mutation((ctx) =>
      insertProvedCutoverInventory(ctx)
    );
    await t.mutation((ctx) => ctx.db.delete(fixture.progressIds[0]));

    await expect(
      t.mutation((ctx) => runConvexProgram(retireLegacyTryoutFields(ctx)))
    ).rejects.toMatchObject({
      data: {
        code: "CONTENT_RELEASE_INTEGRITY",
        message: expect.stringContaining("inventory differs"),
      },
    });

    const withoutCheckpoint = convexTest(schema, convexModules);
    await expect(
      withoutCheckpoint.mutation((ctx) =>
        runConvexProgram(retireLegacyTryoutFields(ctx))
      )
    ).rejects.toMatchObject({
      data: {
        code: "CONTENT_RELEASE_STATE",
        message: expect.stringContaining("phase proved"),
      },
    });
  });
});
