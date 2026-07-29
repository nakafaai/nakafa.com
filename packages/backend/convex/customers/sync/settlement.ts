import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { CustomerUpsertResult } from "@repo/backend/convex/customers/mutations/spec";
import type { PolarDeleteError } from "@repo/backend/convex/customers/polar/spec";
import {
  type CustomerSyncIoError,
  UserNotFound,
  userNotFoundCode,
} from "@repo/backend/convex/customers/sync/spec";
import { Effect } from "effect";

interface CustomerSyncSettlementOperations {
  readonly deleteLocalCustomer: () => Effect.Effect<void, CustomerSyncIoError>;
  readonly deletePolarCustomer: () => Effect.Effect<void, PolarDeleteError>;
}

/** Resolves the transactional write result without erasing cancelable state. */
export const settleCustomerSync = Effect.fn(
  "customers.sync.settleCustomerSync"
)(function* (
  result: CustomerUpsertResult,
  userId: Id<"users">,
  operations: CustomerSyncSettlementOperations
) {
  if (result.kind === "stored") {
    return result.customerId;
  }

  if (result.kind !== "prepared") {
    yield* operations.deletePolarCustomer();
    yield* operations.deleteLocalCustomer();
  }

  return yield* new UserNotFound({
    code: userNotFoundCode,
    message: `User not found for userId: ${userId}`,
  });
});
