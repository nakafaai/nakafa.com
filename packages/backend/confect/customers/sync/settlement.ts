import type { CustomerUpsertResult } from "@repo/backend/confect/customers/mutations/spec";
import type { PolarDeleteError } from "@repo/backend/confect/customers/polar/spec";
import {
  type CustomerSyncIoError,
  UserNotFound,
  userNotFoundCode,
} from "@repo/backend/confect/customers/sync/spec";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Effect } from "effect";

type DeleteLocalCustomer<R = never> = () => Effect.Effect<
  void,
  CustomerSyncIoError,
  R
>;
type DeletePolarCustomer<R = never> = () => Effect.Effect<
  void,
  PolarDeleteError,
  R
>;

/** Resolves the transactional write result without erasing cancelable state. */
export const settleCustomerSync = Effect.fn(
  "customers.sync.settleCustomerSync"
)(function* <R>(
  result: CustomerUpsertResult,
  userId: Id<"users">,
  deleteLocalCustomer: DeleteLocalCustomer<R>,
  deletePolarCustomer: DeletePolarCustomer<R>
) {
  if (result.kind === "stored") {
    return result.customerId;
  }
  if (result.kind !== "prepared") {
    yield* deletePolarCustomer();
    yield* deleteLocalCustomer();
  }
  return yield* new UserNotFound({
    code: userNotFoundCode,
    message: `User not found for userId: ${userId}`,
  });
});
