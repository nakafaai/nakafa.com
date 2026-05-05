import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import { captureProductEvent } from "@repo/backend/convex/analytics/capture";
import { getPlanCreditConfig } from "@repo/backend/convex/credits/constants";
import { resolveCurrentCreditResetTimestamp } from "@repo/backend/convex/credits/helpers/state";
import { listCanonicalActiveTryoutSubscriptions } from "@repo/backend/convex/tryoutAccess/helpers/subscriptions";
import type { UserPlan } from "@repo/backend/convex/users/schema";
import { logger } from "@repo/backend/convex/utils/logger";
import { products } from "@repo/backend/convex/utils/polar/products";
import type { GenericMutationCtx } from "convex/server";
import { getOneFrom } from "convex-helpers/server/relationships";

const productToPlanMap: Record<string, UserPlan> = {
  [products.pro.id]: "pro",
};

/** Map one Polar product ID to the matching app plan tier. */
function getPlanFromProductId(productId: string): UserPlan {
  return productToPlanMap[productId] ?? "free";
}

/** Keep the higher-credit plan when multiple active subscriptions overlap. */
function getHigherPlan(currentPlan: UserPlan, nextPlan: UserPlan): UserPlan {
  const currentCredits = getPlanCreditConfig(currentPlan).amount;
  const nextCredits = getPlanCreditConfig(nextPlan).amount;

  return nextCredits > currentCredits ? nextPlan : currentPlan;
}

/**
 * Apply a plan change for a user and record the corresponding credit
 * transaction when credits need to be reset.
 */
async function applyPlanChange(
  ctx: GenericMutationCtx<DataModel>,
  user: DataModel["users"]["document"],
  newPlan: UserPlan,
  now: number,
  subscription: DataModel["subscriptions"]["document"]
) {
  const previousPlan = user.plan;
  const timestamp = new Date(now);
  const newCreditConfig = getPlanCreditConfig(newPlan);
  const nextResetTimestamp = await resolveCurrentCreditResetTimestamp(
    ctx.db,
    newPlan,
    now
  );

  // syncCustomerPlan only calls this helper after filtering out no-op changes,
  // so the current free/pro plan model only has two live transitions left.
  if (newPlan === "pro") {
    await ctx.db.patch("users", user._id, {
      plan: newPlan,
      credits: newCreditConfig.amount,
      creditsResetAt: nextResetTimestamp,
    });

    await ctx.db.insert("creditTransactions", {
      userId: user._id,
      amount: newCreditConfig.amount,
      type: "purchase",
      balanceAfter: newCreditConfig.amount,
      metadata: {
        reason: "plan-upgrade",
        "previous-plan": previousPlan,
        "new-plan": newPlan,
        "subscription-id": subscription.id,
      },
    });

    logger.info("User upgraded with credits", {
      userId: user._id,
      subscriptionId: subscription.id,
      creditsGranted: newCreditConfig.amount,
      previousPlan,
      newPlan,
    });

    await captureProductEvent(ctx, {
      distinctId: user._id,
      event: {
        name: "subscription started",
        properties: {
          product_id: subscription.productId,
          status: subscription.status,
          subscription_id: subscription.id,
        },
      },
      timestamp,
    });

    await captureProductEvent(ctx, {
      distinctId: user._id,
      event: {
        name: "plan changed",
        properties: {
          new_plan: newPlan,
          previous_plan: previousPlan,
          subscription_id: subscription.id,
        },
      },
      timestamp,
    });

    return;
  }

  await ctx.db.patch("users", user._id, {
    plan: newPlan,
    credits: newCreditConfig.amount,
    creditsResetAt: nextResetTimestamp,
  });

  await ctx.db.insert("creditTransactions", {
    userId: user._id,
    amount: newCreditConfig.amount,
    type: newCreditConfig.grantType,
    balanceAfter: newCreditConfig.amount,
    metadata: {
      reason: "plan-downgrade",
      "previous-plan": previousPlan,
      "new-plan": newPlan,
      "subscription-id": subscription.id,
    },
  });

  logger.info("User downgraded, credits adjusted", {
    userId: user._id,
    subscriptionId: subscription.id,
    newCredits: newCreditConfig.amount,
    previousPlan,
    newPlan,
  });

  await captureProductEvent(ctx, {
    distinctId: user._id,
    event: {
      name: "subscription canceled",
      properties: {
        product_id: subscription.productId,
        status: subscription.status,
        subscription_id: subscription.id,
      },
    },
    timestamp,
  });

  await captureProductEvent(ctx, {
    distinctId: user._id,
    event: {
      name: "plan changed",
      properties: {
        new_plan: newPlan,
        previous_plan: previousPlan,
        subscription_id: subscription.id,
      },
    },
    timestamp,
  });
}

/** Recompute the effective user plan for one subscription change. */
export async function syncCustomerPlan(
  ctx: GenericMutationCtx<DataModel>,
  subscription: DataModel["subscriptions"]["document"]
) {
  const customer = await getOneFrom(
    ctx.db,
    "customers",
    "by_polarId",
    subscription.customerId,
    "id"
  );

  if (!customer) {
    logger.warn("Subscription trigger: Customer not found", {
      subscriptionId: subscription.id,
      customerId: subscription.customerId,
    });
    return;
  }

  const user = await ctx.db.get("users", customer.userId);

  if (!user) {
    logger.warn("Subscription trigger: User not found", {
      userId: customer.userId,
      subscriptionId: subscription.id,
    });
    return;
  }

  const now = Date.now();
  const activeSubscriptions = await listCanonicalActiveTryoutSubscriptions(
    ctx.db,
    {
      customerId: subscription.customerId,
    }
  );

  let newPlan: UserPlan = "free";
  let planChangeSubscription = subscription;

  for (const row of activeSubscriptions) {
    const rowPlan = getPlanFromProductId(row.productId);
    const highestPlan = getHigherPlan(newPlan, rowPlan);

    if (highestPlan === newPlan) {
      continue;
    }

    newPlan = highestPlan;
    planChangeSubscription = row;
  }

  if (newPlan === user.plan) {
    return;
  }

  await applyPlanChange(ctx, user, newPlan, now, planChangeSubscription);
}
