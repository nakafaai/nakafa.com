import { afterEach, assert, describe, expect, it } from "@effect/vitest";
import {
  ACCOUNT_DELETION_SUCCESSOR_PAGE_SIZE,
  ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE,
} from "@repo/backend/convex/auth/deletion/constants";
import { finalizeSchoolTransfers } from "@repo/backend/convex/auth/deletion/transfers";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  seedDeletionUser,
  seedPreparedDeletionSchool,
} from "@repo/backend/test/deletion/seed";
import { convexTest } from "convex-test";

const NOW = Date.UTC(2026, 6, 28, 10);
const ATTEMPT_ID = "019fa44c-02be-7cd0-a4ed-61a7af8e0620";

describe("reserved deletion school transfers", () => {
  afterEach(() => vi.restoreAllMocks());

  it("continues fallback past a full page of unavailable successors", async () => {
    const t = convexTest(schema, convexModules);
    const seeded = await t.mutation(async (ctx) => {
      const result = await seedPreparedDeletionSchool(
        ctx,
        "fallback-owner",
        NOW,
        ATTEMPT_ID
      );
      await ctx.db.patch("users", result.successorId, {
        deletionPreparedAt: NOW,
      });
      for (
        let index = 1;
        index < ACCOUNT_DELETION_SUCCESSOR_PAGE_SIZE;
        index += 1
      ) {
        const userId = await seedDeletionUser(
          ctx,
          `fallback-deleting-${index}`,
          { deletionPreparedAt: NOW }
        );
        await ctx.db.insert("schoolMembers", {
          joinedAt: NOW,
          role: "student",
          schoolId: result.schoolId,
          status: "active",
          updatedAt: NOW,
          userId,
        });
      }
      const activeSuccessorId = await seedDeletionUser(ctx, "fallback-active");
      await ctx.db.insert("schoolMembers", {
        joinedAt: NOW,
        role: "student",
        schoolId: result.schoolId,
        status: "active",
        updatedAt: NOW,
        userId: activeSuccessorId,
      });
      return { ...result, activeSuccessorId };
    });
    const advance = () =>
      t.mutation(async (ctx) => {
        const owner = await ctx.db.get("users", seeded.ownerId);
        assert(owner);
        return runConvexProgram(
          finalizeSchoolTransfers(ctx, owner, seeded.preparationId, NOW)
        );
      });
    await expect(advance()).resolves.toBe(true);
    await expect(
      t.query((ctx) => ctx.db.query("accountDeletionSchoolTransfers").unique())
    ).resolves.toMatchObject({
      successorCursor: expect.any(String),
    });
    await expect(advance()).resolves.toBe(true);
    await expect(advance()).resolves.toBe(false);
    await expect(
      t.query((ctx) => ctx.db.get("schools", seeded.schoolId))
    ).resolves.toMatchObject({
      createdBy: seeded.activeSuccessorId,
    });
    await expect(
      t.query((ctx) => ctx.db.query("accountDeletionSchoolTransfers").collect())
    ).resolves.toEqual([]);
  });

  it("bounds each transaction and drops completed duplicate reservations on the next page", async () => {
    const t = convexTest(schema, convexModules);
    const seeded = await t.mutation(async (ctx) => {
      const result = await seedPreparedDeletionSchool(
        ctx,
        "batch-owner",
        NOW,
        ATTEMPT_ID
      );
      for (
        let index = 1;
        index <= ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE;
        index += 1
      ) {
        await ctx.db.insert("accountDeletionSchoolTransfers", {
          preparationId: result.preparationId,
          schoolId: result.schoolId,
          successorMembershipId: result.successorMembershipId,
          successorUserId: result.successorId,
        });
      }
      return result;
    });
    const advance = () =>
      t.mutation(async (ctx) => {
        const owner = await ctx.db.get("users", seeded.ownerId);
        assert(owner);
        return runConvexProgram(
          finalizeSchoolTransfers(ctx, owner, seeded.preparationId, NOW)
        );
      });
    await expect(advance()).resolves.toBe(true);
    await expect(
      t.query((ctx) => ctx.db.query("accountDeletionSchoolTransfers").collect())
    ).resolves.toHaveLength(1);
    await expect(advance()).resolves.toBe(false);
    await expect(
      t.query((ctx) => ctx.db.query("accountDeletionSchoolTransfers").collect())
    ).resolves.toEqual([]);
    await expect(
      t.query((ctx) =>
        ctx.db.get("schoolMembers", seeded.successorMembershipId)
      )
    ).resolves.toMatchObject({ role: "admin" });
    await expect(
      t.query((ctx) => ctx.db.get("schools", seeded.schoolId))
    ).resolves.toMatchObject({ createdBy: seeded.successorId });
  });

  it("retains reservations when reading the owned school fails", async () => {
    const t = convexTest(schema, convexModules);
    const seeded = await t.mutation((ctx) =>
      seedPreparedDeletionSchool(ctx, "failed-owner", NOW, ATTEMPT_ID)
    );
    await expect(
      t.mutation(async (ctx) => {
        const owner = await ctx.db.get("users", seeded.ownerId);
        assert(owner);
        vi.spyOn(ctx.db, "get").mockRejectedValueOnce(
          new Error("school unavailable")
        );
        return runConvexProgram(
          finalizeSchoolTransfers(ctx, owner, seeded.preparationId, NOW)
        );
      })
    ).rejects.toMatchObject({
      data: { code: "USER_CLEANUP_FAILED", message: "school unavailable" },
    });
    await expect(
      t.query((ctx) => ctx.db.query("accountDeletionSchoolTransfers").collect())
    ).resolves.toHaveLength(1);
    await expect(
      t.query((ctx) => ctx.db.get("schools", seeded.schoolId))
    ).resolves.toMatchObject({ createdBy: seeded.ownerId });
  });
});
