import { ConvexError, v } from "convex/values";
import { mutation } from "../_generated/server";
import tables from "./schema";

/**
 * Insert a new customer record.
 * Throws error if customer already exists for this user.
 */
export const insertCustomer = mutation({
  args: {
    customer: tables.customers.validator,
  },
  returns: v.id("customers"),
  handler: async (ctx, args) => {
    const existingCustomer = await ctx.db
      .query("customers")
      .withIndex("userId", (q) => q.eq("userId", args.customer.userId))
      .unique();

    if (existingCustomer) {
      return existingCustomer._id;
    }

    const customerId = await ctx.db.insert("customers", {
      id: args.customer.id,
      externalId: args.customer.externalId,
      userId: args.customer.userId,
      metadata: args.customer.metadata,
    });

    return customerId;
  },
});

/**
 * Insert or update a customer record.
 * Creates if doesn't exist, updates if exists.
 */
export const updateCustomer = mutation({
  args: {
    customer: tables.customers.validator,
  },
  returns: v.id("customers"),
  handler: async (ctx, args) => {
    const customer = await ctx.db
      .query("customers")
      .withIndex("userId", (q) => q.eq("userId", args.customer.userId))
      .unique();

    // Customer must exist
    if (!customer) {
      throw new ConvexError({
        code: "CUSTOMER_NOT_FOUND",
        message: `Customer not found for userId: ${args.customer.userId}`,
      });
    }

    // Update existing customer
    const updateFields: Partial<typeof args.customer> = {
      metadata: args.customer.metadata,
    };

    // Only update externalId if it's available
    if (args.customer.externalId) {
      updateFields.externalId = args.customer.externalId;
    }

    await ctx.db.patch(customer._id, updateFields);

    return customer._id;
  },
});

/**
 * Delete a customer by Polar customer ID.
 * Used by Polar webhooks when customer is deleted.
 */
export const deleteCustomerById = mutation({
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

    await ctx.db.delete(customer._id);
  },
});
