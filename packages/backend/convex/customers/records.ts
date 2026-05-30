import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { PolarMetadata } from "@repo/backend/convex/customers/polar/spec";
import type { WithoutSystemFields } from "convex/server";

/**
 * Convert one normalized Polar customer to the local database row shape.
 */
export function convertToDatabaseCustomer(customer: {
  readonly externalId?: string | null;
  readonly id: string;
  readonly metadata: PolarMetadata;
  readonly userId: Id<"users">;
}): WithoutSystemFields<Doc<"customers">> {
  return {
    id: customer.id,
    externalId: customer.externalId ?? null,
    userId: customer.userId,
    metadata: customer.metadata,
  };
}
