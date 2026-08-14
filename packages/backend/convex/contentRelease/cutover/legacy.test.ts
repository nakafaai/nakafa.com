import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { deleteLegacyPage } from "@repo/backend/convex/contentRelease/cutover/legacy";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const TEST_INVENTORY = [
  { batchSize: 1, expected: 2, table: "authors" },
  { batchSize: 1, expected: 0, table: "articleReferences" },
] as const;

describe("contentRelease/cutover/legacy", () => {
  it("cannot delete legacy rows before the reader cutover is accepted", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) => seedLegacyDrain(ctx, false));

    await expect(
      t.mutation((ctx) =>
        runConvexProgram(deleteLegacyPage(ctx, TEST_INVENTORY))
      )
    ).rejects.toMatchObject({
      data: {
        code: "CONTENT_RELEASE_STATE",
        message: expect.stringContaining(
          "reader cutover has not been accepted"
        ),
      },
    });
    await expect(
      t.run((ctx) => ctx.db.query("authors").take(3))
    ).resolves.toHaveLength(2);
  });

  it("resumes exact bounded pages and preserves unrelated durable rows", async () => {
    const t = convexTest(schema, convexModules);
    const userId = await t.mutation(seedLegacyDrain);

    const first = await t.mutation((ctx) =>
      runConvexProgram(deleteLegacyPage(ctx, TEST_INVENTORY))
    );
    const completed = await t.mutation((ctx) =>
      runConvexProgram(deleteLegacyPage(ctx, TEST_INVENTORY))
    );
    const empty = await t.mutation((ctx) =>
      runConvexProgram(deleteLegacyPage(ctx, TEST_INVENTORY))
    );
    const repeated = await t.mutation((ctx) =>
      runConvexProgram(deleteLegacyPage(ctx, TEST_INVENTORY))
    );

    expect(first).toEqual({
      complete: false,
      deleted: 1,
      phase: "draining-legacy",
      table: "authors",
    });
    expect(completed).toEqual({
      complete: false,
      deleted: 1,
      phase: "draining-legacy",
      table: "articleReferences",
    });
    expect(empty).toEqual({
      complete: true,
      deleted: 0,
      phase: "legacy-drained",
      table: null,
    });
    expect(repeated).toEqual({
      complete: true,
      deleted: 0,
      phase: "legacy-drained",
      table: null,
    });
    await expect(
      t.run(async (ctx) => ({
        authors: await ctx.db.query("authors").take(1),
        user: await ctx.db.get("users", userId),
      }))
    ).resolves.toMatchObject({
      authors: [],
      user: { email: "retained@example.com" },
    });
  });
});

async function seedLegacyDrain(ctx: MutationCtx, readerAccepted = true) {
  await ctx.db.insert("authors", { name: "First", username: "first" });
  await ctx.db.insert("authors", { name: "Second", username: "second" });
  const userId = await ctx.db.insert("users", {
    authId: "retained-user",
    credits: 0,
    creditsResetAt: 1,
    email: "retained@example.com",
    name: "Retained User",
    plan: "free",
  });
  await ctx.db.insert("contentCutoverState", {
    auditedActiveReleaseId: "active-release",
    auditedActiveSequence: 1,
    auditedAt: 1,
    auditedLegacyWriteVersion: 0,
    auditedNextSequence: 2,
    currentDeleted: 0,
    currentTableDeleted: 0,
    currentTableIndex: 0,
    currentTablePreserved: 0,
    inventoryVersion: "production-2026-08-13",
    key: "phase1",
    legacyDeleted: 0,
    legacyTableDeleted: 0,
    legacyTableIndex: 0,
    phase: "audited",
    ...(readerAccepted ? { readerCutoverAcceptedAt: 1 } : {}),
    updatedAt: 1,
  });
  return userId;
}
