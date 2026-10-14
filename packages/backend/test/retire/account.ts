import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { DateTime } from "effect";

/** One Polar subscription row with every required field and a stable time. */
export function subscriptionRow(id: string, now: number) {
  const timestamp = DateTime.formatIso(DateTime.makeUnsafe(now));
  return {
    amount: null,
    cancelAtPeriodEnd: false,
    checkoutId: null,
    createdAt: timestamp,
    currency: null,
    currentPeriodEnd: null,
    currentPeriodStart: timestamp,
    customerId: "retire-customer",
    endedAt: null,
    id,
    metadata: {},
    modifiedAt: null,
    productId: "retire-product",
    recurringInterval: null,
    startedAt: timestamp,
    status: "active",
  };
}

/**
 * Seeds what the first School left on the account and billing side: a deletion
 * preparation that holds every school field next to one that holds none, the
 * transfer row that hangs off the first, and a subscription that links to the
 * school next to one that does not. The link sits in the `metadata` of the
 * first as well, as Polar sent it.
 */
export async function seedAccounts(
  ctx: MutationCtx,
  school: {
    readonly member: Id<"users">;
    readonly membershipId: Id<"schoolMembers">;
    readonly now: number;
    readonly owner: Id<"users">;
    readonly schoolId: Id<"schools">;
  }
) {
  const preparationId = await ctx.db.insert("accountDeletionPreparations", {
    attemptId: "retire-attempt",
    authId: "retire-owner",
    cancellationStartedAt: school.now,
    pendingSchoolId: school.schoolId,
    pendingSchoolNextCursor: "next-school",
    recoveryGeneration: 0,
    schoolCursor: "school",
    successorCursor: "successor",
    userId: school.owner,
  });
  await ctx.db.insert("accountDeletionPreparations", {
    authId: "retire-member",
    recoveryGeneration: 0,
    userId: school.member,
  });
  await ctx.db.insert("accountDeletionSchoolTransfers", {
    preparationId,
    schoolId: school.schoolId,
    successorMembershipId: school.membershipId,
    successorUserId: school.member,
  });
  const linked = await ctx.db.insert("subscriptions", {
    ...subscriptionRow("retire-linked", school.now),
    metadata: { schoolId: school.schoolId },
    schoolId: school.schoolId,
  });
  const plain = await ctx.db.insert(
    "subscriptions",
    subscriptionRow("retire-plain", school.now)
  );
  return { linked, plain, preparationId };
}
