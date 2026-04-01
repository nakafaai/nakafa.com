import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { getPlanCreditConfig } from "@repo/backend/convex/credits/constants";
import type { UserPlan } from "@repo/backend/convex/users/schema";

type CreditStateUser = Pick<
  Doc<"users">,
  "credits" | "creditsResetAt" | "plan"
>;
type CreditDb = QueryCtx["db"] | MutationCtx["db"];

/** Returns the current UTC reset boundary for a plan. */
export function getCurrentCreditResetTimestamp(plan: UserPlan, now: number) {
  const resetDate = new Date(now);

  if (plan === "free") {
    resetDate.setUTCHours(0, 0, 0, 0);
    return resetDate.getTime();
  }

  resetDate.setUTCDate(1);
  resetDate.setUTCHours(0, 0, 0, 0);
  return resetDate.getTime();
}

/** Applies one materialized reset boundary to a stored user credit state. */
export function getEffectiveCreditStateForResetTimestamp(
  user: CreditStateUser,
  resetTimestamp: number
) {
  if (user.creditsResetAt >= resetTimestamp) {
    return {
      credits: user.credits,
      creditsResetAt: user.creditsResetAt,
    };
  }

  return {
    credits:
      getPlanCreditConfig(user.plan).amount +
      (user.credits < 0 ? user.credits : 0),
    creditsResetAt: resetTimestamp,
  };
}

/** Loads the stored current reset boundary for a plan. */
export async function getStoredCreditResetTimestamp(
  db: CreditDb,
  plan: UserPlan
) {
  const period = await db
    .query("creditResetPeriods")
    .withIndex("by_plan", (q) => q.eq("plan", plan))
    .unique();

  return period?.resetAt ?? null;
}

/** Resolves the current reset boundary for write paths. */
export async function resolveCurrentCreditResetTimestamp(
  db: MutationCtx["db"],
  plan: UserPlan,
  now: number
) {
  const currentResetTimestamp = getCurrentCreditResetTimestamp(plan, now);
  const storedResetTimestamp = await getStoredCreditResetTimestamp(db, plan);

  if (
    storedResetTimestamp !== null &&
    storedResetTimestamp >= currentResetTimestamp
  ) {
    return storedResetTimestamp;
  }

  await upsertStoredCreditResetTimestamp(db, plan, currentResetTimestamp);

  return currentResetTimestamp;
}

/** Resolves one user's effective credit state for the current reset period. */
export async function resolveEffectiveCreditState(
  db: MutationCtx["db"],
  user: CreditStateUser,
  now: number
) {
  const resetTimestamp = await resolveCurrentCreditResetTimestamp(
    db,
    user.plan,
    now
  );

  return getEffectiveCreditStateForResetTimestamp(user, resetTimestamp);
}

/** Upserts one materialized reset boundary row. */
export async function upsertStoredCreditResetTimestamp(
  db: MutationCtx["db"],
  plan: UserPlan,
  resetAt: number
) {
  const existingPeriod = await db
    .query("creditResetPeriods")
    .withIndex("by_plan", (q) => q.eq("plan", plan))
    .unique();

  if (!existingPeriod) {
    await db.insert("creditResetPeriods", {
      plan,
      resetAt,
    });
    return null;
  }

  if (existingPeriod.resetAt === resetAt) {
    return null;
  }

  await db.patch("creditResetPeriods", existingPeriod._id, {
    resetAt,
  });

  return null;
}
