import { ConvexError, v } from "convex/values";
import { internalMutation } from "../_generated/server";
import tables from "./schema";

/**
 * Insert a new customer record.
 * Internal function - called from actions and webhooks only.
 * Throws error if customer already exists for this user.
 */
export const insertCustomer = internalMutation({
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
 * Update an existing customer record.
 * Internal function - called from actions and webhooks only.
 * Polar is source of truth for metadata.
 * Throws error if customer doesn't exist.
 */
export const updateCustomer = internalMutation({
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

    // Update existing customer - Polar metadata overwrites local
    const updateFields: Partial<typeof args.customer> = {
      metadata: args.customer.metadata,
    };

    // Only update externalId if it's available
    if (args.customer.externalId) {
      updateFields.externalId = args.customer.externalId;
    }

    await ctx.db.patch("customers", customer._id, updateFields);

    return customer._id;
  },
});

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
 * Atomically sync customer data from Polar to local database.
 * Handles both insert and update in a single transaction.
 * Polar is source of truth - metadata overwrites local.
 */
export const syncCustomerFromPolar = internalMutation({
  args: {
    customer: tables.customers.validator,
  },
  returns: v.id("customers"),
  handler: async (ctx, args) => {
    // Check if customer exists
    const existingCustomer = await ctx.db
      .query("customers")
      .withIndex("userId", (q) => q.eq("userId", args.customer.userId))
      .unique();

    if (existingCustomer) {
      // Update existing customer - Polar metadata overwrites local
      await ctx.db.patch("customers", existingCustomer._id, {
        id: args.customer.id,
        externalId: args.customer.externalId,
        metadata: args.customer.metadata,
      });
      return existingCustomer._id;
    }

    // Insert new customer
    const customerId = await ctx.db.insert("customers", {
      id: args.customer.id,
      externalId: args.customer.externalId,
      userId: args.customer.userId,
      metadata: args.customer.metadata,
    });

    return customerId;
  },
});
