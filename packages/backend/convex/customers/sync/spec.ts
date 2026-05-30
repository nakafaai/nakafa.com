import type { ConvexTaggedError } from "@repo/backend/convex/lib/effect";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { type Infer, v } from "convex/values";
import { Schema } from "effect";

export const customerExternalIdInUseCode = "CUSTOMER_EXTERNAL_ID_IN_USE";
export const customerHasActiveSubscriptionCode =
  "CUSTOMER_HAS_ACTIVE_SUBSCRIPTION";
export const customerNotOrphanedCode = "CUSTOMER_NOT_ORPHANED";
export const customerSyncIoErrorCode = "CUSTOMER_SYNC_IO_ERROR";
export const userNotFoundCode = "USER_NOT_FOUND";

export const repairCustomerResultValidator = v.union(
  v.object({
    localCustomerId: vv.id("customers"),
    status: v.literal("synced"),
  }),
  v.object({
    existingExternalId: v.union(v.string(), v.null()),
    polarCustomerId: v.string(),
    status: v.literal("conflict"),
  })
);

export type RepairCustomerResult = Infer<typeof repairCustomerResultValidator>;

export class CustomerExternalIdInUse
  extends Schema.TaggedError<CustomerExternalIdInUse>()(
    "CustomerExternalIdInUse",
    {
      code: Schema.Literal(customerExternalIdInUseCode),
      message: Schema.String,
    }
  )
  implements ConvexTaggedError
{
  declare readonly code: typeof customerExternalIdInUseCode;
  declare readonly message: string;
}

export class CustomerHasActiveSubscription
  extends Schema.TaggedError<CustomerHasActiveSubscription>()(
    "CustomerHasActiveSubscription",
    {
      code: Schema.Literal(customerHasActiveSubscriptionCode),
      message: Schema.String,
    }
  )
  implements ConvexTaggedError
{
  declare readonly code: typeof customerHasActiveSubscriptionCode;
  declare readonly message: string;
}

export class CustomerNotOrphaned
  extends Schema.TaggedError<CustomerNotOrphaned>()("CustomerNotOrphaned", {
    code: Schema.Literal(customerNotOrphanedCode),
    message: Schema.String,
  })
  implements ConvexTaggedError
{
  declare readonly code: typeof customerNotOrphanedCode;
  declare readonly message: string;
}

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
