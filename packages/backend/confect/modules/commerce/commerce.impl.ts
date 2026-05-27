import { creditsLayer } from "@repo/backend/confect/modules/commerce/credits/credits.impl";
import { customersLayer } from "@repo/backend/confect/modules/commerce/customers/customers.impl";
import { subscriptionsLayer } from "@repo/backend/confect/modules/commerce/subscriptions/subscriptions.impl";
import { Layer } from "effect";

export const commerceLayer = Layer.mergeAll(
  subscriptionsLayer,
  creditsLayer,
  customersLayer
);
