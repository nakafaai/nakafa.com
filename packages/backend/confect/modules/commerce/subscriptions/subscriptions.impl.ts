import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import {
  createSubscription as commerceSubscriptions_createSubscription,
  hasActiveSubscription as commerceSubscriptions_hasActiveSubscription,
  updateSubscription as commerceSubscriptions_updateSubscription,
} from "@repo/backend/confect/modules/commerce/subscriptions.service";
import { Effect, Layer } from "effect";

const subscriptions_mutations_createSubscriptionImpl = FunctionImpl.make(
  api,
  "subscriptions.mutations",
  "createSubscription",
  (args) => commerceSubscriptions_createSubscription(args)
);

const subscriptions_mutations_updateSubscriptionImpl = FunctionImpl.make(
  api,
  "subscriptions.mutations",
  "updateSubscription",
  (args) => commerceSubscriptions_updateSubscription(args)
);

const subscriptions_queries_hasActiveSubscriptionImpl = FunctionImpl.make(
  api,
  "subscriptions.queries",
  "hasActiveSubscription",
  (args) =>
    commerceSubscriptions_hasActiveSubscription(args).pipe(
      Effect.catchTag("UnauthorizedUser", (error) => Effect.die(error))
    )
);

const subscriptionsMutationsImpl = GroupImpl.make(
  api,
  "subscriptions.mutations"
)
  .pipe(Layer.provide(subscriptions_mutations_createSubscriptionImpl))
  .pipe(Layer.provide(subscriptions_mutations_updateSubscriptionImpl));

const subscriptionsQueriesImpl = GroupImpl.make(
  api,
  "subscriptions.queries"
).pipe(Layer.provide(subscriptions_queries_hasActiveSubscriptionImpl));

const subscriptionsImpl = GroupImpl.make(api, "subscriptions")
  .pipe(Layer.provide(subscriptionsMutationsImpl))
  .pipe(Layer.provide(subscriptionsQueriesImpl));

export const subscriptionsLayer = Layer.mergeAll(subscriptionsImpl);
