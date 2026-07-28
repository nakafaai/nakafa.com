import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { ACCOUNT_DELETION_SUCCESSOR_PAGE_SIZE } from "@repo/backend/convex/auth/deletion/constants";
import { findSchoolOwnershipSuccessorPage } from "@repo/backend/convex/auth/deletion/successor";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const NOW = Date.UTC(2026, 6, 28, 8, 0, 0);

async function insertUser(
  ctx: MutationCtx,
  suffix: string,
  deletedAt?: number
) {
  return await ctx.db.insert("users", {
    authId: `successor-${suffix}`,
    credits: 0,
    creditsResetAt: 0,
    deletedAt,
    email: `successor-${suffix}@example.com`,
    name: `Successor ${suffix}`,
    plan: "free",
  });
}

describe("auth/deletion/successor", () => {
  it("continues past a full page of deleting members", async () => {
    const t = convexTest(schema, convexModules);
    const seeded = await t.mutation(async (ctx) => {
      const ownerId = await insertUser(ctx, "owner");
      const schoolId = await ctx.db.insert("schools", {
        city: "Jakarta",
        createdBy: ownerId,
        currentStudents: ACCOUNT_DELETION_SUCCESSOR_PAGE_SIZE + 1,
        currentTeachers: 0,
        email: "successor-school@example.com",
        name: "Successor School",
        province: "DKI Jakarta",
        slug: "successor-school",
        type: "high-school",
        updatedAt: NOW,
      });

      for (
        let index = 0;
        index < ACCOUNT_DELETION_SUCCESSOR_PAGE_SIZE;
        index += 1
      ) {
        const userId = await insertUser(ctx, `deleting-${index}`, NOW);
        await ctx.db.insert("schoolMembers", {
          joinedAt: NOW,
          role: "student",
          schoolId,
          status: "active",
          updatedAt: NOW,
          userId,
        });
      }

      const successorId = await insertUser(ctx, "active");
      const successorMembershipId = await ctx.db.insert("schoolMembers", {
        joinedAt: NOW,
        role: "student",
        schoolId,
        status: "active",
        updatedAt: NOW,
        userId: successorId,
      });

      return { ownerId, schoolId, successorMembershipId };
    });
    const firstPage = await t.mutation((ctx) =>
      runConvexProgram(
        findSchoolOwnershipSuccessorPage(
          ctx,
          seeded.schoolId,
          seeded.ownerId,
          null
        )
      )
    );

    expect(firstPage.kind).toBe("continue");

    if (firstPage.kind !== "continue") {
      return;
    }

    const secondPage = await t.mutation((ctx) =>
      runConvexProgram(
        findSchoolOwnershipSuccessorPage(
          ctx,
          seeded.schoolId,
          seeded.ownerId,
          firstPage.cursor
        )
      )
    );

    expect(secondPage).toMatchObject({
      kind: "found",
      successorMembership: {
        _id: seeded.successorMembershipId,
      },
    });
  });
});
