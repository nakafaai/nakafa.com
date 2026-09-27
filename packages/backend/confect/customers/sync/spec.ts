import {
  type ConvexTaggedError,
  failureWire,
} from "@repo/backend/confect/failure";
import { Schema } from "effect";
export const customerSyncIoErrorCode = "CUSTOMER_SYNC_IO_ERROR";
export const userNotFoundCode = "USER_NOT_FOUND";
export class CustomerSyncIoError
  extends Schema.TaggedError<CustomerSyncIoError>()("CustomerSyncIoError", {
    code: Schema.Literal(customerSyncIoErrorCode),
    cause: Schema.optional(Schema.Unknown),
    message: Schema.String,
  })
  implements ConvexTaggedError
{
  declare readonly code: typeof customerSyncIoErrorCode;
  declare readonly message: string;
}

/** Preserves the operation context while normalizing an unknown IO failure. */
/** Public failure payload keeps the domain tag while preserving the deployed code/message transport. */
export const CustomerSyncIoErrorWire = failureWire(CustomerSyncIoError);
export function customerSyncIoError(message: string, error: unknown) {
  return new CustomerSyncIoError({
    code: customerSyncIoErrorCode,
    cause: error,
    message,
  });
}
export class UserNotFound
  extends Schema.TaggedError<UserNotFound>()("UserNotFound", {
    code: Schema.Literal(userNotFoundCode),
    message: Schema.String,
  })
  implements ConvexTaggedError
{
  declare readonly code: typeof userNotFoundCode;
  declare readonly message: string;
}
/** Public failure payload keeps the domain tag while preserving the deployed code/message transport. */
export const UserNotFoundWire = failureWire(UserNotFound);
