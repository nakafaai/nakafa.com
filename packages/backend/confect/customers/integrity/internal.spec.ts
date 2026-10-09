import { FunctionSpec, GroupSpec } from "@confect/core";
import { PaginationOptions as PaginationOptionsSchema } from "@confect/core/PaginationOptions";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";

const customerIntegrityUserPageResultValidator = Schema.Struct({
  continueCursor: Schema.String,
  isDone: Schema.Boolean,
  page: Schema.mutable(
    Schema.Array(
      Schema.Struct({
        authId: Schema.String,
        email: Schema.String,
        userId: IdSchema("users"),
      })
    )
  ),
});
const customerIntegrityCustomerPageResultValidator = Schema.Struct({
  continueCursor: Schema.String,
  isDone: Schema.Boolean,
  page: Schema.mutable(
    Schema.Array(
      Schema.Struct({
        externalId: Schema.Union([Schema.String, Schema.Null]),
        localCustomerId: IdSchema("customers"),
        polarCustomerId: Schema.String,
        userId: IdSchema("users"),
      })
    )
  ),
});
const customerIntegritySubscriptionPageResultValidator = Schema.Struct({
  continueCursor: Schema.String,
  isDone: Schema.Boolean,
  page: Schema.mutable(
    Schema.Array(
      Schema.Struct({
        currentPeriodEnd: Schema.Union([Schema.String, Schema.Null]),
        customerId: Schema.String,
        status: Schema.String,
        subscriptionId: Schema.String,
      })
    )
  ),
});

/** Lists one bounded page of app users for customer-cohesion verification. */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalQuery({
      name: "listUsersForCustomerIntegrity",
      args: () => ({
        paginationOpts: PaginationOptionsSchema,
      }),
      returns: () => customerIntegrityUserPageResultValidator,
    })
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "listCustomersForIntegrity",
      args: () => ({
        paginationOpts: PaginationOptionsSchema,
      }),
      returns: () => customerIntegrityCustomerPageResultValidator,
    })
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "listActiveSubscriptionsForIntegrity",
      args: () => ({
        paginationOpts: PaginationOptionsSchema,
      }),
      returns: () => customerIntegritySubscriptionPageResultValidator,
    })
  );
