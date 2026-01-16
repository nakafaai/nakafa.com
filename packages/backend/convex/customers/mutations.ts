import { internalMutation } from "@repo/backend/convex/_generated/server";
import tables from "@repo/backend/convex/customers/schema";
import { ConvexError, v } from "convex/values";

/**
 * Delete a customer by Polar customer ID.
 * Internal function - called from Polar webhooks only.
 */
export const deleteCustomerById = internalMutation({
  args: v.object({
    id: v.string(),
  }),
  handler: async (ctx, args) => {
    const customer = await ctx.db
      .query("customers")
      .withIndex("id", (q) => q.eq("id", args.id))
      .unique();

    if (!customer) {
      throw new ConvexError({
        code: "CUSTOMER_NOT_FOUND",
        message: `Customer not found for id: ${args.id}`,
      });
    }

    await ctx.db.delete("customers", customer._id);
  },
});

/**
 * Upsert customer from Polar data.
 * Idempotent: safe to call multiple times with same data.
 * Handles both insert and update in a single transaction.
 * Used by webhooks and internal sync.
 * Polar is source of truth for all fields.
 */
export const upsertCustomer = internalMutation({
  args: {
    customer: tables.customers.validator,
  },
  returns: v.id("customers"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("customers")
      .withIndex("userId", (q) => q.eq("userId", args.customer.userId))
      .unique();

    if (existing) {
      await ctx.db.patch("customers", existing._id, {
        id: args.customer.id,
        externalId: args.customer.externalId,
        metadata: args.customer.metadata,
      });
      return existing._id;
    }

    return await ctx.db.insert("customers", args.customer);
  },
});
