import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  ACCOUNT_DELETION_RECOVERY_DELAY_MS,
  ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE,
} from "@repo/backend/convex/auth/deletion/constants";
import { prepareAccountDeletion } from "@repo/backend/convex/auth/deletion/prepare";
import type { AccountDeletionPreparationOutcome } from "@repo/backend/convex/auth/deletion/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";

const NOW = Date.UTC(2026, 6, 28, 8, 0, 0);
const ATTEMPT_ID = "019fa44c-02be-7cd0-a4ed-61a7af8e0620";

async function settlePreparation(
  prepare: () => Promise<AccountDeletionPreparationOutcome>,
  observe: (
    outcome: AccountDeletionPreparationOutcome
  ) => Promise<void> | void = () => undefined
) {
  let outcome = await prepare();
  await observe(outcome);
  while (outcome === "continue") {
    outcome = await prepare();
    await observe(outcome);
  }
  return outcome;
}

/** Inserts one app user with optional deletion state. */
function insertUser(
  ctx: MutationCtx,
  authId: string,
  state: {
    readonly deletedAt?: number;
    readonly deletionPreparedAt?: number;
  } = {}
) {
  return ctx.db.insert("users", {
    authId,
    credits: 0,
    creditsResetAt: 0,
    email: `${authId}@example.com`,
    name: authId,
    plan: "free",
    ...state,
  });
}

/** Inserts one school owned by the test user. */
function insertOwnedSchool(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  slug: string
) {
  return ctx.db.insert("schools", {
    city: "Jakarta",
    createdBy: ownerId,
    currentStudents: 0,
    currentTeachers: 0,
    email: `${slug}@example.com`,
    name: slug,
    province: "DKI Jakarta",
    slug,
    type: "high-school",
    updatedAt: NOW,
  });
}

/** Inserts one active school membership. */
function insertActiveSchoolMember(
  ctx: MutationCtx,
  schoolId: Id<"schools">,
  userId: Id<"users">,
  role: Doc<"schoolMembers">["role"] = "student"
) {
  return ctx.db.insert("schoolMembers", {
    joinedAt: NOW,
    role,
    schoolId,
    status: "active",
    updatedAt: NOW,
    userId,
  });
}

