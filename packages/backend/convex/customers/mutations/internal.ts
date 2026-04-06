import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import tables from "@repo/backend/convex/customers/schema";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { v } from "convex/values";

type CustomerRecord = Omit<Doc<"customers">, "_creationTime" | "_id">;

/** Patches one local customer row to the latest Polar-backed fields. */
async function patchCustomerRow(
  ctx: MutationCtx,
  customer: Pick<Doc<"customers">, "_id">,
  nextCustomer: CustomerRecord
) {
  await ctx.db.patch("customers", customer._id, {
    externalId: nextCustomer.externalId,
    id: nextCustomer.id,
    metadata: nextCustomer.metadata,
    userId: nextCustomer.userId,
  });
}

/**
 * Delete a customer by Polar customer ID.
 * Internal function - called from Polar webhooks only.
 */
export const deleteCustomerById = internalMutation({
  args: v.object({
    id: v.string(),
  }),
  returns: v.null(),
  handler: async (ctx, args) => {
    const customer = await ctx.db
      .query("customers")
      .withIndex("by_polarId", (q) => q.eq("id", args.id))
      .unique();

    if (!customer) {
      return null;
    }

    await ctx.db.delete("customers", customer._id);

    return null;
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
  returns: vv.id("customers"),
  handler: async (ctx, args) => {
    const existingByUser = await ctx.db
      .query("customers")
      .withIndex("by_userId", (q) => q.eq("userId", args.customer.userId))
      .unique();
    const existingByPolarId = await ctx.db
      .query("customers")
      .withIndex("by_polarId", (q) => q.eq("id", args.customer.id))
      .unique();

    if (existingByUser && existingByPolarId) {
      if (existingByUser._id === existingByPolarId._id) {
        await patchCustomerRow(ctx, existingByUser, args.customer);
        return existingByUser._id;
      }

      await patchCustomerRow(ctx, existingByPolarId, args.customer);
      await ctx.db.delete("customers", existingByUser._id);
      return existingByPolarId._id;
    }

    if (existingByPolarId) {
      await patchCustomerRow(ctx, existingByPolarId, args.customer);
      return existingByPolarId._id;
    }

    if (existingByUser) {
      await patchCustomerRow(ctx, existingByUser, args.customer);
      return existingByUser._id;
    }

    return ctx.db.insert("customers", args.customer);
  },
});
