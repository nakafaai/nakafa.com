import { internalQuery } from "@repo/backend/convex/_generated/server";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

const customerIntegrityUserPageResultValidator = v.object({
  continueCursor: v.string(),
  isDone: v.boolean(),
  page: v.array(
    v.object({
      authId: v.string(),
      email: v.string(),
      userId: vv.id("users"),
    })
  ),
});

const customerIntegrityCustomerPageResultValidator = v.object({
  continueCursor: v.string(),
  isDone: v.boolean(),
  page: v.array(
    v.object({
      externalId: v.union(v.string(), v.null()),
      localCustomerId: vv.id("customers"),
      polarCustomerId: v.string(),
      userId: vv.id("users"),
    })
  ),
});

const customerIntegritySubscriptionPageResultValidator = v.object({
  continueCursor: v.string(),
  isDone: v.boolean(),
  page: v.array(
    v.object({
      currentPeriodEnd: v.union(v.string(), v.null()),
      customerId: v.string(),
      status: v.string(),
      subscriptionId: v.string(),
    })
  ),
});

/** Lists one bounded page of app users for customer-cohesion verification. */
export const listUsersForCustomerIntegrity = internalQuery({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: customerIntegrityUserPageResultValidator,
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("users").paginate(args.paginationOpts);

    return {
      continueCursor: rows.continueCursor,
      isDone: rows.isDone,
      page: rows.page.map((row) => ({
        authId: row.authId,
        email: row.email,
        userId: row._id,
      })),
    };
  },
});

/** Lists one bounded page of local customer rows for cohesion verification. */
export const listCustomersForIntegrity = internalQuery({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: customerIntegrityCustomerPageResultValidator,
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("customers").paginate(args.paginationOpts);

    return {
      continueCursor: rows.continueCursor,
      isDone: rows.isDone,
      page: rows.page.map((row) => ({
        externalId: row.externalId,
        localCustomerId: row._id,
        polarCustomerId: row.id,
        userId: row.userId,
      })),
    };
  },
});

/** Lists one bounded page of active subscriptions for customer integrity checks. */
export const listActiveSubscriptionsForIntegrity = internalQuery({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: customerIntegritySubscriptionPageResultValidator,
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("subscriptions")
      .paginate(args.paginationOpts);

    return {
      continueCursor: rows.continueCursor,
      isDone: rows.isDone,
      page: rows.page
        .filter((row) => row.status === "active")
        .map((row) => ({
          currentPeriodEnd: row.currentPeriodEnd,
          customerId: row.customerId,
          status: row.status,
          subscriptionId: row.id,
        })),
    };
  },
});
