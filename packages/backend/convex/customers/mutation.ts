import { v } from "convex/values";
import { mutation } from "../_generated/server";
import tables from "./schema";

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
      throw new Error(
        `Customer already exists for user: ${args.customer.userId}`,
      );
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

export const upsertCustomer = mutation({
  args: {
    customer: tables.customers.validator,
  },
  returns: v.id("customers"),
  handler: async (ctx, args) => {
    const customer = await ctx.db
      .query("customers")
      .withIndex("userId", (q) => q.eq("userId", args.customer.userId))
      .unique();
    if (!customer) {
      const customerId = await ctx.db.insert("customers", {
        id: args.customer.id,
        externalId: args.customer.externalId,
        userId: args.customer.userId,
        metadata: args.customer.metadata,
      });
      return customerId;
    }
    await ctx.db.patch(customer._id, {
      externalId: args.customer.externalId,
      metadata: args.customer.metadata,
    });
    return customer._id;
  },
});

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
      throw new Error(`Customer not found for id: ${args.id}`);
    }
    await ctx.db.delete(customer._id);
  },
});
