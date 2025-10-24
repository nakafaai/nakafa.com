import type { Customer } from "@polar-sh/sdk/models/components/customer.js";
import type {
  GenericActionCtx,
  GenericDataModel,
  WithoutSystemFields,
} from "convex/server";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";

export function convertToDatabaseCustomer(
  customer: Customer & { userId: Id<"users"> },
): WithoutSystemFields<Doc<"customers">> {
  return {
    id: customer.id,
    externalId: customer.externalId,
    userId: customer.userId,
    metadata: customer.metadata,
  };
}

export async function findUserIdFromCustomer(
  ctx: GenericActionCtx<GenericDataModel>,
  customerData: { externalId?: string | null; email: string },
): Promise<Id<"users"> | null> {
  // externalId is the authId from Better Auth
  const authId = customerData.externalId;
  if (authId) {
    const user = await ctx.runQuery(internal.users.queries.getUserByAuthId, {
      authId,
    });
    if (user) {
      return user._id;
    }
  }

  // fallback to email, get from app users table
  const user = await ctx.runQuery(internal.users.queries.getUserByEmail, {
    email: customerData.email,
  });

  if (user) {
    return user._id;
  }

  // fallback to email, get from betterAuth user table
  const authUser = await ctx.runQuery(internal.betterAuth.auth.getUserByEmail, {
    email: customerData.email,
  });

  if (authUser?.userId) {
    return authUser.userId as Id<"users">;
  }

  return null;
}
