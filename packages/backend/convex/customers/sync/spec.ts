import type { ConvexTaggedError } from "@repo/backend/convex/lib/effect";
import { Schema } from "effect";

export const customerSyncIoErrorCode = "CUSTOMER_SYNC_IO_ERROR";
export const userNotFoundCode = "USER_NOT_FOUND";

export class CustomerSyncIoError
  extends Schema.TaggedError<CustomerSyncIoError>()("CustomerSyncIoError", {
    code: Schema.Literal(customerSyncIoErrorCode),
    message: Schema.String,
  })
  implements ConvexTaggedError
{
  declare readonly code: typeof customerSyncIoErrorCode;
  declare readonly message: string;
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
