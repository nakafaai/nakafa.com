import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { Schema } from "effect";

const subscriptionsMutationsGroup = GroupSpec.make("mutations")
  .addFunction(
    FunctionSpec.internalMutation({
      name: "createSubscription",
      args: Schema.Struct({
        subscription: Schema.Struct({
          amount: Schema.Union(Schema.Null, Schema.Number),
          cancelAtPeriodEnd: Schema.Boolean,
          checkoutId: Schema.Union(Schema.Null, Schema.String),
          createdAt: Schema.String,
          currency: Schema.Union(Schema.Null, Schema.String),
          currentPeriodEnd: Schema.Union(Schema.Null, Schema.String),
          currentPeriodStart: Schema.String,
          customerCancellationComment: Schema.optional(
            Schema.Union(Schema.Null, Schema.String)
          ),
          customerCancellationReason: Schema.optional(
            Schema.Union(Schema.Null, Schema.String)
          ),
          customerId: Schema.String,
          endedAt: Schema.Union(Schema.Null, Schema.String),
          id: Schema.String,
          metadata: Schema.Record({
            key: Schema.String,
            value: Schema.Union(Schema.String, Schema.Number, Schema.Boolean),
          }),
          modifiedAt: Schema.Union(Schema.Null, Schema.String),
          priceId: Schema.optional(Schema.String),
          productId: Schema.String,
          recurringInterval: Schema.Union(
            Schema.Null,
            Schema.Literal("day", "week", "month", "year")
          ),
          schoolId: Schema.optional(Schema.String),
          startedAt: Schema.Union(Schema.Null, Schema.String),
          status: Schema.String,
        }),
      }),
      returns: GenericId.GenericId("subscriptions"),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "updateSubscription",
      args: Schema.Struct({
        subscription: Schema.Struct({
          amount: Schema.Union(Schema.Null, Schema.Number),
          cancelAtPeriodEnd: Schema.Boolean,
          checkoutId: Schema.Union(Schema.Null, Schema.String),
          createdAt: Schema.String,
          currency: Schema.Union(Schema.Null, Schema.String),
          currentPeriodEnd: Schema.Union(Schema.Null, Schema.String),
          currentPeriodStart: Schema.String,
          customerCancellationComment: Schema.optional(
            Schema.Union(Schema.Null, Schema.String)
          ),
          customerCancellationReason: Schema.optional(
            Schema.Union(Schema.Null, Schema.String)
          ),
          customerId: Schema.String,
          endedAt: Schema.Union(Schema.Null, Schema.String),
          id: Schema.String,
          metadata: Schema.Record({
            key: Schema.String,
            value: Schema.Union(Schema.String, Schema.Number, Schema.Boolean),
          }),
          modifiedAt: Schema.Union(Schema.Null, Schema.String),
          priceId: Schema.optional(Schema.String),
          productId: Schema.String,
          recurringInterval: Schema.Union(
            Schema.Null,
            Schema.Literal("day", "week", "month", "year")
          ),
          schoolId: Schema.optional(Schema.String),
          startedAt: Schema.Union(Schema.Null, Schema.String),
          status: Schema.String,
        }),
      }),
      returns: Schema.Null,
    })
  );

export { subscriptionsMutationsGroup };

const subscriptionsQueriesGroup = GroupSpec.make("queries").addFunction(
  FunctionSpec.publicQuery({
    name: "hasActiveSubscription",
    args: Schema.Struct({ productId: Schema.String }),
    returns: Schema.Boolean,
  })
);

export { subscriptionsQueriesGroup };

const subscriptionsGroup = GroupSpec.make("subscriptions")
  .addGroup(subscriptionsMutationsGroup)
  .addGroup(subscriptionsQueriesGroup);

export { subscriptionsGroup };
