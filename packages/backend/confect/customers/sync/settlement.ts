import type { CustomerUpsertResult } from "@repo/backend/confect/customers/mutations/spec";
import type { PolarDeleteError } from "@repo/backend/confect/customers/polar/spec";
import {
  type CustomerSyncIoError,
  UserNotFound,
  userNotFoundCode,
} from "@repo/backend/confect/customers/sync/spec";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Effect } from "effect";

/** Resolves the transactional write result without erasing cancelable state. */
export const settleCustomerSync = Effect.fn(
  "customers.sync.settleCustomerSync"
)(function* <R>(
  result: CustomerUpsertResult,
  userId: Id<"users">,
  operations: {
    readonly deleteLocalCustomer: () => Effect.Effect<
      void,
      CustomerSyncIoError,
      R
    >;
    readonly deletePolarCustomer: () => Effect.Effect<
      void,
      PolarDeleteError,
      R
    >;
  }
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