describe("auth/deletion/prepare", () => {
  it("allows an account that does not own a school", async () => {
    const t = convexTest(schema, convexModules);

    const outcome = await t.mutation((ctx) =>
      runConvexProgram(
        prepareAccountDeletion(ctx, "missing-auth-user", ATTEMPT_ID)
      )
    );

    expect(outcome).toBe("ready");
  });

  it("leaves an owner-only school and account unchanged", async () => {
    const t = convexTest(schema, convexModules);

    const seeded = await t.mutation(async (ctx) => {
      const ownerId = await insertUser(ctx, "school-owner");
      const schoolId = await insertOwnedSchool(
        ctx,
        ownerId,
        "owner-only-school"
      );
      await insertActiveSchoolMember(ctx, schoolId, ownerId, "admin");

      return { ownerId, schoolId };
    });
    const outcome = await settlePreparation(() =>
      t.mutation((ctx) =>
        runConvexProgram(
          prepareAccountDeletion(ctx, "school-owner", ATTEMPT_ID)
        )
      )
    );
    const state = await t.query(async (ctx) => ({
      owner: await ctx.db.get("users", seeded.ownerId),
      preparations: await ctx.db.query("accountDeletionPreparations").collect(),
      school: await ctx.db.get("schools", seeded.schoolId),
    }));

    expect(outcome).toBe("school-successor-required");
    expect(state.owner).not.toHaveProperty("deletedAt");
    expect(state.owner).not.toHaveProperty("deletionPreparedAt");
    expect(state.preparations).toHaveLength(0);
    expect(state.school?.createdBy).toBe(seeded.ownerId);
  });

  it("reserves ownership successors without changing either school", async () => {
    const t = convexTest(schema, convexModules);

    const seeded = await t.mutation(async (ctx) => {
      const ownerId = await insertUser(ctx, "transfer-owner");
      const deletingSuccessorId = await insertUser(
        ctx,
        "deleting-transfer-successor",
        { deletedAt: NOW }
      );
      const successorId = await insertUser(ctx, "transfer-successor");
      const schoolId = await insertOwnedSchool(ctx, ownerId, "shared-school");
      await insertActiveSchoolMember(ctx, schoolId, ownerId, "admin");
      await insertActiveSchoolMember(
        ctx,
        schoolId,
        deletingSuccessorId,
        "teacher"
      );
      await insertActiveSchoolMember(ctx, schoolId, successorId);

      return { ownerId, schoolId, successorId };
    });
    const outcome = await settlePreparation(() =>
      t.mutation((ctx) =>
        runConvexProgram(
          prepareAccountDeletion(ctx, "transfer-owner", ATTEMPT_ID)
        )
      )
    );
    const state = await t.query(async (ctx) => ({
      owner: await ctx.db.get("users", seeded.ownerId),
      preparation: await ctx.db
        .query("accountDeletionPreparations")
        .withIndex("by_authId", (query) => query.eq("authId", "transfer-owner"))
        .unique(),
      school: await ctx.db.get("schools", seeded.schoolId),
      successorMembership: await ctx.db
        .query("schoolMembers")
        .withIndex("by_schoolId_and_userId_and_status", (query) =>
          query
            .eq("schoolId", seeded.schoolId)
            .eq("userId", seeded.successorId)
            .eq("status", "active")
        )
        .unique(),
      transfers: await ctx.db.query("accountDeletionSchoolTransfers").collect(),
    }));

    expect(outcome).toBe("ready");
    expect(state.owner?.deletionPreparedAt).toEqual(expect.any(Number));
    expect(state.owner).not.toHaveProperty("deletedAt");
    expect(state.school?.createdBy).toBe(seeded.ownerId);
    expect(state.school).not.toHaveProperty("updatedBy");
    expect(state.successorMembership?.role).toBe("student");
    expect(state.preparation).toMatchObject({
      authId: "transfer-owner",
      userId: seeded.ownerId,
    });
    expect(state.transfers).toEqual([
      expect.objectContaining({
        preparationId: state.preparation?._id,
        schoolId: seeded.schoolId,
        successorUserId: seeded.successorId,
      }),
    ]);
  });

  it("quiesces account writes from the first reservation batch", async () => {
    const t = convexTest(schema, convexModules);
    const ownerId = await t.mutation(async (ctx) => {
      const ownerId = await insertUser(ctx, "quiesced-owner");
      const successorId = await insertUser(ctx, "quiesced-successor");
      const schoolId = await insertOwnedSchool(ctx, ownerId, "quiesced-school");
      await insertActiveSchoolMember(ctx, schoolId, successorId);
      return ownerId;
    });

    const outcome = await t.mutation((ctx) =>
      runConvexProgram(
        prepareAccountDeletion(ctx, "quiesced-owner", ATTEMPT_ID)
      )
    );
    const state = await t.query(async (ctx) => ({
      owner: await ctx.db.get("users", ownerId),
      preparation: await ctx.db.query("accountDeletionPreparations").unique(),
    }));

    expect(outcome).toBe("continue");
    expect(state.owner?.deletionPreparedAt).toEqual(expect.any(Number));
    expect(state.preparation?.recoveryAt).toEqual(expect.any(Number));
  });

  it("blocks a successor whose account is already prepared for deletion", async () => {
    const t = convexTest(schema, convexModules);

    const ownerId = await t.mutation(async (ctx) => {
      const ownerId = await insertUser(ctx, "concurrent-owner");
      const deletingSuccessorId = await insertUser(
        ctx,
        "concurrent-successor",
        { deletionPreparedAt: NOW }
      );
      const schoolId = await insertOwnedSchool(
        ctx,
        ownerId,
        "concurrent-deletion-school"
      );
      await insertActiveSchoolMember(ctx, schoolId, ownerId, "admin");
      await insertActiveSchoolMember(
        ctx,
        schoolId,
        deletingSuccessorId,
        "teacher"
      );

      return ownerId;
    });
    const outcome = await settlePreparation(() =>
      t.mutation((ctx) =>
        runConvexProgram(
          prepareAccountDeletion(ctx, "concurrent-owner", ATTEMPT_ID)
        )
      )
    );
    const owner = await t.query(async (ctx) => await ctx.db.get(ownerId));

    expect(outcome).toBe("school-successor-required");
    expect(owner).not.toHaveProperty("deletedAt");
    expect(owner).not.toHaveProperty("deletionPreparedAt");
  });

  it("blocks a user reserved as another owner's successor", async () => {
    const t = convexTest(schema, convexModules);

    const reservedUserId = await t.mutation(async (ctx) => {
      const ownerId = await insertUser(ctx, "reserving-owner");
      const successorId = await insertUser(ctx, "reserved-successor");
      const schoolId = await insertOwnedSchool(ctx, ownerId, "reserved-school");
      const membershipId = await insertActiveSchoolMember(
        ctx,
        schoolId,
        successorId
      );
      const preparationId = await ctx.db.insert("accountDeletionPreparations", {
        attemptId: ATTEMPT_ID,
        authId: "reserving-owner",
        recoveryGeneration: 0,
        userId: ownerId,
      });
      await ctx.db.insert("accountDeletionSchoolTransfers", {
        preparationId,
        schoolId,
        successorMembershipId: membershipId,
        successorUserId: successorId,
      });

      return successorId;
    });
    const outcome = await t.mutation((ctx) =>
      runConvexProgram(
        prepareAccountDeletion(ctx, "reserved-successor", ATTEMPT_ID)
      )
    );
    const state = await t.query(async (ctx) => ({
      preparations: await ctx.db.query("accountDeletionPreparations").collect(),
      user: await ctx.db.get("users", reservedUserId),
    }));

    expect(outcome).toBe("temporarily-unavailable");
    expect(state.preparations).toHaveLength(1);
    expect(state.user).not.toHaveProperty("deletionPreparedAt");
  });

  it("refreshes one preparation without duplicating it", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation((ctx) => insertUser(ctx, "retry-owner"));

    for (const now of [NOW, NOW + 1000]) {
      vi.setSystemTime(now);
      await t.mutation((ctx) =>
        runConvexProgram(prepareAccountDeletion(ctx, "retry-owner", ATTEMPT_ID))
      );
    }

    const preparations = await t.query((ctx) =>
      ctx.db.query("accountDeletionPreparations").collect()
    );

    expect(preparations).toHaveLength(1);
    expect(preparations[0]?.attemptId).toBe(ATTEMPT_ID);
    expect(preparations[0]?.recoveryAt).toBe(
      NOW + 1000 + ACCOUNT_DELETION_RECOVERY_DELAY_MS
    );
    expect(preparations[0]?.recoveryGeneration).toBe(2);
  });

  it("rejects a concurrent browser attempt without changing the reservation", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation((ctx) => insertUser(ctx, "concurrent-attempt-owner"));

    await t.mutation((ctx) =>
      runConvexProgram(
        prepareAccountDeletion(ctx, "concurrent-attempt-owner", ATTEMPT_ID)
      )
    );
    const initialPreparation = await t.query((ctx) =>
      ctx.db.query("accountDeletionPreparations").unique()
    );
    const outcome = await t.mutation((ctx) =>
      runConvexProgram(
        prepareAccountDeletion(
          ctx,
          "concurrent-attempt-owner",
          "019fa44c-02be-7cd0-a4ed-61a7af8e0621"
        )
      )
    );
    const preparation = await t.query((ctx) =>
      ctx.db.query("accountDeletionPreparations").unique()
    );

    expect(outcome).toBe("temporarily-unavailable");
    expect(preparation?.attemptId).toBe(ATTEMPT_ID);
    expect(preparation?.recoveryGeneration).toBe(
      initialPreparation?.recoveryGeneration
    );
    expect(preparation?.recoveryAt).toBe(initialPreparation?.recoveryAt);
  });

  it("prepares more owned schools than one transaction batch", async () => {
    const t = convexTest(schema, convexModules);
    const continuedPreparations: Doc<"accountDeletionPreparations">[] = [];
    let currentTime = NOW;
    const seeded = await t.mutation(async (ctx) => {
      const ownerId = await insertUser(ctx, "many-schools-owner");
      const successorId = await insertUser(ctx, "many-schools-successor");

      for (
        let index = 0;
        index <= ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE;
        index += 1
      ) {
        const schoolId = await insertOwnedSchool(
          ctx,
          ownerId,
          `many-schools-${index}`
        );
        await insertActiveSchoolMember(ctx, schoolId, successorId);
      }

      return ownerId;
    });
    const outcome = await settlePreparation(
      () => {
        vi.setSystemTime(currentTime);
        currentTime += 1000;
        return t.mutation((ctx) =>
          runConvexProgram(
            prepareAccountDeletion(ctx, "many-schools-owner", ATTEMPT_ID)
          )
        );
      },
      async (stepOutcome) => {
        const preparation = await t.query((ctx) =>
          ctx.db.query("accountDeletionPreparations").unique()
        );
        if (stepOutcome === "continue" && preparation) {
          continuedPreparations.push(preparation);
        }
      }
    );
    const state = await t.query(async (ctx) => ({
      owner: await ctx.db.get("users", seeded),
      transferCount: (
        await ctx.db.query("accountDeletionSchoolTransfers").collect()
      ).length,
    }));

    expect(outcome).toBe("ready");
    expect(state.owner?.deletionPreparedAt).toEqual(expect.any(Number));
    expect(state.transferCount).toBe(
      ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE + 1
    );
    expect(continuedPreparations).toHaveLength(
      (ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE + 1) * 2
    );
    for (const [index, preparation] of continuedPreparations.entries()) {
      expect(preparation.recoveryAt).toBe(
        NOW + index * 1000 + ACCOUNT_DELETION_RECOVERY_DELAY_MS
      );
      expect(preparation.recoveryGeneration).toBe(index + 1);
    }
  });

  it("continues canceling prior reservations after a later school has no successor", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, convexModules);
    const ownerId = await t.mutation(async (ctx) => {
      const insertedOwnerId = await insertUser(ctx, "partially-reserved-owner");
      const successorId = await insertUser(ctx, "partially-reserved-successor");

      for (
        let index = 0;
        index <= ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE;
        index += 1
      ) {
        const schoolId = await insertOwnedSchool(
          ctx,
          insertedOwnerId,
          `partially-reserved-${index}`
        );
        await insertActiveSchoolMember(ctx, schoolId, successorId);
      }

      await insertOwnedSchool(ctx, insertedOwnerId, "successor-required");

      return insertedOwnerId;
    });
    const outcome = await settlePreparation(() =>
      t.mutation((ctx) =>
        runConvexProgram(
          prepareAccountDeletion(ctx, "partially-reserved-owner", ATTEMPT_ID)
        )
      )
    );
    const partial = await t.query(async (ctx) => ({
      jobs: await ctx.db.system.query("_scheduled_functions").collect(),
      preparation: await ctx.db.query("accountDeletionPreparations").unique(),
      transfers: await ctx.db.query("accountDeletionSchoolTransfers").collect(),
      user: await ctx.db.get("users", ownerId),
    }));

    expect(outcome).toBe("school-successor-required");
    expect(partial.user).not.toHaveProperty("deletionPreparedAt");
    expect(partial.preparation).not.toBeNull();
    expect(partial.transfers).toHaveLength(1);
    expect(partial.jobs).toEqual([
      expect.objectContaining({
        args: [
          expect.objectContaining({
            attemptId: ATTEMPT_ID,
            authId: "partially-reserved-owner",
          }),
        ],
        name: expect.stringContaining("continueAccountDeletionCancellation"),
      }),
    ]);

    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const settled = await t.query(async (ctx) => ({
      preparations: await ctx.db.query("accountDeletionPreparations").collect(),
      transfers: await ctx.db.query("accountDeletionSchoolTransfers").collect(),
    }));

    expect(settled).toEqual({
      preparations: [],
      transfers: [],
    });
  });
});
